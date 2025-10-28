import React, { useState } from 'react'
import { Star, X } from 'lucide-react'

interface RatingModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (rating: number) => void
  currentRating?: number
  contentTitle: string
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentRating = 0,
  contentTitle
}) => {
  const [rating, setRating] = useState(currentRating)
  const [hoveredRating, setHoveredRating] = useState(0)

  if (!isOpen) return null

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating)
      onClose()
    }
  }

  const handleStarClick = (value: number) => {
    setRating(value)
  }

  const handleStarHover = (value: number) => {
    setHoveredRating(value)
  }

  const handleStarLeave = () => {
    setHoveredRating(0)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Rate Content</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-300 mb-4">How would you rate "{contentTitle}"?</p>
          
          <div className="flex items-center justify-center space-x-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <button
                key={value}
                onClick={() => handleStarClick(value)}
                onMouseEnter={() => handleStarHover(value)}
                onMouseLeave={handleStarLeave}
                className="transition-colors"
              >
                <Star
                  className={`w-8 h-8 ${
                    value <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-600'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="text-center">
            <span className="text-2xl font-bold text-white">
              {hoveredRating || rating || 0}/10
            </span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Submit Rating
          </button>
        </div>
      </div>
    </div>
  )
}

export default RatingModal