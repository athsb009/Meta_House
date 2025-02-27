import React, { useState, useCallback } from "react";
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

  /**
   *  Called by GameSpace when local player is near another
   */
  const handleProximityChange = useCallback((isClose, peer) => {
    if (isClose && peer) {
      // Show a prompt instead of automatically calling
      setCallRequest(peer);
    } else {
      setCallRequest(null);
    }
  }, []);

  /**
   *  Called when the user clicks "Accept" on the call prompt
   */
  const handleAcceptCall = () => {
    if (!callRequest) return;
    // We enter the "inCall" state, pass the peer info to VideoApp
    setRemotePeer(callRequest);
    setInCall(true);
    setCallRequest(null); // Clear the prompt
  };

  /**
   *  Called when the user clicks "Decline" 
   */
  const handleDeclineCall = () => {
    setCallRequest(null);
    // Optionally inform the "caller" that we declined
  };

  /**
   *  Called by VideoApp's `onCallEnd` prop 
   *  when the user clicks "Leave Call" inside VideoApp 
   */
  const handleCallEnd = () => {
    // Parent-level cleanup
    setInCall(false);
    setRemotePeer(null);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      {/* Render GameSpace, which can trigger onProximityChange */}
      <GameSpace onProximityChange={handleProximityChange} />

      {/* If not in call, but have a pending call request => show prompt */}
      {callRequest && !inCall && (
        <CallPrompt
          callerName={callRequest.username || "Unknown Caller"}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* If user accepted the call => show the VideoApp overlay */}
      {inCall && remotePeer && (
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
          {/* Provide a callback for leaving the call */}
          <VideoApp remotePeer={remotePeer} onCallEnd={handleCallEnd} />
        </div>
      )}
    </div>
  );
};

export default ParentComponent;
