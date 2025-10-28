import React from 'react'
import { MoodType } from '../lib/discoveryAlgorithm'

interface MoodOption {
  mood: MoodType
  emoji: string
  label: { tr: string; en: string }
  description: { tr: string; en: string }
  color: string
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    mood: 'happy',
    emoji: '😊',
    label: { tr: 'Mutlu', en: 'Happy' },
    description: { tr: 'Neşeli ve eğlenceli', en: 'Cheerful and fun' },
    color: 'from-yellow-500 to-orange-500'
  },
  {
    mood: 'melancholic',
    emoji: '😔',
    label: { tr: 'Melankolik', en: 'Melancholic' },
    description: { tr: 'Derin ve duygusal', en: 'Deep and emotional' },
    color: 'from-blue-500 to-blue-700'
  },
  {
    mood: 'excited',
    emoji: '🤩',
    label: { tr: 'Heyecanlı', en: 'Excited' },
    description: { tr: 'Aksiyon ve macera', en: 'Action and adventure' },
    color: 'from-red-500 to-pink-500'
  },
  {
    mood: 'relaxed',
    emoji: '😌',
    label: { tr: 'Rahat', en: 'Relaxed' },
    description: { tr: 'Hafif ve sakin', en: 'Light and calm' },
    color: 'from-green-500 to-teal-500'
  },
  {
    mood: 'romantic',
    emoji: '💕',
    label: { tr: 'Romantik', en: 'Romantic' },
    description: { tr: 'Aşk ve duygular', en: 'Love and feelings' },
    color: 'from-pink-500 to-rose-500'
  },
  {
    mood: 'tense',
    emoji: '😰',
    label: { tr: 'Gerilimli', en: 'Tense' },
    description: { tr: 'Gerilim ve korku', en: 'Thriller and horror' },
    color: 'from-gray-600 to-gray-800'
  },
  {
    mood: 'thoughtful',
    emoji: '🤔',
    label: { tr: 'Düşündürücü', en: 'Thoughtful' },
    description: { tr: 'Derin ve anlamlı', en: 'Deep and meaningful' },
    color: 'from-indigo-500 to-blue-600'
  },
  {
    mood: 'playful',
    emoji: '🤪',
    label: { tr: 'Eğlenceli', en: 'Playful' },
    description: { tr: 'Komedi ve şaka', en: 'Comedy and fun' },
    color: 'from-purple-500 to-pink-500'
  }
]

interface MoodSelectorProps {
  selectedMood?: MoodType
  onMoodSelect: (mood: MoodType) => void
  languageCode: string
}

const MoodSelector: React.FC<MoodSelectorProps> = ({ selectedMood, onMoodSelect, languageCode }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          {languageCode === 'tr' ? 'Bugün nasıl hissediyorsun?' : 'How are you feeling today?'}
        </h3>
        <p className="text-gray-400">
          {languageCode === 'tr'
            ? 'Ruh haline göre içerik önerelim'
            : 'Let us suggest content based on your mood'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {MOOD_OPTIONS.map((option) => (
          <button
            key={option.mood}
            onClick={() => onMoodSelect(option.mood)}
            className={`
              relative p-6 rounded-2xl border-2 transition-all duration-300
              ${selectedMood === option.mood
                ? `border-white bg-gradient-to-br ${option.color} shadow-lg scale-105`
                : 'border-gray-600 bg-gray-800/50 hover:border-gray-400 hover:scale-102'
              }
            `}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className="text-5xl mb-2">{option.emoji}</div>
              <div className="text-white font-bold text-lg">
                {languageCode === 'tr' ? option.label.tr : option.label.en}
              </div>
              <div className="text-xs text-gray-300 text-center">
                {languageCode === 'tr' ? option.description.tr : option.description.en}
              </div>
            </div>

            {selectedMood === option.mood && (
              <div className="absolute top-2 right-2 bg-white text-green-600 rounded-full p-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default MoodSelector
