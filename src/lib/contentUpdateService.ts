import { tmdbService } from './tmdb'
import { databaseService } from './database'

const UPDATE_THRESHOLD_HOURS = 6
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

interface UpdateCheckResult {
  shouldUpdateProviders: boolean
  shouldUpdateRatings: boolean
}

class ContentUpdateService {
  async checkIfUpdateNeeded(
    contentId: number,
    contentType: 'movie' | 'tv_show',
    content: any
  ): Promise<UpdateCheckResult> {
    const now = new Date()
    const thresholdMs = UPDATE_THRESHOLD_HOURS * MILLISECONDS_PER_HOUR

    const providersLastUpdated = content?.providers_last_updated
      ? new Date(content.providers_last_updated)
      : null

    const ratingsLastUpdated = content?.ratings_last_updated
      ? new Date(content.ratings_last_updated)
      : null

    const shouldUpdateProviders =
      !providersLastUpdated ||
      now.getTime() - providersLastUpdated.getTime() > thresholdMs

    const shouldUpdateRatings =
      !ratingsLastUpdated ||
      now.getTime() - ratingsLastUpdated.getTime() > thresholdMs

    console.log(`📊 Update check for ${contentType} ${contentId}:`, {
      providersLastUpdated: providersLastUpdated?.toISOString() || 'never',
      ratingsLastUpdated: ratingsLastUpdated?.toISOString() || 'never',
      shouldUpdateProviders,
      shouldUpdateRatings,
      thresholdHours: UPDATE_THRESHOLD_HOURS
    })

    return { shouldUpdateProviders, shouldUpdateRatings }
  }

  async updateProvidersAndRatings(
    contentId: number,
    contentType: 'movie' | 'tv_show',
    updateProviders: boolean,
    updateRatings: boolean
  ): Promise<void> {
    try {
      const updates: any = {}

      if (updateRatings) {
        console.log(`🔄 Updating ratings for ${contentType} ${contentId}`)

        const tmdbType = contentType === 'tv_show' ? 'tv' : 'movie'
        const tmdbDetails = await (tmdbType === 'movie'
          ? tmdbService.getMovieDetails(contentId, 'en')
          : tmdbService.getTVShowDetails(contentId, 'en'))

        updates.vote_average = tmdbDetails.vote_average
        updates.vote_count = tmdbDetails.vote_count
        updates.popularity = tmdbDetails.popularity
        updates.ratings_last_updated = new Date().toISOString()

        console.log(`✅ Updated ratings: ${tmdbDetails.vote_average}/10 (${tmdbDetails.vote_count} votes)`)
      }

      if (updateProviders) {
        console.log(`🔄 Updating providers for ${contentType} ${contentId}`)
        updates.providers_last_updated = new Date().toISOString()
        console.log(`✅ Marked providers as updated`)
      }

      if (Object.keys(updates).length > 0) {
        const table = contentType === 'movie' ? 'movies' : 'tv_shows'

        const { error } = await databaseService.supabase
          .from(table)
          .update(updates)
          .eq('id', contentId)

        if (error) {
          console.error(`❌ Error updating ${contentType} ${contentId}:`, error)
          throw error
        }

        console.log(`✅ Successfully updated ${contentType} ${contentId} in database`)
      }
    } catch (error) {
      console.error(`❌ Error in updateProvidersAndRatings:`, error)
      throw error
    }
  }

  async updateProviderData(
    contentId: number,
    contentType: 'movie' | 'tv_show',
    countryCode: string,
    tmdbProvidersData: any
  ): Promise<void> {
    try {
      if (!tmdbProvidersData.results?.[countryCode]) {
        console.log(`⚠️ No providers found for ${countryCode}`)
        return
      }

      const countryProviders = tmdbProvidersData.results[countryCode]
      const allProviders: any[] = []
      const seenProviders = new Set<string>() // Track unique combinations

      const processProviderType = (providers: any[], monetizationType: string) => {
        if (!providers) return

        providers.forEach((p: any) => {
          // Create unique key to prevent duplicates
          const uniqueKey = `${contentId}-${contentType}-${countryCode}-${p.provider_id}-${monetizationType}`

          // Skip if already added
          if (seenProviders.has(uniqueKey)) {
            console.warn(`⚠️ Skipping duplicate provider: ${p.provider_id} (${monetizationType})`)
            return
          }

          seenProviders.add(uniqueKey)

          allProviders.push({
            content_id: contentId,
            content_type: contentType,
            country_code: countryCode,
            provider_id: p.provider_id,
            monetization_type: monetizationType,
            link: countryProviders.link || null
          })
        })
      }

      processProviderType(countryProviders.flatrate, 'flatrate')
      processProviderType(countryProviders.rent, 'rent')
      processProviderType(countryProviders.buy, 'buy')
      processProviderType(countryProviders.ads, 'ads')

      if (allProviders.length === 0) {
        console.log(`⚠️ No providers to save for ${contentType} ${contentId} in ${countryCode}`)
        return
      }

      const { error: deleteError } = await databaseService.supabase
        .from('content_providers')
        .delete()
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .eq('country_code', countryCode)

      if (deleteError) {
        console.error(`❌ Error deleting old providers:`, deleteError)
      }

      const { error: insertError } = await databaseService.supabase
        .from('content_providers')
        .insert(allProviders)

      if (insertError) {
        console.error(`❌ Error inserting new providers:`, insertError)
        throw insertError
      }

      console.log(`✅ Saved ${allProviders.length} providers for ${contentType} ${contentId} in ${countryCode}`)
    } catch (error) {
      console.error(`❌ Error in updateProviderData:`, error)
      throw error
    }
  }
}

export const contentUpdateService = new ContentUpdateService()
