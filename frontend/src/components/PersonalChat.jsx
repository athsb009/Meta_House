// PersonalChat.jsx
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const PersonalChat = ({ roomId, username, peerName, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    // Connect to personal chat room
    socketRef.current = io("http://localhost:3001/chat");
    socketRef.current.emit("joinChat", { roomId, username });
    socketRef.current.on("chatMessage", (message) => {
      setMessages((prev) => [...prev, message]);
    });
    return () => socketRef.current.disconnect();
  }, [roomId, username]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const message = {
      username,
      text: input,
      timestamp: new Date().toISOString(),
    };
    socketRef.current.emit("chatMessage", { roomId, message });
    setMessages((prev) => [...prev, message]);
    setInput("");
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 50,
        left: 50,
        width: "300px",
        height: "300px",
        border: "1px solid #ccc",
        backgroundColor: "#fff",
        padding: "10px",
        zIndex: 10000,
      }}
    >
      <h3>Chat with {peerName}</h3>
      <div style={{ overflowY: "scroll", height: "200px", marginBottom: "10px" }}>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.username}: </strong>
            {msg.text}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        style={{ width: "100%" }}
      />
      <button onClick={sendMessage} style={{ marginTop: "5px" }}>
        Send
      </button>
      <button onClick={onClose} style={{ marginTop: "5px" }}>
        Close
      </button>
    </div>
  );
};

export default PersonalChat;
