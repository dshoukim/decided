import assert from 'node:assert/strict'
import { getRoomChannelName } from '../src/lib/utils/realtime.ts'
assert.equal(getRoomChannelName('ABC123'), 'room-ABC123')
console.log('✅ realtime utils tests passed') 