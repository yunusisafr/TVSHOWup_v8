import { ContentItem } from './database'

export type MoodType = 'happy' | 'melancholic' | 'excited' | 'relaxed' | 'romantic' | 'tense' | 'thoughtful' | 'playful'

export interface MoodGenreMapping {
  mood: MoodType
  genres: number[]
  weight: number
}

// Updated genre mappings based on TMDB API genres
// Movies: Action(28), Adventure(12), Animation(16), Comedy(35), Crime(80), Documentary(99),
//         Drama(18), Family(10751), Fantasy(14), History(36), Horror(27), Music(10402),
//         Mystery(9648), Romance(10749), Sci-Fi(878), TV Movie(10770), Thriller(53), War(10752), Western(37)
// TV: Action & Adventure(10759), Animation(16), Comedy(35), Crime(80), Documentary(99),
//     Drama(18), Family(10751), Kids(10762), Mystery(9648), News(10763), Reality(10764),
//     Sci-Fi & Fantasy(10765), Soap(10766), Talk(10767), War & Politics(10768), Western(37)

export const MOOD_MAPPINGS: MoodGenreMapping[] = [
  // Happy: Comedy, Family, Animation - works for both movies and TV
  // Note: Music(10402) genre only exists for movies, not TV shows
  { mood: 'happy', genres: [35, 10751, 16], weight: 1.0 },

  // Melancholic: Drama, Documentary - deeper emotional content
  // Note: History(36) genre only exists for movies, not TV shows
  { mood: 'melancholic', genres: [18, 99], weight: 1.0 },

  // Excited: Action, Thriller, Adventure, Sci-Fi (Movies) + Action & Adventure, Sci-Fi & Fantasy (TV)
  // Note: Mixed movie/TV genres for better coverage
  { mood: 'excited', genres: [28, 53, 12, 878, 10759, 10765], weight: 1.0 },

  // Relaxed: Documentary, Animation, Romance(movies only), Comedy, Reality (TV)
  // Note: Romance(10749) works for movies, TV has Soap(10766) instead
  { mood: 'relaxed', genres: [99, 16, 10749, 35, 10764, 10766], weight: 1.0 },

  // Romantic: Romance(movies), Drama, Comedy, Soap(TV)
  // Note: Romance(10749) for movies, Soap(10766) for TV romantic content
  { mood: 'romantic', genres: [10749, 18, 35, 10766], weight: 1.0 },

  // Tense: Thriller(movies), Horror(movies), Mystery, Crime
  // Note: Thriller(53) and Horror(27) only exist for movies, using Mystery+Crime for TV
  { mood: 'tense', genres: [53, 27, 9648, 80], weight: 1.0 },

  // Thoughtful: Sci-Fi, Drama, Mystery, Documentary, Sci-Fi & Fantasy (TV)
  { mood: 'thoughtful', genres: [878, 18, 9648, 99, 10765], weight: 1.0 },

  // Playful: Comedy, Animation, Adventure(movies), Family, Kids (TV)
  // Note: Adventure(12) is movie-only, but Family+Kids+Comedy work for TV
  { mood: 'playful', genres: [35, 16, 12, 10751, 10762], weight: 1.0 }
]

export interface TimeBasedSuggestion {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  suggestedGenres: number[]
  suggestedDuration: { min: number; max: number }
  description: string
}

export const TIME_BASED_SUGGESTIONS: TimeBasedSuggestion[] = [
  {
    timeOfDay: 'morning',
    suggestedGenres: [35, 99, 10751, 16],
    suggestedDuration: { min: 60, max: 100 },
    description: 'Light and uplifting content to start your day'
  },
  {
    timeOfDay: 'afternoon',
    suggestedGenres: [28, 12, 878, 35],
    suggestedDuration: { min: 90, max: 140 },
    description: 'Engaging content for midday entertainment'
  },
  {
    timeOfDay: 'evening',
    suggestedGenres: [18, 53, 80, 10749],
    suggestedDuration: { min: 100, max: 180 },
    description: 'Deep and immersive stories for evening viewing'
  },
  {
    timeOfDay: 'night',
    suggestedGenres: [27, 9648, 878, 53],
    suggestedDuration: { min: 80, max: 120 },
    description: 'Thrilling content for late night watching'
  }
]

export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

export function getGenresForMood(mood: MoodType): number[] {
  const mapping = MOOD_MAPPINGS.find(m => m.mood === mood)
  return mapping ? mapping.genres : []
}

export function getTimeBasedSuggestion(): TimeBasedSuggestion {
  const timeOfDay = getTimeOfDay()
  return TIME_BASED_SUGGESTIONS.find(s => s.timeOfDay === timeOfDay) || TIME_BASED_SUGGESTIONS[0]
}

export interface ContentScoreFactors {
  tmdbScore: number
  genreMatchScore: number
  moodMatchScore: number
  recencyScore: number
  platformScore: number
  popularityScore: number
}

export function calculateContentScore(
  content: ContentItem,
  factors: Partial<ContentScoreFactors>
): number {
  const weights = {
    tmdb: 0.25,
    genreMatch: 0.20,
    moodMatch: 0.20,
    recency: 0.10,
    platform: 0.10,
    popularity: 0.15
  }

  const normalizedFactors = {
    tmdbScore: (factors.tmdbScore || 0) / 10,
    genreMatchScore: factors.genreMatchScore || 0,
    moodMatchScore: factors.moodMatchScore || 0,
    recencyScore: factors.recencyScore || 0,
    platformScore: factors.platformScore || 0,
    popularityScore: factors.popularityScore || 0
  }

  return (
    normalizedFactors.tmdbScore * weights.tmdb +
    normalizedFactors.genreMatchScore * weights.genreMatch +
    normalizedFactors.moodMatchScore * weights.moodMatch +
    normalizedFactors.recencyScore * weights.recency +
    normalizedFactors.platformScore * weights.platform +
    normalizedFactors.popularityScore * weights.popularity
  )
}

export function getGenreMatchScore(contentGenres: number[], targetGenres: number[]): number {
  if (targetGenres.length === 0) return 1.0

  const matches = contentGenres.filter(g => targetGenres.includes(g)).length
  return Math.min(matches / targetGenres.length, 1.0)
}

export function getRecencyScore(releaseDate: string, contentType: 'movie' | 'tv_show'): number {
  const today = new Date()
  const release = new Date(releaseDate)
  const daysDiff = Math.floor((today.getTime() - release.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff < 0) return 0
  if (daysDiff < 90) return 1.0
  if (daysDiff < 180) return 0.9
  if (daysDiff < 365) return 0.8
  if (daysDiff < 730) return 0.6
  return 0.4
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export interface SmartScoreFactors {
  baseScore: number
  genreMatch: number
  trendingBoost: number
  timeOfDay: number
  watchHistory: number
  popularityScore: number
}

export function calculateSmartScore(
  content: ContentItem,
  userProfile?: {
    genreScores?: Record<string, number>
    watchedGenres?: Map<number, number>
    preferredRating?: number
  }
): number {
  const now = new Date()
  const contentGenres = content.genres
    ? (typeof content.genres === 'string' ? JSON.parse(content.genres) : content.genres)
    : []

  const baseScore = content.vote_average / 10

  let genreMatch = 0.5
  if (userProfile?.genreScores && contentGenres.length > 0) {
    const genreIds = Array.isArray(contentGenres)
      ? contentGenres.map((g: any) => typeof g === 'number' ? g : g.id)
      : []

    const scores = genreIds
      .map((id: number) => userProfile.genreScores?.[id.toString()] || 50)
      .filter((s: number) => s > 0)

    if (scores.length > 0) {
      genreMatch = scores.reduce((a: number, b: number) => a + b, 0) / scores.length / 100
    }
  }

  const releaseDate = content.content_type === 'movie'
    ? content.release_date
    : content.first_air_date

  let trendingBoost = 0
  if (releaseDate) {
    const daysSinceRelease = Math.floor((now.getTime() - new Date(releaseDate).getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceRelease >= 0 && daysSinceRelease <= 90) {
      trendingBoost = 1.0 - (daysSinceRelease / 90) * 0.5
    } else if (daysSinceRelease > 90 && daysSinceRelease <= 365) {
      trendingBoost = 0.3
    } else {
      trendingBoost = 0.1
    }
  }

  const timeOfDaySuggestion = getTimeBasedSuggestion()
  const timeOfDayGenres = timeOfDaySuggestion.suggestedGenres

  let timeOfDayScore = 0.5
  if (contentGenres.length > 0) {
    const genreIds = Array.isArray(contentGenres)
      ? contentGenres.map((g: any) => typeof g === 'number' ? g : g.id)
      : []

    const matches = genreIds.filter((id: number) => timeOfDayGenres.includes(id)).length
    if (matches > 0) {
      timeOfDayScore = Math.min(matches / timeOfDayGenres.length + 0.5, 1.0)
    }
  }

  let watchHistoryScore = 0.5
  if (userProfile?.watchedGenres && contentGenres.length > 0) {
    const genreIds = Array.isArray(contentGenres)
      ? contentGenres.map((g: any) => typeof g === 'number' ? g : g.id)
      : []

    const watchCounts = genreIds
      .map((id: number) => userProfile.watchedGenres?.get(id) || 0)
      .filter((count: number) => count > 0)

    if (watchCounts.length > 0) {
      const avgWatchCount = watchCounts.reduce((a: number, b: number) => a + b, 0) / watchCounts.length
      watchHistoryScore = Math.min(avgWatchCount / 10, 1.0)
    }
  }

  const popularityScore = Math.min(content.popularity / 100, 1.0)

  const weights = {
    base: 0.25,
    genre: 0.20,
    trending: 0.15,
    timeOfDay: 0.10,
    watchHistory: 0.20,
    popularity: 0.10
  }

  const finalScore = (
    baseScore * weights.base +
    genreMatch * weights.genre +
    trendingBoost * weights.trending +
    timeOfDayScore * weights.timeOfDay +
    watchHistoryScore * weights.watchHistory +
    popularityScore * weights.popularity
  )

  return finalScore
}

export function findSimilarContent(
  targetContent: ContentItem,
  candidateContent: ContentItem[],
  limit: number = 10
): ContentItem[] {
  const targetGenres = targetContent.genres
    ? (typeof targetContent.genres === 'string' ? JSON.parse(targetContent.genres) : targetContent.genres)
    : []

  const targetGenreIds = Array.isArray(targetGenres)
    ? targetGenres.map((g: any) => typeof g === 'number' ? g : g.id)
    : []

  const scored = candidateContent
    .filter(c => c.id !== targetContent.id)
    .map(content => {
      const contentGenres = content.genres
        ? (typeof content.genres === 'string' ? JSON.parse(content.genres) : content.genres)
        : []

      const contentGenreIds = Array.isArray(contentGenres)
        ? contentGenres.map((g: any) => typeof g === 'number' ? g : g.id)
        : []

      const genreOverlap = contentGenreIds.filter((id: number) => targetGenreIds.includes(id)).length
      const genreScore = targetGenreIds.length > 0 ? genreOverlap / targetGenreIds.length : 0

      const ratingDiff = Math.abs(content.vote_average - targetContent.vote_average)
      const ratingScore = Math.max(0, 1 - (ratingDiff / 10))

      const sameType = content.content_type === targetContent.content_type ? 0.2 : 0

      const similarityScore = (genreScore * 0.5) + (ratingScore * 0.3) + sameType

      return {
        content,
        score: similarityScore
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.content)

  return scored
}
