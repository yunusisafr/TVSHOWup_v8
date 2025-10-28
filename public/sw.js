const CACHE_NAME = 'tvshowup-v1'
const RUNTIME_CACHE = 'tvshowup-runtime-v1'
const IMAGE_CACHE = 'tvshowup-images-v1'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/tvshowup_logo-01.png'
]

const API_CACHE_DURATION = 1000 * 60 * 60 * 24
const IMAGE_CACHE_DURATION = 1000 * 60 * 60 * 24 * 7

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') {
    return
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }

        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response
          }

          const responseToCache = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        }).catch(() => {
          if (request.destination === 'document') {
            return caches.match('/')
          }
        })
      })
    )
  } else if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            const cachedDate = new Date(cachedResponse.headers.get('date'))
            const now = new Date()

            if (now - cachedDate < IMAGE_CACHE_DURATION) {
              return cachedResponse
            }
          }

          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone())
            }
            return response
          }).catch(() => {
            return cachedResponse || new Response('Image not available offline', {
              status: 404,
              statusText: 'Not Found'
            })
          })
        })
      })
    )
  } else if (url.hostname === 'api.themoviedb.org') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone())
          }
          return response
        }).catch(() => {
          return cache.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            return new Response(JSON.stringify({ error: 'Offline', results: [] }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            })
          })
        })
      })
    )
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics())
  }
})

async function syncAnalytics() {
  try {
    const cache = await caches.open('analytics-queue')
    const requests = await cache.keys()

    for (const request of requests) {
      try {
        await fetch(request.clone())
        await cache.delete(request)
      } catch (error) {
        console.error('Failed to sync analytics:', error)
      }
    }
  } catch (error) {
    console.error('Analytics sync error:', error)
  }
}
