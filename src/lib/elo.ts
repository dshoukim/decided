// ELO Rating System for Movie Preferences
// Used for tournament-style movie comparisons in Decided feature
// See: https://en.wikipedia.org/wiki/Elo_rating_system

const K = 32; // Elo rating factor

export interface EloUpdate {
  userId: string;
  movieId: number;
  newRating: number;
  won: boolean;
  opponent?: {
    userId: string;
    movieId: number;
    oldRating: number;
  };
}

export interface EloMatch {
  winnerMovieId: number;
  winnerUserId: string;
  winnerOldRating: number;
  loserMovieId: number;
  loserUserId: string;
  loserOldRating: number;
}

/**
 * Calculate new ELO ratings for a movie comparison
 * 
 * @param winnerRating Current ELO rating of winning movie
 * @param loserRating Current ELO rating of losing movie
 * @param kFactor K-factor for rating volatility (default: 32)
 * @returns Object with new ratings for winner and loser
 */
export function calculateEloChange(
  winnerRating: number,
  loserRating: number,
  kFactor: number = 32
): { winnerNewRating: number; loserNewRating: number } {
  // Calculate expected scores
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  // Calculate new ratings
  const winnerNewRating = Math.round(winnerRating + kFactor * (1 - expectedWinner));
  const loserNewRating = Math.round(loserRating + kFactor * (0 - expectedLoser));

  return {
    winnerNewRating,
    loserNewRating,
  };
}

/**
 * Process a single ELO match and return updates for both movies
 * 
 * @param match Match details with winner and loser info
 * @param kFactor K-factor for rating volatility
 * @returns Array of ELO updates to apply to database
 */
export function processEloMatch(match: EloMatch, kFactor: number = 32): EloUpdate[] {
  const { winnerNewRating, loserNewRating } = calculateEloChange(
    match.winnerOldRating,
    match.loserOldRating,
    kFactor
  );

  return [
    {
      userId: match.winnerUserId,
      movieId: match.winnerMovieId,
      newRating: winnerNewRating,
      won: true,
      opponent: {
        userId: match.loserUserId,
        movieId: match.loserMovieId,
        oldRating: match.loserOldRating,
      },
    },
    {
      userId: match.loserUserId,
      movieId: match.loserMovieId,
      newRating: loserNewRating,
      won: false,
      opponent: {
        userId: match.winnerUserId,
        movieId: match.winnerMovieId,
        oldRating: match.winnerOldRating,
      },
    },
  ];
}

/**
 * Process multiple ELO matches in batch
 * 
 * @param matches Array of matches to process
 * @param kFactor K-factor for rating volatility
 * @returns Array of all ELO updates to apply
 */
export function processBatchEloMatches(matches: EloMatch[], kFactor: number = 32): EloUpdate[] {
  return matches.flatMap(match => processEloMatch(match, kFactor));
}

/**
 * Get initial ELO rating for new movies
 * 
 * @returns Default ELO rating for new entries
 */
export function getInitialEloRating(): number {
  return 1200;
}

/**
 * Calculate K-factor based on number of matches played
 * More volatile ratings for new movies, more stable for established ones
 * 
 * @param matchesPlayed Number of matches this movie has been in
 * @returns Appropriate K-factor
 */
export function calculateKFactor(matchesPlayed: number): number {
  if (matchesPlayed < 10) return 40; // High volatility for new movies
  if (matchesPlayed < 25) return 32; // Medium volatility
  return 24; // Lower volatility for established movies
}

/**
 * Update ELO ratings for a tournament bracket pick
 * Helper function specifically for the tournament system
 * 
 * @param userId User making the pick
 * @param selectedMovieId Movie that was chosen (winner)
 * @param rejectedMovieId Movie that was not chosen (loser)
 * @param selectedMovieRating Current ELO rating of selected movie
 * @param rejectedMovieRating Current ELO rating of rejected movie
 * @returns ELO updates to apply
 */
export function updateElo(
  userId: string,
  selectedMovieId: number,
  rejectedMovieId: number,
  selectedMovieRating: number = getInitialEloRating(),
  rejectedMovieRating: number = getInitialEloRating()
): EloUpdate[] {
  const match: EloMatch = {
    winnerMovieId: selectedMovieId,
    winnerUserId: userId,
    winnerOldRating: selectedMovieRating,
    loserMovieId: rejectedMovieId,
    loserUserId: userId, // Same user for both in tournament context
    loserOldRating: rejectedMovieRating,
  };

  return processEloMatch(match);
}

/**
 * Calculate expected win probability based on ELO difference
 * 
 * @param ratingA ELO rating of first movie
 * @param ratingB ELO rating of second movie
 * @returns Probability that movie A wins (0-1)
 */
export function getWinProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Get rating tier/class based on ELO rating
 * 
 * @param rating ELO rating
 * @returns Human-readable tier
 */
export function getEloTier(rating: number): string {
  if (rating >= 1800) return 'Masterpiece';
  if (rating >= 1600) return 'Excellent';
  if (rating >= 1400) return 'Great';
  if (rating >= 1200) return 'Good';
  if (rating >= 1000) return 'Average';
  if (rating >= 800) return 'Below Average';
  return 'Poor';
} 