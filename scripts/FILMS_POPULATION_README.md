# Films Population Script

This script populates the `films` table with comprehensive movie data from The Movie Database (TMDB) API.

## Prerequisites

1. **TMDB API Credentials**: Set one of these environment variables in your `.env.local`:
   - `NEXT_PUBLIC_TMDB_ACCESS_TOKEN` (preferred - Bearer token)
   - `NEXT_PUBLIC_TMDB_API_KEY` (fallback - API key)

2. **Database Connection**: Ensure `DATABASE_URL` is set in your `.env.local`

## Usage

### Basic Commands

```bash
# By TMDB IDs
npm run populate-films -- 550 13 680 27205

# By movie titles
npm run populate-films -- "Fight Club" "Forrest Gump" "Pulp Fiction"

# Mixed identifiers
npm run populate-films -- 550 "The Dark Knight" 13 "Inception"

# From a JSON file
npm run populate-films -- --file scripts/example-movie-ids.json
```

### Advanced Options

```bash
# Custom batch size and delay (for API rate limiting)
npm run populate-films -- --batch-size 3 --delay 2000 550 13 680

# Help
npm run populate-films
```

## Features

### Data Collection
- **Basic Info**: Title, overview, tagline, release date, runtime
- **Ratings**: Vote average, vote count, popularity
- **Classification**: Genres, production companies, countries, keywords
- **Media**: Poster and backdrop image paths, **trailer links (YouTube videos)**
- **Financial**: Budget and revenue data
- **Metadata**: IMDB ID, original language, spoken languages

### Smart Processing
- **Duplicate Prevention**: Uses TMDB ID as unique constraint
- **Upsert Logic**: Updates existing movies with latest data
- **Error Handling**: Continues processing even if some movies fail
- **Rate Limiting**: Configurable batch size and delays
- **Progress Tracking**: Real-time status updates

### Data Transformation
- Vote averages stored as integers (7.5 → 75)
- Popularity stored as integers with precision (8.642 → 8642)
- Arrays for genres, companies, countries, keywords
- Automatic timestamp management

## File Format

JSON files should contain an array of TMDB IDs or movie titles:

```json
[
  550,
  "Fight Club",
  13,
  "Forrest Gump",
  680
]
```

## Rate Limiting

TMDB API has rate limits:
- **Free Tier**: 40 requests per 10 seconds
- **Default Settings**: 5 movies per batch, 1 second delay
- **Recommendation**: Use `--batch-size 3 --delay 2000` for safety

## Common Movie IDs

Here are some popular TMDB IDs for testing:

| ID | Title |
|----|-------|
| 550 | Fight Club |
| 13 | Forrest Gump |
| 680 | Pulp Fiction |
| 155 | The Dark Knight |
| 278 | The Shawshank Redemption |
| 238 | The Godfather |
| 122 | The Lord of the Rings: The Return of the King |
| 27205 | Inception |
| 389 | 12 Angry Men |
| 129 | Spirited Away |

## Error Handling

The script handles various error conditions:
- **Movie Not Found**: Logs warning and continues
- **API Rate Limits**: Respects batch size and delays
- **Network Issues**: Retries and error reporting
- **Database Errors**: Detailed error messages
- **Invalid Data**: Graceful fallbacks

## Output

The script provides detailed feedback:
- ✅ Successful insertions with movie titles
- ⚠️ Warnings for missing data
- ❌ Error details for failures
- 📈 Summary statistics

## Integration

The script can also be used programmatically:

```typescript
import { populateFilms } from './scripts/populate-films-from-tmdb'

const results = await populateFilms([550, 13, 680], {
  batchSize: 5,
  delayMs: 1000
})

console.log(`Successfully processed: ${results.successful}/${results.total}`)
```

## Best Practices

1. **Start Small**: Test with a few movies first
2. **Use Batching**: Don't overwhelm the API
3. **Monitor Logs**: Watch for rate limit warnings
4. **Check Results**: Verify data in your database
5. **Handle Failures**: Review error logs for missing movies

## Troubleshooting

### Common Issues

**"TMDB API credentials are required"**
- Set `NEXT_PUBLIC_TMDB_ACCESS_TOKEN` in `.env.local`

**"DATABASE_URL environment variable is not set"**
- Check your `.env.local` file

**"Movie not found: TMDB ID XXX"**
- Verify the TMDB ID exists on themoviedb.org

**Rate limit errors**
- Increase `--delay` or decrease `--batch-size`

### Debugging

Enable detailed logging by checking the console output for:
- Database connection details
- API request/response information
- Processing status for each movie 