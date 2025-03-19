// GameSpace.jsx
import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";

const GameSpace = ({ onProximityChange }) => {
  const gameRef = useRef(null);
  const socketRef = useRef(null);
  const gameContainerRef = useRef(null);
  const navigate = useNavigate();
  const { roomId } = useParams();

  // Track room info
  const [numPlayers, setNumPlayers] = useState(0);
  const [playersInRoom, setPlayersInRoom] = useState([]);
  const [profile, setProfile] = useState(null);

  // For in-game chat
 

  // -------------------
  //    HANDLERS
  // -------------------
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit("leaveGame", roomId);
      console.log(`Leaving room ${roomId}`);
    }
    navigate("/lobby");
    console.log("Navigating to lobby");
  };

  
  // -------------------
  //   DATA FETCH
  // -------------------
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

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  // -------------------------
  //  SOCKET & PHASER SETUP
  // -------------------------
  useEffect(() => {
    // Only start if we have a profile & roomId & container
    if (!profile || !roomId || !gameContainerRef.current) return;

    // Initialize Socket
    socketRef.current = io("http://localhost:3001/game");
    const socket = socketRef.current;

    // Join game room
    socket.emit("joinGame", { roomId, username: profile.username });

    // Listen for room updates (e.g., number of players, player list)
    socket.on("roomInfo", (data) => {
      if (data && typeof data.numPlayers === "number") {
        setNumPlayers(data.numPlayers);
      }
      // If your server sends `players` array in roomInfo:
      if (Array.isArray(data.players)) {
        setPlayersInRoom(data.players);
      }
    });

  

    // Create Phaser Game
    const container = gameContainerRef.current;
    const canvasWidth = container.offsetWidth;
    const canvasHeight = container.offsetHeight;
    const username = profile.username;

    const config = {
      parent: container,
      type: Phaser.AUTO,
      width: canvasWidth,
      height: canvasHeight,
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scene: {
        preload: function () {
          // Load assets
          // this.load.atlas("king", "../assets/king.png", "../assets/king_atlas.json");
          // this.load.animation("king_anim", "../assets/king_anim.json");
          this.load.atlas("adam", "/assets/adam.png", "/assets/adam_atlas.json");

        },
        create: function () {
          // Draw a background grid
          const gridWidth = this.sys.game.config.width;
          const gridHeight = this.sys.game.config.height;
          this.add
            .grid(
              gridWidth / 2,
              gridHeight / 2,
              gridWidth,
              gridHeight,
              50,
              50,
              0xffffff,
              0x888888,
              0.3
            )
            .setDepth(-1);

          // Create local player sprite
          this.player = this.physics.add.sprite(
            gridWidth / 2,
            gridHeight / 2,
            "adam",
            "adam_idle_16x16_down"
          );
          this.player.setScale(2);
          this.player.setCollideWorldBounds(true);

          // Player name tag
          this.playerName = this.add
            .text(this.player.x, this.player.y - 25, username, {
              fontSize: "16px",
              fill: "#ffffff",
              backgroundColor: "#000000",
              padding: { x: 5, y: 2 },
            })
            .setOrigin(0.5, 1);

          // Input controls
          this.cursors = this.input.keyboard.createCursorKeys();

          // Group for other players
          this.otherPlayers = this.physics.add.group();
          this.lastEmitTime = 0;

          // Listen for remote player movement
          socket.on("playerMoved", (data) => {
            let otherPlayer = this.otherPlayers.getChildren().find((p) => p.id === data.id);
            if (!otherPlayer) {
              // Create sprite for new remote player, setting frame based on direction
              otherPlayer = this.physics.add.sprite(data.x, data.y, "adam", `adam_idle_16x16_${data.direction || "down"}`);
              otherPlayer.setScale(2);
              otherPlayer.setCollideWorldBounds(true);
              otherPlayer.setImmovable(true);
              otherPlayer.id = data.id;
              this.otherPlayers.add(otherPlayer);
          
              // Create remote player's name tag
              otherPlayer.nameTag = this.add
                .text(data.x, data.y - 25, data.username, {
                  fontSize: "16px",
                  fill: "#ffffff",
                  backgroundColor: "#000000",
                  padding: { x: 5, y: 2 },
                })
                .setOrigin(0.5, 1);
            } else {
              // Update position and frame if movement includes a direction.
              otherPlayer.setPosition(data.x, data.y);
              if (data.direction) {
                otherPlayer.setFrame(`adam_idle_16x16_${data.direction}`);
              }
              // Update name tag position and text
              if (otherPlayer.nameTag) {
                otherPlayer.nameTag
                  .setPosition(data.x, data.y - 25)
                  .setText(data.username);
              }
            }
          });
          // When a new user connects
          socket.on("userConnected", (user) => {
            const exists = this.otherPlayers
              .getChildren()
              .some((p) => p.id === user.id);
            if (!exists) {
              const otherPlayer = this.physics.add.sprite(
                user.x,
                user.y,
                "adam",
                "adam_idle_16x16_down"
              );
              otherPlayer.setScale(2);
              otherPlayer.setCollideWorldBounds(true);
              otherPlayer.setImmovable(true);
              otherPlayer.id = user.id;
              this.otherPlayers.add(otherPlayer);

              // Create name tag
              otherPlayer.nameTag = this.add
                .text(user.x, user.y - 25, user.username, {
                  fontSize: "16px",
                  fill: "#ffffff",
                  backgroundColor: "#000000",
                  padding: { x: 5, y: 2 },
                })
                .setOrigin(0.5, 1);
            }
          });

          // When a user disconnects
          socket.on("userDisconnected", (id) => {
            const otherPlayer = this.otherPlayers
              .getChildren()
              .find((p) => p.id === id);
            if (otherPlayer) {
              if (otherPlayer.nameTag) {
                otherPlayer.nameTag.destroy();
              }
              otherPlayer.destroy();
            }
          });

          // Track which player is currently within proximity
          this.currentCallTarget = null;
        },
        update: function (time) {
          const speed = 200;
          this.player.body.setVelocity(0);
          let direction = null;
        
          // Check horizontal movement
          if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-speed);
            direction = "left";
          } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(speed);
            direction = "right";
          }
        
          // Check vertical movement
          if (this.cursors.up.isDown) {
            this.player.body.setVelocityY(-speed);
            direction = "up";
          } else if (this.cursors.down.isDown) {
            this.player.body.setVelocityY(speed);
            direction = "down";
          }
        
          // If a direction is detected, update lastDirection
          if (direction) {
            this.lastDirection = direction;
          } else {
            // No new input; retain the last direction
            direction = this.lastDirection || "down";
          }
        
          // Set the sprite's frame based on the current or last known direction
          this.player.setFrame(`adam_idle_16x16_${direction}`);
        
          // Update player name tag position
          this.playerName.setPosition(this.player.x, this.player.y - 25);
        
          // Emit movement data to the server with the correct direction
          if (time - this.lastEmitTime > 0) {
            socket.emit("move", {
              x: this.player.x,
              y: this.player.y,
              username: username,
              direction: direction, // This will be the last known direction if idle
            });
            this.lastEmitTime = time;
          }
          // Proximity detection
          const proximityThreshold = 100;
          let closestPlayer = null;
          let minDistance = Infinity;
          this.otherPlayers.getChildren().forEach((otherPlayer) => {
            const distance = Phaser.Math.Distance.Between(
              this.player.x,
              this.player.y,
              otherPlayer.x,
              otherPlayer.y
            );
            if (distance < proximityThreshold && distance < minDistance) {
              minDistance = distance;
              closestPlayer = otherPlayer;
            }
          });

          if (closestPlayer) {
            this.player.setTint(0xffff00);
            // If newly in proximity, notify parent
            if (!this.currentCallTarget || this.currentCallTarget.id !== closestPlayer.id) {
              this.currentCallTarget = {
                id: closestPlayer.id,
                username: closestPlayer.nameTag.text,
                roomId,
              };
              if (typeof onProximityChange === "function") {
                onProximityChange(true, this.currentCallTarget);
              }
            }
          } else {
            this.player.clearTint();
            // If no longer in proximity, notify parent
            if (this.currentCallTarget) {
              this.currentCallTarget = null;
              if (typeof onProximityChange === "function") {
                onProximityChange(false, null);
              }
            }
          }
        },
      },
    };

    gameRef.current = new Phaser.Game(config);

    // Handle window resizing
    const handleResize = () => {
      if (gameRef.current && gameRef.current.scale && gameContainerRef.current) {
        const newWidth = gameContainerRef.current.offsetWidth;
        const newHeight = gameContainerRef.current.offsetHeight;
        gameRef.current.scale.resize(newWidth, newHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup on unmount
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

  // -------------------
  //     RENDER
  // -------------------
  return (
    <div className="relative w-full h-screen bg-gray-100">
      {/* Header / Controls */}
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

      {/* Canvas container for the Phaser game */}
      <div ref={gameContainerRef} className="w-full h-full pt-16" />

      {/* Player List on the right (if server sends a list of current players) */}
     

    </div>
  );
};

export default GameSpace;
