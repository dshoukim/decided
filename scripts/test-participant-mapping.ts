// Simple test script to validate participant mapping utility
// Run with:  npm run test

import assert from 'node:assert/strict'
// eslint-disable-next-line import/extensions
import { mapApiParticipantsToStore } from '../src/lib/utils/participants.ts'

// Mock API participants
const apiParticipants = [
  {
    userId: 'user-1',
    joinedAt: '2024-05-01T10:00:00Z',
    leftAt: null,
    isActive: true,
    user: {
      name: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
  },
  {
    userId: 'user-2',
    joinedAt: '2024-05-01T10:05:00Z',
    leftAt: '2024-05-01T10:10:00Z',
    isActive: false,
    user: {
      username: 'jane',
    },
  },
]

const expected = [
  {
    userId: 'user-1',
    userName: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
    joinedAt: '2024-05-01T10:00:00Z',
    isActive: true,
  },
  {
    userId: 'user-2',
    userName: 'jane',
    avatarUrl: undefined,
    joinedAt: '2024-05-01T10:05:00Z',
    isActive: false,
  },
]

const result = mapApiParticipantsToStore(apiParticipants as any)
assert.deepEqual(result, expected)

console.log('✅ participant mapping utility passed all tests') 