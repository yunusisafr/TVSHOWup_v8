import React, { useState, useEffect } from 'react'
import { X, Heart, Star, ChevronLeft, Sparkles } from 'lucide-react'
import { ContentItem } from '../lib/database'
import { discoveryService } from '../lib/discoveryService'
import { useAuth } from '../contexts/AuthContext'

interface SwipeDiscoveryProps {
  contents: ContentItem[]
  onLike: (content: ContentItem) => void
  onDislike: (content: ContentItem) => void
  onComplete: (likedContents: ContentItem[]) => void
  languageCode: string
}

const SwipeDiscovery: React.FC<SwipeDiscoveryProps> = ({
  contents,
  onLike,
  onDislike,
  onComplete,
  languageCode
}) => {
  const { user } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [likedContents, setLikedContents] = useState<ContentItem[]>([])
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)

  const currentContent = contents[currentIndex]
  const progress = ((currentIndex + 1) / contents.length) * 100

  useEffect(() => {
    if (currentIndex >= contents.length && likedContents.length > 0) {
      onComplete(likedContents)
    }
  }, [currentIndex, contents.length, likedContents, onComplete])

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!currentContent) return

    setSwipeDirection(direction)

    setTimeout(async () => {
      if (direction === 'right') {
        setLikedContents(prev => [...prev, currentContent])
        onLike(currentContent)

        if (user) {
          await discoveryService.addSwipeAction(user.id, currentContent.id, 'like')
        }
      } else {
        onDislike(currentContent)

        if (user) {
          await discoveryService.addSwipeAction(user.id, currentContent.id, 'dislike')
        }
      }

      setSwipeDirection(null)
      setCurrentIndex(prev => prev + 1)
    }, 300)
  }

  if (!currentContent) {
    return (
      <div className="text-center py-12">
        <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">
          {languageCode === 'tr' ? 'Tamamlandı!' : 'Complete!'}
        </h3>
        <p className="text-gray-400">
          {languageCode === 'tr'
            ? `${likedContents.length} içerik beğendiniz`
            : `You liked ${likedContents.length} items`}
        </p>
      </div>
    )
  }

  const posterUrl = currentContent.poster_path
    ? `https://image.tmdb.org/t/p/w500${currentContent.poster_path}`
    : '/placeholder-poster.png'

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">
            {languageCode === 'tr' ? 'İlerleme' : 'Progress'}: {currentIndex + 1} / {contents.length}
          </span>
          <span className="text-blue-400 text-sm">
            {languageCode === 'tr' ? 'Beğenilen' : 'Liked'}: {likedContents.length}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative">
        <div
          className={`
            relative overflow-hidden rounded-2xl shadow-2xl transition-transform duration-300
            ${swipeDirection === 'left' ? '-translate-x-full opacity-0' : ''}
            ${swipeDirection === 'right' ? 'translate-x-full opacity-0' : ''}
          `}
        >
          <div className="relative aspect-[2/3] max-h-[600px]">
            <img
              src={posterUrl}
              alt={currentContent.title || currentContent.name || 'Content poster'}
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h3 className="text-3xl font-bold mb-2">
                {currentContent.title || currentContent.name}
              </h3>

              <div className="flex items-center space-x-4 mb-3">
                <div className="flex items-center">
                  <Star className="w-5 h-5 text-yellow-400 mr-1" />
                  <span className="text-lg font-semibold">
                    {currentContent.vote_average.toFixed(1)}
                  </span>
                </div>

                <span className="text-gray-300">
                  {currentContent.content_type === 'movie'
                    ? currentContent.release_date?.substring(0, 4)
                    : currentContent.first_air_date?.substring(0, 4)}
                </span>

                <span className="px-3 py-1 bg-blue-600 rounded-full text-sm">
                  {currentContent.content_type === 'movie'
                    ? (languageCode === 'tr' ? 'Film' : 'Movie')
                    : (languageCode === 'tr' ? 'Dizi' : 'TV Show')}
                </span>
              </div>

              <p className="text-gray-200 text-sm line-clamp-3">
                {currentContent.overview}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center space-x-6 mt-8">
          <button
            onClick={() => handleSwipe('left')}
            className="group bg-gray-800 hover:bg-red-600 text-white p-6 rounded-full transition-all duration-300 shadow-lg hover:scale-110 border-2 border-gray-600 hover:border-red-500"
          >
            <X className="w-8 h-8" />
          </button>

          <button
            onClick={() => handleSwipe('right')}
            className="group bg-blue-600 hover:bg-blue-500 text-white p-8 rounded-full transition-all duration-300 shadow-lg hover:scale-110 border-4 border-blue-400"
          >
            <Heart className="w-10 h-10" />
          </button>

          <button
            onClick={() => handleSwipe('right')}
            className="group bg-gray-800 hover:bg-green-600 text-white p-6 rounded-full transition-all duration-300 shadow-lg hover:scale-110 border-2 border-gray-600 hover:border-green-500"
          >
            <Star className="w-8 h-8" />
          </button>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-400 text-sm">
            {languageCode === 'tr'
              ? 'Sola kaydır veya X: Geç | Sağa kaydır veya ❤️: Beğen'
              : 'Swipe left or X: Pass | Swipe right or ❤️: Like'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default SwipeDiscovery
