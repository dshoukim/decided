import assert from 'node:assert/strict'
import { getMissingProfileFields } from '../src/lib/utils/profile.ts'

// Test 1: complete profile
const completeUser = {
  name: 'Test User',
  selectedGenres: ['Action'],
  streamingServices: ['netflix']
}
assert.deepEqual(getMissingProfileFields(completeUser), [], 'Expected no missing fields')

// Test 2: missing name
const noNameUser = {
  selectedGenres: ['Action'],
  streamingServices: ['netflix']
}
assert.deepEqual(getMissingProfileFields(noNameUser), ['name'], 'Expected missing name')

// Test 3: missing genres and services
const noPrefsUser = {
  name: 'User'
}
assert.deepEqual(
  getMissingProfileFields(noPrefsUser),
  ['genre preferences', 'streaming services'],
  'Expected missing genre preferences and streaming services'
)

console.log('✅ profile utils tests passed') 