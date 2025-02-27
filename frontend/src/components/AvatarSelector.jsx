// src/components/AvatarSelector.jsx
import React from 'react';

const avatarOptions = [
  { id: 'avatar1', url: '/avatars/avatar1.png' },
  { id: 'avatar2', url: '/avatars/avatar2.png' },
  { id: 'avatar3', url: '/avatars/avatar3.png' },
  // Add more options as needed
];

const AvatarSelector = ({ selectedAvatar, onSelect }) => {
  return (
    <div className="flex gap-4">
      {avatarOptions.map((avatar) => (
        <div
          key={avatar.id}
          className={`cursor-pointer border-2 rounded-full p-1 transition ${
            selectedAvatar === avatar.url ? 'border-indigo-600' : 'border-transparent'
          }`}
          onClick={() => onSelect(avatar.url)}
        >
          <img src={avatar.url} alt={avatar.id} className="w-16 h-16 rounded-full object-cover" />
        </div>
      ))}
    </div>
  );
};

export default AvatarSelector;
