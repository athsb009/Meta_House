// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import SetUsernamePage from "./pages/SetUsernamePage";
import LobbyPage from "./pages/LobbyPage";
import VideoApp from "./pages/VideoApp";
import { ThemeProvider } from "./context/ThemeContext";
import ParentComponent from "./pages/ParentComponent";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/set-username" element={<SetUsernamePage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/room/:roomId" element={<ParentComponent />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
