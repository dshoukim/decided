'use client';

import { useState } from 'react';
import { useRoom } from '@/lib/hooks/useRoom';
import { useTournament } from '@/lib/hooks/useTournament';

export default function TestTournamentUI() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [userId] = useState('add99a2e-48b0-475a-be64-db69980b1bc7'); // Test user ID
  
  const {
    room,
    participants,
    connectionStatus,
    error: roomError,
    isLoading: roomLoading,
    activeParticipants,
    isOwner,
    canStart,
    joinRoom,
    startTournament,
  } = useRoom(roomCode);

  const {
    tournament,
    currentMatch,
    currentRound,
    totalRounds,
    status: tournamentStatus,
    isLoading: tournamentLoading,
    error: tournamentError,
    userProgress,
    partnerProgress,
  } = useTournament(roomCode);

  const createTestRoom = async () => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoomCode(data.room.code);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Tournament Test UI</h1>
      
      {/* Room Creation */}
      {!roomCode && (
        <div className="mb-8">
          <button
            onClick={createTestRoom}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Test Room
          </button>
        </div>
      )}

      {roomCode && (
        <div className="space-y-6">
          {/* Room Info */}
          <div className="p-4 border rounded">
            <h2 className="text-xl font-semibold mb-2">Room: {roomCode}</h2>
            <p>Status: {room?.status || 'Loading...'}</p>
            <p>Connection: {connectionStatus}</p>
            <p>Participants: {activeParticipants?.length || 0}/2</p>
            <p>Is Owner: {isOwner ? 'Yes' : 'No'}</p>
            <p>Can Start: {canStart ? 'Yes' : 'No'}</p>
            
            {roomError && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700">
                Room Error: {roomError}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={joinRoom}
              disabled={roomLoading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {roomLoading ? 'Joining...' : 'Join Room'}
            </button>
            
            {canStart && (
              <button
                onClick={startTournament}
                disabled={roomLoading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
              >
                {roomLoading ? 'Starting...' : 'Start Tournament'}
              </button>
            )}
          </div>

          {/* Participants */}
          <div className="p-4 border rounded">
            <h3 className="text-lg font-semibold mb-2">Participants</h3>
            {participants?.map((participant) => (
              <div key={participant.userId} className="flex justify-between">
                <span>{participant.userName || participant.userId}</span>
                <span className={participant.isActive ? 'text-green-600' : 'text-gray-400'}>
                  {participant.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>

          {/* Tournament Info */}
          {tournament && (
            <div className="p-4 border rounded">
              <h3 className="text-lg font-semibold mb-2">Tournament</h3>
              <p>Status: {tournamentStatus}</p>
              <p>Round: {currentRound}/{totalRounds}</p>
              <p>Total Matches: {tournament.matches?.length || 0}</p>
              
              {tournamentError && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700">
                  Tournament Error: {tournamentError}
                </div>
              )}
              
              {currentMatch && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <h4 className="font-semibold">Current Match</h4>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-center">
                      <p className="font-medium">{currentMatch.movieA.title}</p>
                      <p className="text-sm text-gray-600">vs</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{currentMatch.movieB.title}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium">Your Progress</h5>
                  <p>{userProgress?.completedPicks || 0}/{userProgress?.totalPicks || 0} picks</p>
                </div>
                <div>
                  <h5 className="font-medium">Partner Progress</h5>
                  <p>{partnerProgress?.completedPicks || 0}/{partnerProgress?.totalPicks || 0} picks</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug Info */}
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Info</h3>
        <p>Room Code: {roomCode || 'None'}</p>
        <p>Room Loading: {roomLoading ? 'Yes' : 'No'}</p>
        <p>Tournament Loading: {tournamentLoading ? 'Yes' : 'No'}</p>
        <p>Render Count: {Math.random().toString(36).substr(2, 5)} (should be stable)</p>
      </div>
    </div>
  );
} 