import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SUPPORTED_LANGUAGES, removeLanguagePrefix } from '../lib/utils'

interface SEOHeadProps {
  title?: string
  description?: string
  image?: string
  languageCode: string
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'TVSHOWup - Find Your Next Show',
  description = "The World's Most Practical and Enjoyable Watchlist is on TVSHOWup. And it's free! Discover TV shows and movies on all streaming platforms.",
  image,
  languageCode
}) => {
  const location = useLocation()
  const currentPath = removeLanguagePrefix(location.pathname)
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    document.title = title

    const updateOrCreateMeta = (selector: string, attribute: string, content: string) => {
      let element = document.querySelector(selector)
      if (!element) {
        element = document.createElement('meta')
        if (selector.includes('property')) {
          element.setAttribute('property', selector.replace('meta[property="', '').replace('"]', ''))
        } else {
          element.setAttribute('name', selector.replace('meta[name="', '').replace('"]', ''))
        }
        document.head.appendChild(element)
      }
      element.setAttribute(attribute, content)
    }

    updateOrCreateMeta('meta[name="description"]', 'content', description)
    updateOrCreateMeta('meta[property="og:title"]', 'content', title)
    updateOrCreateMeta('meta[property="og:description"]', 'content', description)
    updateOrCreateMeta('meta[property="og:url"]', 'content', `${currentUrl}${location.pathname}`)
    updateOrCreateMeta('meta[property="og:type"]', 'content', 'website')

    if (image) {
      updateOrCreateMeta('meta[property="og:image"]', 'content', image)
      updateOrCreateMeta('meta[name="twitter:image"]', 'content', image)
    }

    updateOrCreateMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')
    updateOrCreateMeta('meta[name="twitter:title"]', 'content', title)
    updateOrCreateMeta('meta[name="twitter:description"]', 'content', description)

    const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]')
    existingHreflangs.forEach(link => link.remove())

    const existingCanonical = document.querySelector('link[rel="canonical"]')
    if (existingCanonical) {
      existingCanonical.remove()
    }

    const canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    canonical.setAttribute('href', `${currentUrl}/${languageCode}${currentPath}`)
    document.head.appendChild(canonical)

    SUPPORTED_LANGUAGES.forEach(lang => {
      const hreflang = document.createElement('link')
      hreflang.setAttribute('rel', 'alternate')
      hreflang.setAttribute('hreflang', lang)
      hreflang.setAttribute('href', `${currentUrl}/${lang}${currentPath}`)
      document.head.appendChild(hreflang)
    })

    const xDefault = document.createElement('link')
    xDefault.setAttribute('rel', 'alternate')
    xDefault.setAttribute('hreflang', 'x-default')
    xDefault.setAttribute('href', `${currentUrl}/en${currentPath}`)
    document.head.appendChild(xDefault)

  }, [title, description, image, languageCode, location.pathname, currentPath, currentUrl])

  return null
}

export default SEOHead
