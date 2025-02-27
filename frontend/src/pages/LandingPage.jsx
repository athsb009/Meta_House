import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const Navigate = useNavigate();
  const handleLogin = () => {
    Navigate('/login');
    console.log("Login button clicked");
  }
  const handleSignUp = () => {
    Navigate('/signup');
    console.log("Sign Up button clicked");
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Sign In / Sign Up Buttons */}
      <div className="absolute top-5 right-5 flex space-x-4 z-20">
        <button onClick={handleLogin} className="bg-white text-blue-600 px-4 py-2 rounded-lg shadow-md hover:bg-blue-100 transition">Sign In</button>
        <button onClick={handleSignUp} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition">Sign Up</button>
      </div>

      <motion.div
        className="absolute w-64 h-64 bg-blue-300 rounded-full opacity-50 blur-3xl top-10 left-20"
        animate={{ x: [0, 100, 0], y: [0, 100, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-96 h-96 bg-blue-400 rounded-full opacity-40 blur-3xl bottom-10 right-20"
        animate={{ x: [0, -100, 0], y: [0, -100, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="text-center z-10">
        <motion.h1
          className="text-5xl font-extrabold text-gray-800 mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Connect. Chat. Create.
        </motion.h1>
        <motion.p
          className="text-xl text-gray-600 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          Your next-gen video calling app with a playful twist.
        </motion.p>

        <motion.div className="flex space-x-4 justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }}>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg transition transform hover:scale-105">
            Get Started
          </button>
          <button className="border-2 border-blue-600 text-blue-600 hover:bg-blue-100 px-6 py-3 rounded-xl transition transform hover:scale-105">
            Learn More
          </button>
        </motion.div>
      </div>

      <motion.div className="absolute bottom-5 right-5 text-blue-600" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
        <Sparkles size={32} />
      </motion.div>
    </div>
  );
}
