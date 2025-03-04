// GameSpace.jsx
import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import GameScene from "../components/GameScene";

const GameSpace = ({ onProximityChange }) => {
  const gameRef = useRef(null);
  const socketRef = useRef(null);
  const gameContainerRef = useRef(null);
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [numPlayers, setNumPlayers] = useState(0);
  const [profile, setProfile] = useState(null);

  // Logout: clear credentials and navigate to login.
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  // Leave room: notify server and navigate back to the lobby.
  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit("leaveGame", roomId);
      console.log(`Leaving room ${roomId}`);
    }
    navigate("/lobby");
    console.log("Navigating to lobby");
  };

  // Fetch profile from the server.
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

  // Get profile on mount.
  useEffect(() => {
    fetchProfile();
  }, []);

  // Initialize Phaser game and socket connection once all dependencies are ready.
  useEffect(() => {
    if (!profile || !roomId || !gameContainerRef.current) return;

    // Initialize socket connection.
    socketRef.current = io("http://localhost:3001/game");
    const socket = socketRef.current;
    socket.emit("joinGame", {
      roomId,
      username: profile.username,
    });
    socket.on("roomInfo", (data) => {
      if (data && typeof data.numPlayers === "number") {
        setNumPlayers(data.numPlayers);
      }
    });

    // Get container dimensions.
    const container = gameContainerRef.current;
    const canvasWidth = container.offsetWidth;
    const canvasHeight = container.offsetHeight;

    // Set up Phaser game with our custom GameScene.
    const config = {
      parent: container,
      type: Phaser.AUTO,
      width: canvasWidth,
      height: canvasHeight,
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scene: new GameScene({
        socket,
        username: profile.username,
        roomId,
        onProximityChange,
        width: canvasWidth,
        height: canvasHeight,
      }),
    };

    gameRef.current = new Phaser.Game(config);

    // Handle window resize.
    const handleResize = () => {
      if (gameRef.current && gameRef.current.scale && gameContainerRef.current) {
        const newWidth = gameContainerRef.current.offsetWidth;
        const newHeight = gameContainerRef.current.offsetHeight;
        gameRef.current.scale.resize(newWidth, newHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup on component unmount.
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [profile, roomId, onProximityChange, navigate]);

  return (
    <div className="relative w-full h-screen bg-gray-100">
      {/* Header with room info and controls */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-white shadow flex justify-between items-center z-10">
        <div>
          <p className="text-lg font-semibold">Room ID: {roomId}</p>
          <p className="text-sm text-gray-600">Players: {numPlayers}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleLeaveRoom}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Leave Room
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Canvas container that fills available space */}
      <div ref={gameContainerRef} className="w-full h-full pt-16" />
    </div>
  );
};

export default GameSpace;
