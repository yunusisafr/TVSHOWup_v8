export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope)

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing

            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('🔄 New service worker available')

                  if (confirm('New version available! Reload to update?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' })
                    window.location.reload()
                  }
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error)
        })
    })

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister()
      })
      .catch((error) => {
        console.error('Service Worker unregistration failed:', error)
      })
  }
}

export function checkOnlineStatus(): boolean {
  return navigator.onLine
}

export function addOnlineListener(callback: () => void) {
  window.addEventListener('online', callback)
}

export function addOfflineListener(callback: () => void) {
  window.addEventListener('offline', callback)
}

export function removeOnlineListener(callback: () => void) {
  window.removeEventListener('online', callback)
}

export function removeOfflineListener(callback: () => void) {
  window.removeEventListener('offline', callback)
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist()
    console.log(`Persistent storage: ${isPersisted ? 'granted' : 'denied'}`)
    return isPersisted
  }
  return false
}

export async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    const percentUsed = ((estimate.usage || 0) / (estimate.quota || 1)) * 100

    console.log(`Storage used: ${((estimate.usage || 0) / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Storage quota: ${((estimate.quota || 0) / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Percentage used: ${percentUsed.toFixed(2)}%`)

    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentUsed
    }
  }

  return null
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes('android-app://')
  )
}

export function getInstallPrompt() {
  let deferredPrompt: any = null

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e

    console.log('💡 Install prompt available')
  })

  return {
    prompt: async () => {
      if (!deferredPrompt) {
        console.log('Install prompt not available')
        return null
      }

      deferredPrompt.prompt()

      const { outcome } = await deferredPrompt.userChoice
      console.log(`Install prompt outcome: ${outcome}`)

      deferredPrompt = null

      return outcome
    },
    isAvailable: () => !!deferredPrompt
  }
}

export async function shareContent(data: {
  title?: string
  text?: string
  url?: string
}): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share(data)
      console.log('Content shared successfully')
      return true
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error)
      }
      return false
    }
  } else {
    console.log('Web Share API not supported')
    return false
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if ('Notification' in window) {
    return Notification.requestPermission()
  }
  return Promise.resolve('denied')
}

export function showNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if ('Notification' in window && Notification.permission === 'granted') {
    return new Notification(title, options)
  }
  return null
}

export async function showServiceWorkerNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if ('serviceWorker' in navigator && 'Notification' in window) {
    const registration = await navigator.serviceWorker.ready

    if (Notification.permission === 'granted') {
      registration.showNotification(title, options)
    }
  }
}
