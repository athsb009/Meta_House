import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const GlobalChat = ({ roomId, username }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const socketRef = useRef(null);

  // Use the provided username, or fetch it from localStorage, or default to "Guest"
  const effectiveUsername = username || localStorage.getItem("username") || "Guest";

  useEffect(() => {
    socketRef.current = io("http://localhost:3001/chat");
    // Emit joinChat only if we have a valid username
    socketRef.current.emit("joinChat", { roomId, username: effectiveUsername });
    socketRef.current.on("chatMessage", (message) => {
      setMessages((prev) => [...prev, message]);
    });
    return () => socketRef.current.disconnect();
  }, [roomId, effectiveUsername]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const message = {
      username: effectiveUsername,
      text: input,
      timestamp: new Date().toISOString(),
    };
    socketRef.current.emit("chatMessage", { roomId, message });
    setMessages((prev) => [...prev, message]);
    setInput("");
  };

  return (
    <div className="fixed bottom-5 right-5 w-80 h-96 bg-white rounded-lg shadow-lg flex flex-col overflow-hidden z-50">
      <div className="bg-green-500 text-white text-center text-lg font-bold p-3">
        Global Chat
      </div>
      <div className="flex-1 p-3 overflow-y-auto bg-gray-50">
        {messages.map((msg, index) => (
          <div key={index} className="mb-2">
            <strong>{msg.username}: </strong>
            <span>{msg.text}</span>
          </div>
        ))}
      </div>
      <div className="flex border-t border-gray-200">
        <input
          type="text"
          value={input}
          placeholder="Type your message..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 p-2 outline-none"
        />
        <button
          onClick={sendMessage}
          className="bg-green-500 text-white px-4 py-2"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default GlobalChat;
