import React, { useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useParams } from "react-router-dom";
import GameSpace from "./GameSpace";
import VideoApp from "./VideoApp";
import GlobalChat from "../components/GlobalChat";

// Simple example "modal" overlay for call prompts
const CallPrompt = ({ callerName, onAccept, onDecline }) => (
  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
    <div className="bg-white p-5 rounded-md">
      <h2 className="text-xl font-bold">
        {callerName} wants to start a call. Accept?
      </h2>
      <div className="mt-4 flex gap-4">
        <button
          onClick={onAccept}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Decline
        </button>
      </div>
    </div>
  </div>
);

const ParentComponent = () => {
  // Profile state and profile fetching logic
  const [profile, setProfile] = useState(null);
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3001/users/profile", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (data.success && data.profile && data.profile.username) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Derive username from profile (or fallback to "Guest")
  const username = profile?.username || "Guest";

  // Get roomId from URL params; default to "global" if not provided
  const { roomId: routeRoomId } = useParams();
  const roomId = routeRoomId || "global";

  // Call and game states (unchanged)
  const [callRequest, setCallRequest] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [remotePeer, setRemotePeer] = useState(null);
  const [callRoomId, setCallRoomId] = useState(null);

  // State for showing/hiding the global chat
  const [showChat, setShowChat] = useState(false);
  const toggleChat = () => setShowChat((prev) => !prev);

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
    if (!sharedRoomId) {
      sharedRoomId = uuidv4();
    }
    setCallRoomId(sharedRoomId);
    const updatedRemotePeer = { ...callRequest, roomId: sharedRoomId };
    setRemotePeer(updatedRemotePeer);
    setInCall(true);
    setCallRequest(null);
  };

  const handleDeclineCall = () => {
    setCallRequest(null);
    // Optionally, send a decline signal to the caller.
  };

  const handleCallEnd = () => {
    setInCall(false);
    setRemotePeer(null);
    setCallRoomId(null);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Existing game and call logic */}
      <GameSpace onProximityChange={handleProximityChange} />

      {/* Chat toggle button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-5 left-5 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-600 focus:outline-none z-50"
      >
        {showChat ? "Hide Chat" : "Show Chat"}
      </button>

      {/* GlobalChat appears when showChat is true */}
      {showChat && <GlobalChat roomId={roomId} username={username} />}

      {/* Call prompt */}
      {callRequest && !inCall && (
        <CallPrompt
          callerName={callRequest.username || "Unknown Caller"}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Video call modal */}
      {inCall && remotePeer && callRoomId && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
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
