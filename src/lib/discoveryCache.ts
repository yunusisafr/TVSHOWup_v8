import { ContentItem } from './database'

const DB_NAME = 'DiscoveryCache'
const STORE_NAME = 'results'
const DB_VERSION = 1
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

interface CachedResult {
  key: string
  data: ContentItem[]
  timestamp: number
  mood?: string
  filters?: any
}

class DiscoveryCache {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          objectStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  generateKey(mood: string, filters: any): string {
    const filterString = JSON.stringify({
      platforms: filters.platforms?.sort() || [],
      contentType: filters.contentType || 'all',
      minRating: filters.minRating || 5.0,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo
    })
    return `${mood}_${filterString}`
  }

  async get(key: string): Promise<ContentItem[] | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result as CachedResult | undefined

        if (!result) {
          resolve(null)
          return
        }

        const now = Date.now()
        const age = now - result.timestamp

        if (age > CACHE_DURATION_MS) {
          console.log('🗑️ Cache expired for:', key)
          this.delete(key)
          resolve(null)
          return
        }

        console.log('✅ Cache hit:', key, `(${Math.round(age / 1000)}s old)`)
        resolve(result.data)
      }

      request.onerror = () => reject(request.error)
    })
  }

  async set(key: string, data: ContentItem[], mood?: string, filters?: any): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const cachedResult: CachedResult = {
        key,
        data,
        timestamp: Date.now(),
        mood,
        filters
      }

      const request = store.put(cachedResult)

      request.onsuccess = () => {
        console.log('💾 Cached results:', key, `(${data.length} items)`)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log('🗑️ Cache cleared')
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async cleanExpired(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const cutoffTime = Date.now() - CACHE_DURATION_MS

      const range = IDBKeyRange.upperBound(cutoffTime)
      const request = index.openCursor(range)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          console.log('🗑️ Deleting expired cache:', cursor.value.key)
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async getStats(): Promise<{ count: number; totalSize: number; oldestAge: number }> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result as CachedResult[]
        const now = Date.now()

        const stats = {
          count: results.length,
          totalSize: results.reduce((sum, r) => sum + r.data.length, 0),
          oldestAge: results.length > 0
            ? Math.max(...results.map(r => now - r.timestamp))
            : 0
        }

        resolve(stats)
      }

      request.onerror = () => reject(request.error)
    })
  }
}

export const discoveryCache = new DiscoveryCache()

discoveryCache.init().catch(err => {
  console.error('Failed to initialize discovery cache:', err)
})

setInterval(() => {
  discoveryCache.cleanExpired().catch(err => {
    console.error('Failed to clean expired cache:', err)
  })
}, 5 * 60 * 1000)
