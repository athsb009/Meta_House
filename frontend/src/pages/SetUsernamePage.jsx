// src/pages/SetUsernamePage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarSelector from '../components/AvatarSelector';

const SetUsernamePage = () => {
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [existingProfile, setExistingProfile] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // When the page loads, fetch the user's profile from the server.
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token'); // token stored at signup/login
        const res = await fetch('http://localhost:3001/users/profile', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          // If using cookie-based auth instead, uncomment:
          // credentials: 'include',
        });
        const data = await res.json();
        // Only set existingProfile if a username exists in the profile.
        if (data.success && data.profile && data.profile.username && data.profile.avatar) {
          setExistingProfile(data.profile);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        // Optionally handle errors (e.g., redirect to login if unauthorized)
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !avatar) {
      setError('Please enter a username and select an avatar.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        // If using cookies, uncomment:
        // credentials: 'include',
        body: JSON.stringify({ username, avatar }),
      });
      const data = await res.json();
      if (data.success) {
        setExistingProfile({ username, avatar });
        navigate('/lobby');
      } else {
        setError(data.message || 'Profile not available.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    }
  };

  const handleContinue = () => {
    navigate('/lobby');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-500 to-blue-500 p-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8">
        {existingProfile ? (
          <>
            <div className="flex flex-col items-center">
              <img
                src={existingProfile.avatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full mb-4"
              />
              <h2 className="text-2xl font-bold text-center mb-6">
                Welcome, {existingProfile.username}!
              </h2>
            </div>
            <button
              onClick={handleContinue}
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition"
            >
              Continue to Lobby
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center mb-6">Set Your Profile</h2>
            {error && <div className="mb-4 text-red-600">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Enter a unique username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <p className="mb-2">Select an Avatar:</p>
                <AvatarSelector selectedAvatar={avatar} onSelect={setAvatar} />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition"
              >
                Save Profile
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default SetUsernamePage;
