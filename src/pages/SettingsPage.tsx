import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { User, UserAttributes } from '@supabase/supabase-js'
import { useAuth } from '../contexts/AuthContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { supabase } from '../lib/supabase' 
import { Eye, EyeOff, Save, User as UserIcon, Mail, Lock, AlertCircle, Upload, X, Camera, Globe, Copy, Check, Link as LinkIcon } from 'lucide-react'
import { databaseService } from '../lib/database'

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, userProfile, signOut, fetchUserProfile } = useAuth()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  
  // Profile form state
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Initialize form data
  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
      
      // Get display name from userProfile first, then from user metadata
      const profileDisplayName = userProfile?.display_name || user.user_metadata?.displayName || user.email?.split('@')[0] || ''
      console.log('📝 Setting display name in form:', profileDisplayName)
      console.log('📝 User profile:', userProfile)
      console.log('📝 User metadata:', user.user_metadata)
      
      setDisplayName(profileDisplayName)
      setAvatarUrl(userProfile?.avatar_url || '')
      
      // Set avatar preview if URL exists
      if (userProfile?.avatar_url) {
        setAvatarPreview(userProfile.avatar_url)
      }
    }
  }, [user, userProfile])

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth')
    }
  }, [user, navigate])

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file size (1MB limit)
    if (file.size > 1024 * 1024) {
      setProfileError(languageCode === 'tr' ? 'Dosya boyutu 1MB\'dan küçük olmalıdır.' : 'File size must be less than 1MB.')
      return
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setProfileError(languageCode === 'tr' ? 'Lütfen geçerli bir resim dosyası seçin.' : 'Please select a valid image file.')
      return
    }
    
    // Resize image before setting it
    resizeImage(file)
      .then((resizedFile) => {
        setAvatarFile(resizedFile)
        
        // Create preview URL
        const reader = new FileReader()
        reader.onload = (e) => {
          setAvatarPreview(e.target?.result as string)
        }
        reader.readAsDataURL(resizedFile)
        
        // Clear any previous errors
        setProfileError(null)
      })
      .catch((error) => {
        console.error('Error resizing image:', error)
        setProfileError(languageCode === 'tr' ? 'Resim işlenirken bir hata oluştu.' : 'Error processing image.')
      })
  }

  // Resize image to prevent dimension errors
  const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      
      img.onload = () => {
        // Set maximum dimensions (well below 8000px limit)
        const MAX_WIDTH = 800
        const MAX_HEIGHT = 800
        
        let { width, height } = img
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = (width * MAX_HEIGHT) / height
            height = MAX_HEIGHT
          }
        }
        
        // Set canvas dimensions
        canvas.width = width
        canvas.height = height
        
        // Draw and resize image
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'))
              return
            }
            
            // Create new file from blob
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            
            console.log(`✅ Image resized from ${img.width}x${img.height} to ${width}x${height}`)
            resolve(resizedFile)
          },
          file.type,
          0.9 // Quality (0.9 = 90% quality)
        )
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      // Load the image
      img.src = URL.createObjectURL(file)
    })
  }

  // Clear avatar selection
  const clearAvatarSelection = () => {
    setAvatarFile(null)
    setAvatarPreview(userProfile?.avatar_url || null)
    
    // Reset file input
    const fileInput = document.getElementById('avatar-upload') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  // Upload avatar to Supabase Storage
  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null
    
    try {
      setIsUploading(true)
      setUploadProgress(0)
      
      // Generate unique filename
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`
      
      console.log('Uploading avatar:', { fileName, filePath, fileSize: avatarFile.size })
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: true
        })
      
      if (uploadError) {
        console.error('Upload error:', uploadError)
        
        // If it's a duplicate file error, try with upsert
        if (uploadError.message.includes('duplicate') || uploadError.message.includes('already exists')) {
          console.log('File exists, trying to overwrite...')
          const { data: retryData, error: retryError } = await supabase.storage
            .from('avatars')
            .update(filePath, avatarFile, {
              cacheControl: '3600',
              upsert: true
            })
          
          if (retryError) {
            throw new Error(`Upload failed: ${retryError.message}`)
          }
          console.log('Retry upload successful:', retryData)
        } else {
          throw new Error(`Upload failed: ${uploadError.message}`)
        }
      }
      
      console.log('Upload successful:', uploadData || 'File updated')
      setUploadProgress(100)
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      
      console.log('Generated public URL:', publicUrlData.publicUrl)
      
      // Add cache buster to URL to prevent browser caching
      const urlWithCacheBuster = `${publicUrlData.publicUrl}?t=${Date.now()}`
      console.log('URL with cache buster:', urlWithCacheBuster)
      
      // Update avatar preview immediately
      setAvatarPreview(urlWithCacheBuster)
      
      return publicUrlData.publicUrl
    } catch (error) {
      console.error('Error uploading avatar:', error)
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Profile update started')
    if (!user) return
    
    try {
      setSavingProfile(true)
      setProfileError(null)
      setProfileSuccess(false)
      
      // Upload avatar if a new file is selected
      let finalAvatarUrl = avatarUrl
      if (avatarFile) {
        console.log('New avatar file detected, starting upload')
        try {
          const uploadedUrl = await uploadAvatar()
          if (uploadedUrl) {
            finalAvatarUrl = uploadedUrl
            console.log('Avatar upload successful, setting URL to:', uploadedUrl)
          }
        } catch (error: any) {
          console.error('Error uploading avatar:', error)
          setProfileError(error.message || 'Failed to upload avatar')
          return
        }
      }
      
      // Update profile in the database
      console.log('Updating profile with new data:', {
        display_name: displayName,
        avatar_url: finalAvatarUrl
      })
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          display_name: displayName,
          avatar_url: finalAvatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (profileError) throw new Error(`Profile update failed: ${profileError.message}`)
      
      // Update email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email
        })
        
        if (emailError) throw new Error(`Email update failed: ${emailError.message}`)
      }
      
      // Update user metadata with new display name
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          displayName: displayName
        }
      })
      
      if (metadataError) {
        console.warn('Warning: Could not update user metadata:', metadataError)
      }
      
      setProfileSuccess(true)
      
      // Update local state to reflect the changes
      // Add cache busting parameter to prevent browser caching
      setAvatarUrl(finalAvatarUrl)
      const cacheBuster = `?t=${Date.now()}`
      console.log('Setting final avatar URL with cache buster:', finalAvatarUrl + cacheBuster)
      setAvatarPreview(finalAvatarUrl ? finalAvatarUrl + cacheBuster : null)
      setAvatarFile(null)
      
      // Fetch updated profile to refresh the context
      if (user) {
        console.log('🔄 Fetching updated profile after changes')
        await fetchUserProfile(user.id)
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setProfileSuccess(false)
      }, 3000)
      
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setProfileError(error.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError(languageCode === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match')
      return
    }
    
    if (newPassword.length < 6) {
      setPasswordError(languageCode === 'tr' ? 'Şifre en az 6 karakter olmalıdır' : 'Password must be at least 6 characters')
      return
    }
    
    try {
      setSavingPassword(true)
      setPasswordError(null)
      setPasswordSuccess(false)
      
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      
      // Clear password fields
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      setPasswordSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setPasswordSuccess(false)
      }, 3000)
      
    } catch (error: any) {
      console.error('Error changing password:', error)
      setPasswordError(error.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  if (!user) {
    return null // Redirect handled in useEffect
  }

  // Debug: Log user information to console
  console.log('🔍 DEBUG - Current user:', user)
  console.log('🔍 DEBUG - User profile:', userProfile)
  console.log('🔍 DEBUG - Display name in form:', displayName)
  console.log('🔍 DEBUG - User metadata:', user.user_metadata)

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          {t.accountSettings}
        </h1>
        
        <div className="space-y-8">
          {/* Profile Information */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <UserIcon className="w-5 h-5 mr-2" />
              {t.profileSettings}
            </h2>
            
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              {/* Display Name */}
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
                  {t.displayName}
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={languageCode === 'tr' ? 'Görünen adınızı girin' : 'Enter your display name'}
                />
              </div>
              
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  {t.email}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={languageCode === 'tr' ? 'E-posta adresinizi girin' : 'Enter your email address'}
                />
                {email !== user.email && (
                  <p className="mt-1 text-sm text-yellow-400">
                    {languageCode === 'tr' 
                      ? 'E-posta adresinizi değiştirirseniz, yeni adresinizi doğrulamanız gerekecektir.' 
                      : 'If you change your email, you will need to verify your new address.'}
                  </p>
                )}
              </div>
              
              {/* Avatar URL */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  {languageCode === 'tr' ? 'Profil Resmi' : 'Profile Picture'}
                </label>
                
                {/* Avatar Preview */}
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-600 bg-gray-700 flex items-center justify-center">
                      {avatarPreview ? (
                        <img 
                          src={avatarPreview} 
                          alt="Avatar Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Avatar image failed to load:', e.currentTarget.src);
                            e.currentTarget.onerror = null;
                            e.currentTarget.style.display = 'none';
                            // Text initial fallback
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-blue-600">
                                <span class="text-white text-2xl font-medium">${(displayName || userProfile?.display_name || 'U').charAt(0).toUpperCase()}</span>
                              </div>
                            `;
                          }}
                        />
                      ) : (
                        // Fallback when avatarPreview is null (avatar not set or broken)
                        <div className="w-full h-full flex items-center justify-center bg-blue-600">
                          <span className="text-white text-2xl font-medium">
                            {(displayName || userProfile?.display_name || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {avatarFile && (
                        <button
                          type="button"
                          onClick={clearAvatarSelection}
                          className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700 transition-colors"
                          title={languageCode === 'tr' ? 'Seçimi temizle' : 'Clear selection'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                  
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <div className="text-white text-sm font-medium">{uploadProgress}%</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        console.log('File selected:', e.target.files?.[0]?.name);
                        handleAvatarChange(e);
                      }}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors inline-flex items-center"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {avatarFile ? (avatarFile.name.substring(0, 15) + (avatarFile.name.length > 15 ? '...' : '')) : (languageCode === 'tr' ? 'Resim Yükle' : 'Upload Image')}
                    </label>
                    <p className="mt-2 text-sm text-gray-400">
                      {languageCode === 'tr' ? 'PNG, JPG veya GIF. Maksimum 1MB.' : 'PNG, JPG or GIF. Max 1MB.'}
                    </p>
                  </div>
                </div>
                
              </div>
              
              {/* Error and Success Messages */}
              {profileError && (
                <div className="bg-red-900/20 border border-red-500 rounded-md p-3 text-red-400 flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{profileError}</span>
                </div>
              )}
              
              {profileSuccess && (
                <div className="bg-green-900/20 border border-green-500 rounded-md p-3 text-green-400">
                  {languageCode === 'tr' 
                    ? 'Profil bilgileriniz başarıyla güncellendi.' 
                    : 'Your profile information has been updated successfully.'}
                </div>
              )}
              
              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-md transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed min-w-[150px]"
                >
                  {savingProfile ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      {languageCode === 'tr' ? 'Kaydediliyor...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {languageCode === 'tr' ? 'Profili Güncelle' : 'Update Profile'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Password Change */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <Lock className="w-5 h-5 mr-2" />
              {languageCode === 'tr' ? 'Şifre Değiştir' : 'Change Password'}
            </h2>
            
            <form onSubmit={handlePasswordChange} className="space-y-6">
              {/* Current Password */}
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-1">
                  {languageCode === 'tr' ? 'Mevcut Şifre' : 'Current Password'}
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={languageCode === 'tr' ? 'Mevcut şifrenizi girin' : 'Enter your current password'}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                  {languageCode === 'tr' ? 'Yeni Şifre' : 'New Password'}
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={languageCode === 'tr' ? 'Yeni şifrenizi girin' : 'Enter your new password'}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                  {languageCode === 'tr' ? 'Yeni Şifre (Tekrar)' : 'Confirm New Password'}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={languageCode === 'tr' ? 'Yeni şifrenizi tekrar girin' : 'Confirm your new password'}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* Error and Success Messages */}
              {passwordError && (
                <div className="bg-red-900/20 border border-red-500 rounded-md p-3 text-red-400 flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}
              
              {passwordSuccess && (
                <div className="bg-green-900/20 border border-green-500 rounded-md p-3 text-green-400">
                  {languageCode === 'tr' 
                    ? 'Şifreniz başarıyla değiştirildi.' 
                    : 'Your password has been changed successfully.'}
                </div>
              )}
              
              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={savingPassword || !newPassword || !confirmPassword}
                  className="bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-md transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      {languageCode === 'tr' ? 'Kaydediliyor...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {languageCode === 'tr' ? 'Şifreyi Güncelle' : 'Update Password'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          {/* Account Actions */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-6">
              {languageCode === 'tr' ? 'Hesap İşlemleri' : 'Account Actions'}
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={() => signOut().then(() => navigate(`/${languageCode}`))}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors"
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to show fallback avatar
function showFallbackAvatar(parent: HTMLElement | null, displayName: string) {
  if (!parent || parent.querySelector('.fallback-avatar')) return;
  
  const fallback = document.createElement('div');
  fallback.className = "w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center fallback-avatar";
  fallback.innerHTML = `<span class="text-white text-2xl font-medium">${(displayName || 'U').charAt(0).toUpperCase()}</span>`;
  parent.appendChild(fallback);
}

export default SettingsPage