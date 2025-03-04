import React, { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import GameSpace from "./GameSpace";
import VideoApp from "./VideoApp";

// Simple example "modal" overlay
const CallPrompt = ({ callerName, onAccept, onDecline }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <div style={{ backgroundColor: "#fff", padding: 20, borderRadius: 8 }}>
      <h2>{callerName} wants to start a call. Accept?</h2>
      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <button onClick={onAccept}>Accept</button>
        <button onClick={onDecline}>Decline</button>
      </div>
    </div>
  </div>
);

const ParentComponent = () => {
  const [callRequest, setCallRequest] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [remotePeer, setRemotePeer] = useState(null);
 
  const [callRoomId, setCallRoomId] = useState(null);

  
  const handleProximityChange = useCallback((isClose, peer) => {
    if (isClose && peer) {

      setCallRequest(peer);
    } else {
      setCallRequest(null);
    }
  }, []);

  const handleAcceptCall = () => {
    if (!callRequest) return;

    let sharedRoomId = callRoomId || callRequest.roomId;
    
    // If no roomId is present, generate one (ideally, the caller should do this
    // and send it along via your signaling system so both peers agree on the same ID)
    if (!sharedRoomId) {
      sharedRoomId = uuidv4();
    }
    
    // Store the shared roomId so that any subsequent accept uses the same value
    setCallRoomId(sharedRoomId);
    
    // Update the call request (remotePeer) so it includes the shared roomId
    const updatedRemotePeer = { ...callRequest, roomId: sharedRoomId };
    setRemotePeer(updatedRemotePeer);
    
    setInCall(true);
    setCallRequest(null);
  };

  /**
   * Called when the user clicks "Decline" on the call prompt.
   */
  const handleDeclineCall = () => {
    setCallRequest(null);
    // Optionally, send a decline signal to the caller.
  };

  /**
   * Called by VideoApp's `onCallEnd` prop when the user leaves the call.
   */
  const handleCallEnd = () => {
    setInCall(false);
    setRemotePeer(null);
    setCallRoomId(null);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      {/* GameSpace may trigger onProximityChange */}
      <GameSpace onProximityChange={handleProximityChange} />

      {/* Show the call prompt if there's a call request and not in a call */}
      {callRequest && !inCall && (
        <CallPrompt
          callerName={callRequest.username || "Unknown Caller"}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* When in a call, show VideoApp and pass the shared room ID */}
      {inCall && remotePeer && callRoomId && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <VideoApp
            remotePeer={remotePeer}
            roomId={callRoomId}
            onCallEnd={handleCallEnd}
          />
        </div>
      )}
    </div>
  );
};

export default ParentComponent;
