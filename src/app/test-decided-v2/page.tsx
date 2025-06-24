'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DecidedRoomV2 } from '@/components/decide-together/DecidedRoomV2';
import { Loader2 } from 'lucide-react';

export default function TestDecidedV2Page() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  const createRoom = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/decided/rooms', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create room');
      }
      
      const data = await response.json();
      setActiveRoom(data.roomCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsJoining(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/decided/rooms/${roomCode}/join`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join room');
      }
      
      setActiveRoom(roomCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsJoining(false);
    }
  };

  // If we have an active room, show the room component
  if (activeRoom) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveRoom(null)}
          className="absolute top-4 left-4 z-50"
        >
          Back to Lobby
        </Button>
        
        <DecidedRoomV2 roomCode={activeRoom} />
      </div>
    );
  }

  // Otherwise show the create/join interface
  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <Card className="max-w-lg w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Decided Together V2</h1>
          <p className="text-muted-foreground">
            Test the refactored server-driven tournament system
          </p>
        </div>

        <div className="space-y-6">
          {/* Create Room */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Create a New Room</h2>
            <Button
              onClick={createRoom}
              disabled={isCreating || isJoining}
              className="w-full"
              size="lg"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Room'
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Join Room */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Join Existing Room</h2>
            <div className="flex gap-2">
              <Input
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                disabled={isCreating || isJoining}
                className="font-mono"
                maxLength={6}
              />
              <Button
                onClick={joinRoom}
                disabled={isCreating || isJoining || !roomCode.trim()}
              >
                {isJoining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Join'
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Testing Instructions:</h3>
          <ol className="text-sm space-y-1 text-muted-foreground">
            <li>1. Create a room in one browser</li>
            <li>2. Copy the room code</li>
            <li>3. Open an incognito window and join with the code</li>
            <li>4. Start the tournament and test the flow</li>
          </ol>
        </div>
      </Card>
    </div>
  );
} 