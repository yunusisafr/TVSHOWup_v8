import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, X, Check } from 'lucide-react'
import { getLogoUrl } from '../lib/assets'
import { supabase } from '../lib/supabase'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { Link } from 'react-router-dom'
import { buildLanguagePath } from '../lib/utils'

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validToken, setValidToken] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)

  // Check if we have valid reset token
  useEffect(() => {
    const checkResetToken = async () => {
      try {
        setCheckingToken(true)

        console.log('🔐 Reset Password Page - Token Validation')
        console.log('   - Current URL:', window.location.href)
        console.log('   - Language:', languageCode)

        // Parse hash parameters (Supabase puts tokens in hash fragment)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))

        // Check both URL query params and hash params
        const accessToken = searchParams.get('access_token') || hashParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token')
        const type = searchParams.get('type') || hashParams.get('type')
        const errorCode = hashParams.get('error_code')
        const errorDescription = hashParams.get('error_description')

        console.log('   - Token type:', type)
        console.log('   - Access token present:', !!accessToken)
        console.log('   - Refresh token present:', !!refreshToken)

        // Handle Supabase errors from hash
        if (errorCode) {
          console.error('❌ Supabase auth error:', errorCode, errorDescription)
          setError(t('reset_link_expired'))
          return
        }

        // Get the session to check if user came from reset link
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error checking session:', error)
          setError(t('invalid_reset_link'))
          return
        }

        if (type === 'recovery' && accessToken && refreshToken) {
          // Set the session with the tokens from URL
          console.log('   - Setting session with recovery tokens...')
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            console.error('❌ Error setting session:', sessionError)
            setError(t('invalid_reset_link'))
            return
          }

          console.log('✅ Session set successfully, token is valid')
          setValidToken(true)
        } else if (session?.user) {
          // User is already authenticated (maybe from a valid reset link)
          console.log('✅ User already has valid session')
          setValidToken(true)
        } else {
          console.error('❌ Invalid reset link - no valid token or session')
          setError(t('invalid_reset_link'))
        }
      } catch (error) {
        console.error('❌ Error checking reset token:', error)
        setError(t('error_checking_reset_link'))
      } finally {
        setCheckingToken(false)
      }
    }

    checkResetToken()
  }, [searchParams, languageCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError(t('passwords_do_not_match'))
      return
    }

    if (password.length < 6) {
      setError(t('password_min_length'))
      return
    }

    setLoading(true)
    setError('')

    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        const loginPath = buildLanguagePath('/login', languageCode)
        navigate(loginPath, {
          state: {
            message: t('password_updated_success')
          }
        })
      }, 3000)
      
    } catch (error: any) {
      setError(error.message || t('error_updating_password'))
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking token
  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-white">
            {languageCode === 'tr' ? 'Sıfırlama bağlantısı kontrol ediliyor...' : 'Checking reset link...'}
          </p>
        </div>
      </div>
    )
  }

  // Show error if invalid token
  if (!validToken) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Link to={buildLanguagePath('/', languageCode)} className="flex items-center justify-center space-x-2 mb-8">
              <img 
                src={getLogoUrl()} 
                alt="TVSHOWup"
                className="h-11"
              />
            </Link>
            <h2 className="text-center text-3xl font-extrabold text-white">
              {t('invalid_link_title')}
            </h2>
          </div>
          
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
            <p className="text-red-400 text-center">{error}</p>
          </div>
          
          <div className="text-center">
            <Link
              to={buildLanguagePath('/login', languageCode)}
              className="text-primary-400 hover:text-primary-300"
            >
              {t('return_to_login')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show success message
  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Link to={buildLanguagePath('/', languageCode)} className="flex items-center justify-center space-x-2 mb-8">
              <img 
                src={getLogoUrl()} 
                alt="TVSHOWup"
                className="h-11"
              />
            </Link>
            <h2 className="text-center text-3xl font-extrabold text-white">
              {t('password_updated_title')}
            </h2>
          </div>
          
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 flex items-center">
            <Check className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-400">
              {t('password_updated_redirecting')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Close Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <Link to={buildLanguagePath('/', languageCode)} className="flex items-center justify-center space-x-2 mb-8">
            <img 
              src={getLogoUrl()} 
              alt="TVSHOWup"
              className="h-11"
            />
          </Link>
          <h2 className="text-center text-3xl font-extrabold text-white">
            {t('set_new_password')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            {t('set_new_password_description')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                {t('new_password')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                  placeholder={t('enter_new_password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                {t('confirm_new_password')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                  placeholder={t('confirm_new_password_placeholder')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {t('updating')}
                </div>
              ) : (
                t('update_password')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordPage