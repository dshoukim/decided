#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Convert the films text file into a JSON array for TMDB population
 */
function convertFilmsList() {
  try {
    // Read the films file
    const filmsPath = resolve(__dirname, '../src/films')
    const filmsContent = readFileSync(filmsPath, 'utf-8')
    
    // Split by lines and filter out empty lines
    const lines = filmsContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    // Clean up the movie titles - remove year suffixes in parentheses
    const movieTitles = lines.map(line => {
      // Remove year in parentheses (e.g. "(1963)") and any extra whitespace
      return line.trim().replace(/\s*\(\d{4}\)\s*$/, '').trim()
    })
    
    // Remove duplicates (if any)
    const uniqueMovies = [...new Set(movieTitles)]
    
    console.log(`📋 Processed ${lines.length} lines`)
    console.log(`🎬 Found ${uniqueMovies.length} unique movie titles`)
    console.log(`📦 Sample entries:`)
    uniqueMovies.slice(0, 5).forEach((title, idx) => {
      console.log(`   ${idx + 1}. ${title}`)
    })
    
    // Write to JSON file
    const outputPath = resolve(__dirname, 'films-list.json')
    writeFileSync(outputPath, JSON.stringify(uniqueMovies, null, 2))
    
    console.log(`\n✅ Successfully created ${outputPath}`)
    console.log(`\n🚀 To populate all films, run:`)
    console.log(`   npm run populate-films -- --file ./scripts/films-list.json`)
    console.log(`\n💡 For testing with a smaller batch:`)
    console.log(`   npm run populate-films -- --file ./scripts/films-list.json --batch-size 2 --delay 3000`)
    
    return uniqueMovies
    
  } catch (error: any) {
    console.error('❌ Error processing films list:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  convertFilmsList()
}

export { convertFilmsList } 