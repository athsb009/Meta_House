import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Send signup data to the server
      const res = await fetch('http://localhost:3001/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (data.token) {
        // Save the token and navigate to the Set Username page
        localStorage.setItem('token', data.token);
        navigate('/set-username');
      } else {
        alert(data.error || 'Signup failed!');
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('An error occurred during signup.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 flex items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8">
        <h2 className="text-3xl font-extrabold text-center text-blue-600 mb-6">Sign Up</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition transform hover:scale-105"
          >
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}
