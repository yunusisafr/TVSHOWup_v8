import { ContentItem } from './database'
import { tmdbService } from './tmdb'

interface StructuredData {
  '@context': string
  '@type': string
  [key: string]: any
}

export class StructuredDataGenerator {
  static generateMovieSchema(content: ContentItem, languageCode: string = 'en'): StructuredData {
    const schema: StructuredData = {
      '@context': 'https://schema.org',
      '@type': 'Movie',
      name: content.title,
      alternateName: content.original_title,
      description: content.overview || '',
      image: content.poster_path
        ? tmdbService.getImageUrl(content.poster_path, 'w780')
        : undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }

    if (content.release_date) {
      schema.datePublished = content.release_date
    }

    if (content.vote_average) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: content.vote_average,
        ratingCount: content.vote_count || 0,
        bestRating: 10,
        worstRating: 0
      }
    }

    if (content.runtime) {
      const hours = Math.floor(content.runtime / 60)
      const minutes = content.runtime % 60
      schema.duration = `PT${hours}H${minutes}M`
    }

    if (content.genres) {
      try {
        const genres = typeof content.genres === 'string'
          ? JSON.parse(content.genres)
          : content.genres
        schema.genre = genres.map((g: any) => g.name)
      } catch (e) {
        console.error('Error parsing genres:', e)
      }
    }

    if (content.production_companies) {
      try {
        const companies = typeof content.production_companies === 'string'
          ? JSON.parse(content.production_companies)
          : content.production_companies
        schema.productionCompany = companies.map((c: any) => ({
          '@type': 'Organization',
          name: c.name
        }))
      } catch (e) {
        console.error('Error parsing production companies:', e)
      }
    }

    if (content.production_countries) {
      try {
        const countries = typeof content.production_countries === 'string'
          ? JSON.parse(content.production_countries)
          : content.production_countries
        schema.countryOfOrigin = countries.map((c: any) => ({
          '@type': 'Country',
          name: c.name
        }))
      } catch (e) {
        console.error('Error parsing production countries:', e)
      }
    }

    if (content.original_language) {
      schema.inLanguage = content.original_language
    }

    return schema
  }

  static generateTVShowSchema(content: ContentItem, languageCode: string = 'en'): StructuredData {
    const schema: StructuredData = {
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      name: content.title,
      alternateName: content.original_name,
      description: content.overview || '',
      image: content.poster_path
        ? tmdbService.getImageUrl(content.poster_path, 'w780')
        : undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }

    if (content.first_air_date) {
      schema.datePublished = content.first_air_date
    }

    if (content.last_air_date) {
      schema.endDate = content.last_air_date
    }

    if (content.vote_average) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: content.vote_average,
        ratingCount: content.vote_count || 0,
        bestRating: 10,
        worstRating: 0
      }
    }

    if (content.number_of_seasons) {
      schema.numberOfSeasons = content.number_of_seasons
    }

    if (content.number_of_episodes) {
      schema.numberOfEpisodes = content.number_of_episodes
    }

    if (content.genres) {
      try {
        const genres = typeof content.genres === 'string'
          ? JSON.parse(content.genres)
          : content.genres
        schema.genre = genres.map((g: any) => g.name)
      } catch (e) {
        console.error('Error parsing genres:', e)
      }
    }

    if (content.production_companies) {
      try {
        const companies = typeof content.production_companies === 'string'
          ? JSON.parse(content.production_companies)
          : content.production_companies
        schema.productionCompany = companies.map((c: any) => ({
          '@type': 'Organization',
          name: c.name
        }))
      } catch (e) {
        console.error('Error parsing production companies:', e)
      }
    }

    if (content.original_language) {
      schema.inLanguage = content.original_language
    }

    return schema
  }

  static generateBreadcrumbSchema(items: Array<{ name: string; url: string }>): StructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url
      }))
    }
  }

  static generateWebSiteSchema(): StructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TVSHOWup',
      url: 'https://www.tvshowup.com',
      description: "The World's Most Practical and Enjoyable Watchlist is on TVSHOWup. And it's free! Discover TV shows and movies on all streaming platforms.",
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://www.tvshowup.com/en/search?q={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    }
  }

  static injectStructuredData(schema: StructuredData | StructuredData[]): void {
    if (typeof window === 'undefined') return

    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]')
    existingScripts.forEach(script => script.remove())

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = JSON.stringify(Array.isArray(schema) ? schema : [schema])
    document.head.appendChild(script)
  }

  static removeStructuredData(): void {
    if (typeof window === 'undefined') return

    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    scripts.forEach(script => script.remove())
  }
}
