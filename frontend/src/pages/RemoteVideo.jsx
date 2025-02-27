// RemoteVideo.jsx
import React, { useEffect, useRef } from 'react';

const RemoteVideo = ({ stream, id }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
        console.log('RemoteVideo stream:', stream.getTracks());
      // Set the stream as the srcObject
      videoRef.current.srcObject = stream;
      // Use a slight delay to ensure the video element is ready to play.
      const playTimeout = setTimeout(() => {
        videoRef.current.play().catch((error) => {
          console.error(`Error auto-playing remote video ${id}:`, error);
        });
      }, 100); // 100ms delay
      return () => clearTimeout(playTimeout);
    }
  }, [stream, id]);

  return (
    <div>
      <h3>Remote Video {id}</h3>
      <video
        ref={videoRef}
        autoPlay
        controls
        style={{ width: '300px', border: '1px solid black' }}
      />
    </div>
  );
};

export default RemoteVideo;
