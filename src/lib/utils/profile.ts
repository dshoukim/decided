export interface BasicUserProfile {
  name?: string | null
  selectedGenres?: string[] | null
  streamingServices?: string[] | null
}

export function getMissingProfileFields(user: BasicUserProfile): string[] {
  const missing: string[] = []
  if (!user.name) missing.push('name')
  if (!user.selectedGenres || user.selectedGenres.length === 0) missing.push('genre preferences')
  if (!user.streamingServices || user.streamingServices.length === 0) missing.push('streaming services')
  return missing
} 