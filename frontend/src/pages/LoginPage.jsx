import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (!localStorage.getItem('username')) {
          navigate('/set-username');
        } else {
          navigate('/lobby');
        }
      } else {
        alert(data.error || 'Login failed!');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 flex items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8">
        <h2 className="text-3xl font-extrabold text-center text-blue-600 mb-6">Login</h2>
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
            Login
          </button>
        </form>
        <p className="text-center mt-4">
          Don’t have an account?{' '}
          <a href="/signup" className="text-blue-600 hover:text-blue-700 transition">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
