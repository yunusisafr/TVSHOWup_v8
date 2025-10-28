import React from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'

const AuthPromptModal: React.FC = () => {
  const { isPromptOpen, closeAuthPrompt, promptAction, redirectPath } = useAuthPrompt()
  const { languageCode, isLoading } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const navigate = useNavigate()

  // If promptAction is 'register', directly navigate to sign up page
  React.useEffect(() => {
    if (isPromptOpen && promptAction === 'register') {
      closeAuthPrompt()
      navigate('/login', { state: { redirectPath, isSignUp: true } })
    }
  }, [isPromptOpen, promptAction])

  if (isLoading) return null
  if (!isPromptOpen) return null
  if (promptAction === 'register') return null // Don't show modal for register action

  const handleLogin = () => {
    closeAuthPrompt()
    navigate('/login', { state: { redirectPath } })
  }

  const handleSignUp = () => {
    closeAuthPrompt()
    navigate('/login', { state: { redirectPath, isSignUp: true } })
  }

  const getActionMessage = () => {
    switch (promptAction) {
      case 'watchlist':
        return t.watchlistPrompt
      case 'rate':
        return t.ratePrompt
      case 'comment':
        return t.commentPrompt
      default:
        return t.genericPrompt
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={closeAuthPrompt}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">
            {t.signInRequired}
          </h2>
          <p className="text-gray-300 mb-2">
            {getActionMessage()}
          </p>
        </div>
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleLogin}
            className="bg-primary-500 hover:bg-primary-600 text-white py-3 px-4 rounded-lg transition-colors"
          >
            {t.signIn}
          </button>
          
          <button
            onClick={closeAuthPrompt}
            className="text-gray-400 hover:text-white py-2 transition-colors"
          >
            {t.maybeLater}
          </button>
          
          <button
            onClick={handleSignUp}
            className="bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition-colors"
          >
            {t.signUp}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthPromptModal