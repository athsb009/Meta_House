import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, LogOut, Search } from 'lucide-react';

const LobbyPage = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState([]);
  const [profile, setProfile] = useState(null);

  // Fetch rooms created by the current user
  const fetchMyRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/rooms/my-rooms', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  // Fetch the user's profile (avatar and username)
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/users/profile', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        // Uncomment if using cookie-based auth:
        // credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.profile && data.profile.username) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    fetchMyRooms();
    fetchProfile();
  }, []);

  const handleJoinRoom = () => {
    if (roomId.trim() !== '') {
      navigate(`/room/${roomId}`);
    }
  };

  const handleCreateRoom = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.roomId) {
        navigate(`/room/${data.roomId}`);
      } else {
        alert('Room creation failed!');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('An error occurred while creating the room.');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-xl p-6 flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-blue-600">Lobby</h2>
        <div className="flex items-center space-x-4">
          {profile && (
            <img
              src={profile.avatar}
              alt="Avatar"
              className="w-10 h-10 rounded-full"
            />
          )}
          <span className="text-lg font-medium text-gray-700">
            Hello, {profile?.username || 'User'}!
          </span>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center transition"
          >
            <LogOut className="mr-2" /> Logout
          </button>
        </div>
      </div>

      {/* Room Actions */}
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-xl p-6 mb-8 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-grow items-center border border-gray-300 rounded-lg px-4 py-2">
          <Search className="text-blue-500 mr-2" />
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full focus:outline-none text-gray-700"
          />
        </div>
        <button
          onClick={handleJoinRoom}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition transform hover:scale-105"
        >
          Join Room
        </button>
        <button
          onClick={handleCreateRoom}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition transform hover:scale-105 flex items-center"
        >
          <PlusCircle className="mr-2" /> Create Room
        </button>
      </div>

      {/* My Rooms */}
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-xl p-6">
        <h3 className="text-2xl font-semibold text-blue-600 mb-4">My Rooms</h3>
        {rooms.length === 0 ? (
          <p className="text-gray-600">No rooms created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <div
                key={room._id}
                className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/room/${room.roomId}`)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-blue-700 text-lg">
                    Room ID: {room.roomId}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(room.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-600">Click to join this room.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LobbyPage;
