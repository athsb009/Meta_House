// GameSpace.jsx
import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";

const GameSpace = ({ onProximityChange }) => {
  const gameRef = useRef(null);
  const socketRef = useRef(null);
  const gameContainerRef = useRef(null); // Ref for the canvas container.
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [numPlayers, setNumPlayers] = useState(0);
  const [profile, setProfile] = useState(null);

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

  // Fetch profile on mount.
  useEffect(() => {
    fetchProfile();
  }, []);

  // Initialize Phaser and socket only when profile, roomId, and container ref are available.
  useEffect(() => {
    if (!profile || !roomId || !gameContainerRef.current) return;

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

    const username = profile.username;
    const container = gameContainerRef.current;
    // Get container dimensions for full-screen.
    const canvasWidth = container.offsetWidth;
    const canvasHeight = container.offsetHeight;

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
          this.load.atlas("king", "../assets/king.png", "../assets/king_atlas.json");
          this.load.animation("king_anim", "../assets/king_anim.json");
        },
        create: function () {
          const gridWidth = this.sys.game.config.width;
          const gridHeight = this.sys.game.config.height;
          this.add
            .grid(gridWidth / 2, gridHeight / 2, gridWidth, gridHeight, 50, 50, 0x222222, 0x888888, 0.3)
            .setDepth(-1);

          // Create local player sprite and name tag.
          this.player = this.physics.add.sprite(gridWidth / 2, gridHeight / 2, "king", "king_idle_1");
          this.player.setScale(2);
          this.player.setCollideWorldBounds(true);
          this.playerName = this.add
            .text(gridWidth / 2, gridHeight / 2 - 25, username, {
              fontSize: "16px",
              fill: "#ffffff",
              backgroundColor: "#000000",
              padding: { x: 5, y: 2 },
            })
            .setOrigin(0.5, 1);

          this.cursors = this.input.keyboard.createCursorKeys();
          this.otherPlayers = this.physics.add.group();
          this.lastEmitTime = 0;

          // Remote player movement update.
          socket.on("playerMoved", (data) => {
            let otherPlayer = this.otherPlayers.getChildren().find(
              (player) => player.id === data.id
            );
            if (!otherPlayer) {
              otherPlayer = this.physics.add.sprite(data.x, data.y, "king", "king_idle_1");
              otherPlayer.setScale(2);
              otherPlayer.setCollideWorldBounds(true);
              otherPlayer.setImmovable(true);
              otherPlayer.id = data.id;
              this.otherPlayers.add(otherPlayer);
              otherPlayer.nameTag = this.add
                .text(data.x, data.y - 25, data.username, {
                  fontSize: "16px",
                  fill: "#ffffff",
                  backgroundColor: "#000000",
                  padding: { x: 5, y: 2 },
                })
                .setOrigin(0.5, 1);
            } else {
              otherPlayer.setPosition(data.x, data.y);
              if (otherPlayer.nameTag) {
                otherPlayer.nameTag
                  .setPosition(data.x, data.y - 25)
                  .setText(data.username);
              }
            }
          });

          socket.on("userConnected", (user) => {
            const exists = this.otherPlayers.getChildren().some((p) => p.id === user.id);
            if (!exists) {
              const otherPlayer = this.physics.add.sprite(user.x, user.y, "king", "king_idle_1");
              otherPlayer.setScale(2);
              otherPlayer.setCollideWorldBounds(true);
              otherPlayer.setImmovable(true);
              otherPlayer.id = user.id;
              
              this.otherPlayers.add(otherPlayer);
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

          socket.on("userDisconnected", (id) => {
            const otherPlayer = this.otherPlayers.getChildren().find(
              (player) => player.id === id
            );
            if (otherPlayer) {
              if (otherPlayer.nameTag) {
                otherPlayer.nameTag.destroy();
              }
              otherPlayer.destroy();
            }
          });

          // Initialize current call target.
          this.currentCallTarget = null;
        },
        update: function (time) {
          const speed = 200;
          this.player.body.setVelocity(0);
          let moving = false;

          if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-speed);
            moving = true;
          } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(speed);
            moving = true;
          }
          if (this.cursors.up.isDown) {
            this.player.body.setVelocityY(-speed);
            moving = true;
          } else if (this.cursors.down.isDown) {
            this.player.body.setVelocityY(speed);
            moving = true;
          }

          this.player.anims.play(
            this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0
              ? "king_walk"
              : "king_idle",
            true
          );

          if (time - this.lastEmitTime > 100) {
            socket.emit("move", {
              x: this.player.x,
              y: this.player.y,
              username,
            });
            this.lastEmitTime = time;
          }

          this.playerName.setPosition(this.player.x, this.player.y - 25);

          // Proximity detection.
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

    // Handle window resize to adjust canvas dimensions.
    const handleResize = () => {
      if (gameRef.current && gameRef.current.scale && gameContainerRef.current) {
        const newWidth = gameContainerRef.current.offsetWidth;
        const newHeight = gameContainerRef.current.offsetHeight;
        gameRef.current.scale.resize(newWidth, newHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup on unmount.
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
