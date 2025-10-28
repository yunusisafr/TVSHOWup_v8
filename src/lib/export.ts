import { ContentItem } from './database'
import { analyticsService } from './analytics'

export interface ExportOptions {
  format: 'json' | 'csv' | 'markdown'
  includeMetadata?: boolean
  dateRange?: {
    start: Date
    end: Date
  }
}

export class ExportService {
  async exportWatchlist(
    items: ContentItem[],
    listName: string,
    options: ExportOptions = { format: 'json' }
  ): Promise<Blob> {
    switch (options.format) {
      case 'json':
        return this.exportAsJSON(items, listName, options)
      case 'csv':
        return this.exportAsCSV(items, listName, options)
      case 'markdown':
        return this.exportAsMarkdown(items, listName, options)
      default:
        throw new Error(`Unsupported format: ${options.format}`)
    }
  }

  private exportAsJSON(
    items: ContentItem[],
    listName: string,
    options: ExportOptions
  ): Blob {
    const data = {
      listName,
      exportDate: new Date().toISOString(),
      itemCount: items.length,
      items: options.includeMetadata
        ? items
        : items.map(item => ({
            id: item.id,
            title: item.title || item.name,
            type: item.content_type,
            rating: item.vote_average,
            releaseDate: item.release_date || item.first_air_date,
            posterPath: item.poster_path
          }))
    }

    const jsonString = JSON.stringify(data, null, 2)
    return new Blob([jsonString], { type: 'application/json' })
  }

  private exportAsCSV(
    items: ContentItem[],
    listName: string,
    options: ExportOptions
  ): Blob {
    const headers = ['Title', 'Type', 'Rating', 'Release Date', 'TMDB ID']

    if (options.includeMetadata) {
      headers.push('Overview', 'Popularity', 'Vote Count')
    }

    const rows = items.map(item => {
      const row = [
        this.escapeCsvValue(item.title || item.name || ''),
        item.content_type === 'movie' ? 'Movie' : 'TV Show',
        item.vote_average?.toFixed(1) || '',
        item.release_date || item.first_air_date || '',
        item.id.toString()
      ]

      if (options.includeMetadata) {
        row.push(
          this.escapeCsvValue(item.overview || ''),
          item.popularity?.toFixed(1) || '',
          item.vote_count?.toString() || ''
        )
      }

      return row.join(',')
    })

    const csv = [
      `# ${listName}`,
      `# Exported: ${new Date().toLocaleDateString()}`,
      headers.join(','),
      ...rows
    ].join('\n')

    return new Blob([csv], { type: 'text/csv' })
  }

  private exportAsMarkdown(
    items: ContentItem[],
    listName: string,
    options: ExportOptions
  ): Blob {
    const lines: string[] = [
      `# ${listName}`,
      '',
      `**Exported:** ${new Date().toLocaleDateString()}`,
      `**Total Items:** ${items.length}`,
      '',
      '---',
      ''
    ]

    items.forEach((item, index) => {
      lines.push(`## ${index + 1}. ${item.title || item.name}`)
      lines.push('')
      lines.push(`- **Type:** ${item.content_type === 'movie' ? 'Movie' : 'TV Show'}`)
      lines.push(`- **Rating:** ⭐ ${item.vote_average?.toFixed(1) || 'N/A'}/10`)
      lines.push(`- **Release:** ${item.release_date || item.first_air_date || 'Unknown'}`)
      lines.push(`- **TMDB ID:** ${item.id}`)

      if (options.includeMetadata && item.overview) {
        lines.push('')
        lines.push(`**Overview:**`)
        lines.push('')
        lines.push(item.overview)
      }

      lines.push('')
      lines.push('---')
      lines.push('')
    })

    const markdown = lines.join('\n')
    return new Blob([markdown], { type: 'text/markdown' })
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async exportAnalytics(
    userId: string,
    days: number = 30
  ): Promise<Blob> {
    const [summary, insights] = await Promise.all([
      analyticsService.getAnalyticsSummary(userId, days),
      analyticsService.getUserBehaviorInsights(userId, days)
    ])

    const report = {
      reportDate: new Date().toISOString(),
      timeRange: `${days} days`,
      summary,
      insights,
      recommendations: this.generateRecommendations(insights)
    }

    const jsonString = JSON.stringify(report, null, 2)
    return new Blob([jsonString], { type: 'application/json' })
  }

  private generateRecommendations(insights: any): string[] {
    const recommendations: string[] = []

    if (insights) {
      const movieTVRatio = insights.watchingPatterns.movieCount /
        (insights.watchingPatterns.tvShowCount || 1)

      if (movieTVRatio > 3) {
        recommendations.push('You watch mostly movies. Try exploring some TV series!')
      } else if (movieTVRatio < 0.33) {
        recommendations.push('You watch mostly TV shows. Try some movies for variety!')
      }

      if (insights.watchingPatterns.averageRating > 7.5) {
        recommendations.push('You have high standards! Consider exploring hidden gems with lower ratings.')
      } else if (insights.watchingPatterns.averageRating < 6) {
        recommendations.push('Try watching higher-rated content for better experiences.')
      }

      const favoriteGenres = Object.entries(insights.favoriteGenres || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)

      if (favoriteGenres.length > 0) {
        recommendations.push(`Your favorite genres are diverse. Keep exploring!`)
      }

      const peakHour = insights.peakActivity?.hourOfDay
      if (peakHour) {
        const topHours = Object.entries(peakHour)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 1)
          .map(([hour]) => parseInt(hour))

        if (topHours[0] >= 22 || topHours[0] <= 5) {
          recommendations.push('You often watch late at night. Try morning content for variety!')
        }
      }
    }

    return recommendations
  }

  async generatePDFReport(
    userId: string,
    userName: string,
    days: number = 30
  ): Promise<string> {
    const [summary, insights] = await Promise.all([
      analyticsService.getAnalyticsSummary(userId, days),
      analyticsService.getUserBehaviorInsights(userId, days)
    ])

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TVShowUp Analytics Report</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 {
      color: #1e40af;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 10px;
    }
    h2 {
      color: #3b82f6;
      margin-top: 30px;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #1e40af;
    }
    .stat-label {
      color: #6b7280;
      font-size: 14px;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>TVShowUp Analytics Report</h1>
  <p><strong>User:</strong> ${userName}</p>
  <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
  <p><strong>Time Range:</strong> Last ${days} days</p>

  <h2>Activity Overview</h2>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value">${summary?.totalEvents || 0}</div>
      <div class="stat-label">Total Activities</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${summary?.uniqueSessions || 0}</div>
      <div class="stat-label">Unique Sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${insights?.totalActions || 0}</div>
      <div class="stat-label">User Actions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${insights?.watchingPatterns?.averageRating?.toFixed(1) || 'N/A'}</div>
      <div class="stat-label">Avg Rating</div>
    </div>
  </div>

  <h2>Watching Patterns</h2>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Movies Viewed</td>
      <td>${insights?.watchingPatterns?.movieCount || 0}</td>
    </tr>
    <tr>
      <td>TV Shows Viewed</td>
      <td>${insights?.watchingPatterns?.tvShowCount || 0}</td>
    </tr>
    <tr>
      <td>Total Ratings Given</td>
      <td>${insights?.watchingPatterns?.totalRatings || 0}</td>
    </tr>
  </table>

  <h2>Recommendations</h2>
  <ul>
    ${this.generateRecommendations(insights).map(rec => `<li>${rec}</li>`).join('')}
  </ul>

  <div class="footer">
    Generated by TVShowUp Analytics Engine<br>
    © ${new Date().getFullYear()} TVShowUp. All rights reserved.
  </div>
</body>
</html>
    `

    return html
  }
}

export const exportService = new ExportService()
export default exportService
