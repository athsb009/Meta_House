// src/MediasoupApp.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import { Device } from 'mediasoup-client';

// Import reusable animated and theme components
import MotionPage from '../components/MotionPage';
import AnimatedBackground from '../components/AnimatedBackground';
import ThemeSwitcher from '../components/ThemeSwitcher';

// Simple component to render a MediaStream (audio+video)
const RemoteVideo = ({ id, stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      id={`video-${id}`}
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full rounded-lg border border-gray-300 shadow"
    />
  );
};

const VideoApp = ({ remotePeer, roomId: propRoomId, onCallEnd }) => {
  // --- Refs for Mediasoup and Socket Objects ---
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const consumerTransportRef = useRef(null);
  const videoProducerRef = useRef(null);
  const audioProducerRef = useRef(null);
  const rtpCapabilitiesRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);

  // Producer parameters for video.
  const producerParamsRef = useRef({
    encodings: [
      { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
      { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
      { rid: 'r2', maxBitrate: 900000, scalabilityMode: 'S1T3' },
    ],
    codecOptions: { videoGoogleStartBitrate: 1000 },
    track: null, // will be set after getUserMedia
  });

  // --- Local State for UI ---

  // If remotePeer exists, use its roomId; otherwise fallback to URL param.
  const [roomId, setRoomId] = useState(propRoomId ||'');
  const [joined, setJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState([]);

  useEffect(() => {
    // Update local video when joined and stream is available
    if (joined && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined]);

  // --- Socket Connection Setup ---
  useEffect(() => {
    socketRef.current = io('http://localhost:3001/video');

    socketRef.current.on('connection-success', ({ socketId }) => {
      console.log('Connected. Socket ID:', socketId);
      localPeerIdRef.current = socketId;
      
    });

    socketRef.current.on('newProducer', async ({ producerId, peerId }) => {

      console.log(`New producer from peer ${peerId}: ${producerId}`);
      await createConsumerForProducer(producerId, peerId);
    });

    socketRef.current.on('producerClosed', ({ producerId }) => {
      console.log('Remote producer closed:', producerId);
      setRemoteStreams((prev) => {
        let changed = false;
        const updated = prev
          .map((peerObj) => {
            if (!peerObj.producerIds.includes(producerId)) return peerObj;
            const newConsumers = peerObj.consumers.filter(
              (c) => c.producerId !== producerId
            );
            const newStream = new MediaStream();
            newConsumers.forEach((c) => newStream.addTrack(c.track));
            changed = true;
            return {
              ...peerObj,
              consumers: newConsumers,
              producerIds: peerObj.producerIds.filter((id) => id !== producerId),
              stream: newStream,
            };
          })
          .filter((obj) => obj.consumers.length > 0);
        return changed ? updated : prev;
      });
    });

    socketRef.current.on('peerDisconnected', ({ peerId }) => {
      console.log('Peer disconnected:', peerId);
      setRemoteStreams((prev) => {
        prev
          .filter((obj) => obj.peerId === peerId)
          .forEach((obj) => {
            obj.consumers.forEach((c) => c.close());
            obj.stream.getTracks().forEach((t) => t.stop());
          });
        return prev.filter((obj) => obj.peerId !== peerId);
      });
    });

    return () => {
      socketRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // --- Helper Functions ---

  // 1. Get local stream
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { min: 640, max: 1920 },
          height: { min: 400, max: 1080 },
        },
      });
      localStreamRef.current = stream; // Store the stream in the ref
      const videoTrack = stream.getVideoTracks()[0];
      producerParamsRef.current.track = videoTrack; // For sending the track
    } catch (err) {
      console.error('Error getting local stream:', err);
      throw err;
    }
  };

  // 2. Join the room
  const joinRoom = async () => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('joinRoom', { roomId }, ({ existingProducers, error: joinError }) => {
        if (joinError) {
          setError(joinError);
          return reject(joinError);
        }
        console.log('Joined room:', roomId, 'Existing producers:', existingProducers);
        resolve(existingProducers);
      });
    });
  };

  // 3. Get router RTP capabilities
  const getRtpCapabilities = async () => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('getRtpCapabilities', (data) => {
        console.log('Received RTP Capabilities response:', data);
        if (data && data.rtpCapabilities) {
          rtpCapabilitiesRef.current = data.rtpCapabilities;
          resolve(data.rtpCapabilities);
        } else {
          reject(new Error('Failed to get RTP Capabilities'));
        }
      });
    });
  };

  // 4. Create the Mediasoup device
  const createDevice = async () => {
    try {
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilitiesRef.current });
      deviceRef.current = device;
      console.log('Device loaded with capabilities:', device.rtpCapabilities);
    } catch (err) {
      console.error('Error creating device:', err);
      throw err;
    }
  };

  // 5. Create transport (send or receive)
  const createTransport = async (isSender) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('createWebRtcTransport', { sender: isSender }, ({ params, error: transportError }) => {
        if (transportError) return reject(transportError);

        const transport = isSender
          ? deviceRef.current.createSendTransport(params)
          : deviceRef.current.createRecvTransport(params);

        if (isSender) {
          producerTransportRef.current = transport;
        } else {
          consumerTransportRef.current = transport;
        }

        transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            socketRef.current.emit(`transport-${isSender ? 'connect' : 'recv-connect'}`, { dtlsParameters });
            callback();
          } catch (err) {
            errback(err);
          }
        });

        if (isSender) {
          transport.on('produce', async (parameters, callback, errback) => {
            try {
              socketRef.current.emit(
                'transport-produce',
                {
                  kind: parameters.kind,
                  rtpParameters: parameters.rtpParameters,
                  appData: parameters.appData,
                },
                ({ id, error: produceError }) => {
                  if (produceError) return errback(produceError);
                  callback({ id });
                }
              );
            } catch (err) {
              errback(err);
            }
          });
        }

        resolve();
      });
    });
  };

  // 6. Produce the local video track
  const connectSendTransport = async () => {
    if (videoProducerRef.current) {
      // Video producer already exists; do not produce again.
      return;
    }
    try {
      const videoProducer = await producerTransportRef.current.produce(producerParamsRef.current);
      videoProducerRef.current = videoProducer;
      videoProducer.on('trackended', () => console.log('Video producer track ended'));
      videoProducer.on('transportclose', () => console.log('Video producer transport closed'));
    } catch (err) {
      console.error('Error connecting send transport:', err);
      throw err;
    }
  };

  // 7. Produce the local audio track
  const produceAudio = async () => {
    if (audioProducerRef.current) {
      return; // Audio producer already exists.
    }
    try {
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (!audioTrack) {
        console.warn('No audio track available');
        return;
      }
      const audioProducer = await producerTransportRef.current.produce({ track: audioTrack });
      audioProducerRef.current = audioProducer;
      audioProducer.on('trackended', () => console.log('Audio producer track ended'));
      audioProducer.on('transportclose', () => console.log('Audio producer transport closed'));
      console.log('Audio producer created:', audioProducer.id);
    } catch (err) {
      console.error('Error producing audio:', err);
      throw err;
    }
  };

  // 8. Create a consumer for a given producer.
  const createConsumerForProducer = async (producerId, peerId) => {
    if (!deviceRef.current) {
      console.error('Device not created yet!');
      return;
    }
    return new Promise((resolve, reject) => {
      socketRef.current.emit(
        'consume',
        { rtpCapabilities: deviceRef.current.rtpCapabilities, producerId },
        async ({ params }) => {
          if (params.error) {
            console.error(`Cannot consume producer ${producerId}:`, params.error);
            return reject(params.error);
          }
          try {
            const consumer = await consumerTransportRef.current.consume({
              id: params.id,
              producerId: params.producerId,
              kind: params.kind,
              rtpParameters: params.rtpParameters,
              appData: { producerId },
            });

            consumer.on('transportclose', () => {
              console.log('Consumer transport closed', consumer.id);
            });

            consumer.on('producerclose', () => {
              console.log('Producer closed for consumer', consumer.id);
              setRemoteStreams((prev) =>
                prev
                  .map((obj) => {
                    const newConsumers = obj.consumers.filter((c) => c.id !== consumer.id);
                    const newStream = new MediaStream();
                    newConsumers.forEach((c) => newStream.addTrack(c.track));
                    return { ...obj, consumers: newConsumers, stream: newStream };
                  })
                  .filter((obj) => obj.consumers.length > 0)
              );
              consumer.close();
            });

            socketRef.current.emit('consumer-resume', { consumerId: consumer.id }, (response) => {
              if (response.error) {
                console.error('Error resuming consumer:', response.error);
                return reject(response.error);
              }
              // Merge consumer track into existing peer or add new.
              setRemoteStreams((prev) => {
                const existingPeer = prev.find((obj) => obj.peerId === peerId);
                if (existingPeer) {
                  existingPeer.stream.addTrack(consumer.track);
                  existingPeer.consumers.push(consumer);
                  existingPeer.producerIds.push(producerId);
                  return [...prev];
                } else {
                  return [
                    ...prev,
                    {
                      peerId,
                      consumers: [consumer],
                      producerIds: [producerId],
                      stream: new MediaStream([consumer.track]),
                    },
                  ];
                }
              });
              resolve();
            });
          } catch (err) {
            console.error('Error consuming producer', producerId, err);
            reject(err);
          }
        }
      );
    });
  };

  // Mute/Unmute function for local audio.
  const toggleMute = () => {
    if (!audioProducerRef.current) return;
  
    try {
      if (audioProducerRef.current.paused) {
        // Resume sending audio
        audioProducerRef.current.resume();
        setIsMuted(false);
        console.log("Unmuted audio producer");
      } else {
        // Pause sending audio
        audioProducerRef.current.pause();
        setIsMuted(true);
        console.log("Muted audio producer");
      }
    } catch (err) {
      console.error("Error toggling mute:", err);
    }
  };

  // --- Main Join Call Function ---
  const joinCall = useCallback(async () => {
    if (joined) return;
    setIsJoining(true);
    setError(null);
    try {
      await getLocalStream();
      const existingProducers = await joinRoom();
      await getRtpCapabilities();
      await createDevice();
      await createTransport(true);
      await connectSendTransport();
      await produceAudio();
      await createTransport(false);
      await Promise.all(
        existingProducers.map(({ producerId, peerId }) =>
          createConsumerForProducer(producerId, peerId)
        )
      );
      // Set joined to true AFTER everything is ready
      setJoined(true);
    } catch (err) {
      console.error("Error joining call:", err);
      setError(err?.toString?.() || "Error joining call");
      // Cleanup...
    } finally {
      setIsJoining(false);
    }
  }, [roomId, joined]);

  useEffect(() => {
    if (remotePeer && !joined) {
      joinCall(); // automatically triggers the Mediasoup join logic
    }
  }, [remotePeer, joined, joinCall]);

  // --- Leave Call Function ---
  const leaveCall = useCallback(() => {
    // 1. Stop local camera/mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // 2. Close Mediasoup producers/transports
    if (videoProducerRef.current) {
      videoProducerRef.current.close();
      videoProducerRef.current = null;
    }
    if (audioProducerRef.current) {
      audioProducerRef.current.close();
      audioProducerRef.current = null;
    }
    if (producerTransportRef.current) {
      producerTransportRef.current.close();
      producerTransportRef.current = null;
    }
    if (consumerTransportRef.current) {
      consumerTransportRef.current.close();
      consumerTransportRef.current = null;
    }

    // 3. Notify server we’re leaving
    socketRef.current?.emit('leaveRoom', { roomId });

    // 4. Reset local state
    setJoined(false);
    setRemoteStreams([]);
    setRoomId('');
    localStreamRef.current = null;

    // 5. Notify parent that we ended the call
    if (onCallEnd) onCallEnd();
  }, [roomId, onCallEnd]);



  // --- Rendered UI ---
  return (
    <MotionPage>
      <AnimatedBackground />
      <div className="relative z-10">
        <header className="p-4 flex justify-end">
          <ThemeSwitcher />
        </header>
        <div className="p-6 bg-gradient-to-br from-blue-100 to-purple-200 dark:from-blue-900 dark:to-purple-900 min-h-screen flex flex-col items-center">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">
            📹 Video Call
          </h1>
          {error && (
            <div className="text-red-600 bg-red-100 p-2 rounded mb-4">
              Error: {error}
            </div>
          )}
          {/* If no remotePeer prop is provided, allow manual input. */}
          {!joined && !remotePeer ? (
            <>
              {!roomFromParams && (
                <div className="mb-4 w-full max-w-md">
                  <input
                    type="text"
                    placeholder="Enter Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg shadow mb-4"
                  />
                </div>
              )}
              <button
                onClick={joinCall}
                disabled={isJoining}
                className="px-6 py-2 text-white bg-blue-500 hover:bg-blue-600 transition rounded-lg shadow"
              >
                {isJoining ? "Joining..." : "Join Call"}
              </button>
            </>
          ) : (
            <div className="mb-4 w-full max-w-md text-center">
              <p className="mb-2 text-lg text-gray-700 dark:text-gray-300">
                You are in room:{" "}
                <span className="font-semibold text-blue-600">{roomId}</span>
              </p>
              <button
                onClick={leaveCall}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow transition"
              >
                Leave Call
              </button>
            </div>
          )}

          {joined && (
            <div className="mb-4">
              <button
                onClick={toggleMute}
                className="px-4 py-2 bg-gray-700 text-white rounded"
              >
                {isMuted ? "Unmute Mic" : "Mute Mic"}
              </button>
            </div>
          )}

          {/* Video Containers */}
          <div className="flex gap-8 flex-wrap justify-center mt-6">
            {/* Local Video */}
            <div className="w-80 h-48 bg-transparent rounded-xl overflow-hidden shadow-2xl ring-4 ring-blue-500 ring-opacity-50 relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            {/* Remote Videos */}
            {remoteStreams.map(({ peerId, stream }) => (
              <div
                key={peerId}
                className="w-80 h-48 bg-transparent rounded-xl overflow-hidden shadow-2xl ring-4 ring-blue-500 ring-opacity-50 relative"
              >
                <RemoteVideo id={peerId} stream={stream} />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                  {peerId}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MotionPage>
  );
};

export default VideoApp;
