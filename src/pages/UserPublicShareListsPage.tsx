import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, User, AlertCircle, Edit } from 'lucide-react'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { databaseService, ShareList } from '../lib/database'
import { useAuth } from '../contexts/AuthContext'
import { useAuthPrompt } from '../contexts/AuthPromptContext'
import PublicShareListSection from '../components/PublicShareListSection'

const UserPublicShareListsPage: React.FC = () => {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { user } = useAuth()
  const { openAuthPrompt } = useAuthPrompt()
  
  const [userProfile, setUserProfile] = useState<any | null>(null)
  const [userLists, setUserLists] = useState<ShareList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [userWatchlistMap, setUserWatchlistMap] = useState<Map<number, string>>(new Map())
  
  // Reset watchlist map when user logs out
  useEffect(() => {
    if (!user) {
      setUserWatchlistMap(new Map());
    }
  }, [user]);
  
  useEffect(() => {
    if (user) {
      loadUserWatchlist()
    }
  }, [user])

  useEffect(() => {
    if (!username) return
    
    loadUserData()
  }, [username])

  useEffect(() => {
    if (user && userProfile) {
      setIsOwner(user.id === userProfile.id)
    }
  }, [user, userProfile])

  const loadUserData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get user profile by display name with better error handling
      console.log(`🔍 Looking for user with display_name: "${username}"`)
      
      const { data: profile, error: profileError } = await databaseService.supabase
        .from('user_profiles')
        .select('*')
        .eq('display_name', username)
        .maybeSingle()
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        setError(languageCode === 'tr' ? 'Kullanıcı profili yüklenirken hata oluştu' : 'Error loading user profile')
        return
      }
      
      if (!profile) {
        console.log(`❌ No user found with display_name: "${username}"`)
        setError(languageCode === 'tr' ? 'Kullanıcı bulunamadı' : 'User not found')
        return
      }
      
      console.log(`✅ Found user profile:`, profile)
      setUserProfile(profile)
      
      // Get user's public and published share lists with better filtering
      console.log(`🔍 Loading share lists for user: ${profile.id}`)
      const publicLists = await databaseService.getShareLists(
        profile.id, 
        'created_at', 
        'desc',
        undefined,
        'public' // Only public lists
      )
      
      // Filter to only show published lists
      const publishedLists = publicLists.filter(list => {
        console.log(`📋 List "${list.name}": public=${list.is_public}, published=${list.is_published}`)
        return list.is_public && list.is_published !== false
      })
      
      console.log(`✅ Found ${publishedLists.length} published public lists`)
      setUserLists(publishedLists)
      
    } catch (error) {
      console.error('Error loading user data:', error)
      setError(languageCode === 'tr' ? 'Veriler yüklenirken bir hata oluştu' : 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  const loadUserWatchlist = async () => {
    if (!user) return
    
    try {
      const watchlist = await databaseService.getUserWatchlist(user.id)
      const watchlistMap = new Map<number, string>()
      watchlist.forEach(item => {
        watchlistMap.set(item.content_id, item.status)
      })
      setUserWatchlistMap(watchlistMap)
    } catch (error) {
      console.error('Error loading watchlist:', error)
    }
  }
  
  const handleWatchlistStatusChange = async (contentId: number, contentType: 'movie' | 'tv_show', status: 'want_to_watch' | 'watching' | 'watched' | null) => {
    if (!user) {
      openAuthPrompt('watchlist')
      return
    }
    
    try {
      if (status === null) {
        // Remove from watchlist
        await databaseService.removeFromWatchlist(user.id, contentId, contentType)
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.delete(contentId)
          return newMap
        })
      } else {
        // Add to watchlist with specified status
        await databaseService.addToWatchlist(user.id, contentId, contentType, status, {
          onConflict: 'user_id,content_id,content_type'
        })
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev)
          newMap.set(contentId, status)
          return newMap
        })
      }
    } catch (error) {
      console.error('Error updating watchlist:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-6">
                  <div className="h-6 bg-gray-700 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              {error || (languageCode === 'tr' ? 'Kullanıcı bulunamadı' : 'User not found')}
            </h2>
            <p className="text-gray-400 mb-6">
              {languageCode === 'tr' 
                ? 'Bu kullanıcı bulunamadı veya herkese açık öneri listesi yok.'
                : 'This user could not be found or has no public suggestion lists.'}
            </p>
            <button
              onClick={() => navigate(`/${languageCode}`)}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {languageCode === 'tr' ? 'Ana Sayfaya Dön' : 'Return to Home'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          {languageCode === 'tr' ? 'Geri' : 'Back'}
        </button>

        {/* User Profile Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            {userProfile.avatar_url ? (
              <img 
                src={userProfile.avatar_url}
                alt={userProfile.display_name}
                className="w-16 h-16 rounded-full object-cover mr-4"
                onError={(e) => {
                  e.currentTarget.src = '';
                  e.currentTarget.style.display = 'none';
                  // Text initial fallback
                  e.currentTarget.parentElement!.innerHTML = `
                    <div class="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center mr-4">
                      <span class="text-white text-xl font-bold">${userProfile.display_name.charAt(0).toUpperCase()}</span>
                    </div>
                  `;
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center mr-4">
                <span className="text-white text-xl font-bold">{userProfile.display_name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center">
                <User className="w-6 h-6 mr-2" />
                @{userProfile.display_name}
              </h1>
              <p className="text-gray-400">
                {languageCode === 'tr' ? 'Öneri Listeleri' : 'Suggestion Lists'}
              </p>
            </div>
            
            {isOwner && (
              <div className="ml-auto">
                <Link
                  to={`/${languageCode}/my-lists`}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {languageCode === 'tr' ? 'Listeleri Düzenle' : 'Edit Lists'}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Lists */}
        {userLists.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'Herkese Açık Öneri Listesi Yok' : 'No Public Suggestion Lists'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' 
                  ? 'Bu kullanıcının henüz herkese açık öneri listesi bulunmuyor.'
                  : 'This user doesn\'t have any public suggestion lists yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {userLists.map((list) => (
              <PublicShareListSection
                key={list.id}
                list={list}
                onWatchlistStatusChange={handleWatchlistStatusChange}
                userWatchlistMap={userWatchlistMap}
                onAuthRequired={() => openAuthPrompt('watchlist')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserPublicShareListsPage