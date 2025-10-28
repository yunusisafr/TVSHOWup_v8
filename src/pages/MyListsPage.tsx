import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Edit, Trash2, Share2, Eye, Lock, Globe, AlertCircle, Check, X, Calendar, Film, Tv, Copy } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { databaseService, ShareList } from '../lib/database'
import { getLocalizedListName, getLocalizedListDescription } from '../lib/database'
import { rateLimitService } from '../lib/rateLimitService'
import AddContentToListModal from '../components/AddContentToListModal'
import ListContentDisplayModal from '../components/ListContentDisplayModal'

const MyListsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const { userProfile } = useAuth()
  
  const [userLists, setUserLists] = useState<ShareList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingList, setEditingList] = useState<ShareList | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Share state
  const [copiedListId, setCopiedListId] = useState<string | null>(null)
  const [copiedProfileLink, setCopiedProfileLink] = useState(false)
  const [updatingPublicStatus, setUpdatingPublicStatus] = useState<string | null>(null)
  
  // Add content modal state
  const [showAddContentModal, setShowAddContentModal] = useState(false)
  const [selectedListForContent, setSelectedListForContent] = useState<ShareList | null>(null)
  
  // List content display modal state
  const [showListContentModal, setShowListContentModal] = useState(false)
  const [selectedListForDisplay, setSelectedListForDisplay] = useState<ShareList | null>(null)
  
  // Form state for create/edit modal
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIsPublic, setFormIsPublic] = useState(false)
  const [formIsPublished, setFormIsPublished] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'item_count'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterIsPublic, setFilterIsPublic] = useState<'all' | 'public' | 'private'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  // Load user's lists
  useEffect(() => {
    if (user) {
      loadUserLists()
    }
  }, [user, sortBy, sortOrder, searchQuery, filterIsPublic])

  const loadUserLists = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      
      const lists = await databaseService.getShareLists(user.id, sortBy, sortOrder)
      setUserLists(lists)
    } catch (error) {
      console.error('Error loading user lists:', error)
      setError(languageCode === 'tr' ? 'Listeler yüklenirken bir hata oluştu' : 'Error loading lists')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = () => {
    setEditingList(null)
    setFormName('')
    setFormDescription('')
    setFormIsPublic(true)
    setFormIsPublished(false)
    setFormError(null)
    setShowCreateModal(true)
  }

  const handleEditList = (list: ShareList) => {
    setEditingList(list)
    setFormName(list.name)
    setFormDescription(list.description || '')
    setFormIsPublic(list.is_public)
    setFormIsPublished(list.is_published || false)
    setFormError(null)
    setShowCreateModal(true)
  }

  const handleCloseModal = () => {
    setShowCreateModal(false)
    setEditingList(null)
    setFormError(null)
  }

  const handleSaveList = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !formName.trim()) {
      setFormError(languageCode === 'tr' ? 'Liste adı gereklidir' : 'List name is required')
      return
    }

    try {
      setFormLoading(true)
      setFormError(null)

      if (editingList) {
        // Update existing list
        const success = await databaseService.updateShareList(editingList.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          is_public: formIsPublic,
          is_published: formIsPublished
        })

        if (success) {
          setSuccessMessage(languageCode === 'tr' ? 'Liste başarıyla güncellendi' : 'List updated successfully')
          await loadUserLists()
          handleCloseModal()
        } else {
          setFormError(languageCode === 'tr' ? 'Liste güncellenirken bir hata oluştu' : 'Error updating list')
        }
      } else {
        // Create new list
        const newList = await databaseService.createShareList(
          user.id,
          formName.trim(),
          formDescription.trim() || undefined,
          formIsPublic,
          formIsPublished
        )
        
        if (newList) {
          await rateLimitService.trackListCreation(user.id);
          setSuccessMessage(languageCode === 'tr' ? 'Liste başarıyla oluşturuldu (+5 bonus prompt!)' : 'List created successfully (+5 bonus prompts!)')
          await loadUserLists()
          handleCloseModal()
        } else {
          setFormError(languageCode === 'tr' ? 'Liste oluşturulurken bir hata oluştu' : 'Error creating list')
        }
      }
    } catch (error) {
      console.error('Error saving list:', error)
      setFormError(languageCode === 'tr' ? 'Bir hata oluştu' : 'An error occurred')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteList = async (listId: string) => {
    if (deleteConfirm !== listId) {
      setDeleteConfirm(listId)
      return
    }

    try {
      setDeleteLoading(true)
      
      const success = await databaseService.deleteShareList(listId)
      
      if (success) {
        setSuccessMessage(languageCode === 'tr' ? 'Liste başarıyla silindi' : 'List deleted successfully')
        setUserLists(prev => prev.filter(list => list.id !== listId))
      } else {
        setError(languageCode === 'tr' ? 'Liste silinirken bir hata oluştu' : 'Error deleting list')
      }
    } catch (error) {
      console.error('Error deleting list:', error)
      setError(languageCode === 'tr' ? 'Liste silinirken bir hata oluştu' : 'Error deleting list')
    } finally {
      setDeleteLoading(false)
      setDeleteConfirm(null)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  const handleAddContent = (list: ShareList) => {
    setSelectedListForContent(list)
    setShowAddContentModal(true)
  }

  const handleTogglePublicStatus = async (listId: string, currentStatus: boolean) => {
    try {
      setUpdatingPublicStatus(listId)
      
      const success = await databaseService.updateShareList(listId, {
        is_public: !currentStatus
      })
      
      if (success) {
        // Update local state
        setUserLists(prev => prev.map(list => 
          list.id === listId 
            ? { ...list, is_public: !currentStatus }
            : list
        ))
        
        setSuccessMessage(languageCode === 'tr' 
          ? `Liste ${!currentStatus ? 'herkese açık' : 'özel'} yapıldı`
          : `List made ${!currentStatus ? 'public' : 'private'}`
        )
      } else {
        throw new Error('Failed to update list')
      }
    } catch (error) {
      console.error('Error updating public status:', error)
      setSuccessMessage(languageCode === 'tr' 
        ? 'Liste durumu güncellenirken hata oluştu'
        : 'Error updating list status')
    } finally {
      setUpdatingPublicStatus(null)
    }
  }
  const handleTogglePublishStatus = async (listId: string, currentStatus: boolean) => {
    try {
      setUpdatingPublicStatus(listId)
      
      const success = await databaseService.updateShareList(listId, {
        is_published: !currentStatus
      })
      
      if (success) {
        // Update local state
        setUserLists(prev => prev.map(list => 
          list.id === listId 
            ? { ...list, is_published: !currentStatus }
            : list
        ))
        
        setSuccessMessage(languageCode === 'tr' 
          ? `Liste ${!currentStatus ? 'yayınlandı' : 'taslak yapıldı'}`
          : `List ${!currentStatus ? 'published' : 'made draft'}`
        )
      } else {
        throw new Error('Failed to update list')
      }
    } catch (error) {
      console.error('Error updating publish status:', error)
      setError(languageCode === 'tr' 
        ? 'Liste durumu güncellenirken hata oluştu'
        : 'Error updating list status')
    } finally {
      setUpdatingPublicStatus(null)
    }
  }

  const handleShareListLink = async (list: ShareList) => {
    const shareUrl = `${window.location.origin}/${languageCode}/share/${list.slug || list.id}`

    try {
      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share({
          title: list.name,
          text: list.description || (languageCode === 'tr' ? 'Öneri listeme göz atın!' : 'Check out my suggestion list!'),
          url: shareUrl
        })
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl)
        setCopiedListId(list.id)
        setTimeout(() => setCopiedListId(null), 2000)
      }
    } catch (error) {
      // If share fails, try clipboard
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopiedListId(list.id)
        setTimeout(() => setCopiedListId(null), 2000)
      } catch (clipboardError) {
        console.error('Error sharing/copying:', clipboardError)
      }
    }
  }

  const handleCopyProfileLink = async () => {
    try {
      const displayName = userProfile?.display_name
      if (!displayName) {
        setError(languageCode === 'tr'
          ? 'Kullanıcı adı bulunamadı. Lütfen profil ayarlarınızı kontrol edin.'
          : 'Display name not found. Please check your profile settings.')
        return
      }

      const profileUrl = `${window.location.origin}/${languageCode}/u/${displayName}/my-suggestion-lists`

      await navigator.clipboard.writeText(profileUrl)
      setCopiedProfileLink(true)

      // Reset after 2 seconds
      setTimeout(() => setCopiedProfileLink(false), 2000)

      setSuccessMessage(languageCode === 'tr'
        ? 'Liste sayfası bağlantısı kopyalandı!'
        : 'Lists page link copied!')

    } catch (error) {
      console.error('Error copying profile link:', error)
      setError(languageCode === 'tr'
        ? 'Bağlantı kopyalanırken hata oluştu'
        : 'Error copying link')
    }
  }

  const handleViewList = (list: ShareList, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (list.item_count === 0) {
      setSuccessMessage(languageCode === 'tr' 
        ? 'Listeniz boş. Önce içerik eklemelisiniz.'
        : 'Your list is empty. Please add content first.')
      return
    }
    
    // Show list content in modal
    setSelectedListForDisplay(list)
    setShowListContentModal(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(languageCode === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Don't render anything while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Don't render if user is not authenticated (will redirect)
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:justify-between items-center">
          <h1 className="text-3xl font-bold text-white text-center md:text-left mb-4 md:mb-0">
            {languageCode === 'tr' ? 'Öneri Listelerim' : 'My Suggestion Lists'}
          </h1>
          <div className="flex flex-col sm:flex-row sm:space-x-4 w-full justify-center md:justify-end">
            {/* Open My Page Button */}
            {userProfile?.display_name && (
              <Link
                to={`/${languageCode}/u/${userProfile.display_name}/my-suggestion-lists`}
                target="_blank"
                className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
              >
                <Eye className="w-5 h-5 mr-2" />
                {languageCode === 'tr' ? 'Sayfamı Aç' :
                 languageCode === 'de' ? 'Meine Seite öffnen' :
                 languageCode === 'fr' ? 'Ouvrir ma page' :
                 languageCode === 'es' ? 'Abrir mi página' :
                 languageCode === 'it' ? 'Apri la mia pagina' :
                 'Open My Page'}
              </Link>
            )}
            <button
              onClick={handleCreateList}
              className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors mt-3 sm:mt-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              {languageCode === 'tr' ? 'Yeni Liste' :
               languageCode === 'de' ? 'Neue Liste' :
               languageCode === 'fr' ? 'Nouvelle liste' :
               languageCode === 'es' ? 'Nueva lista' :
               languageCode === 'it' ? 'Nuova lista' :
               'New List'}
            </button>
          </div>
          
          {/* Sorting Controls */}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mb-6 flex items-start">
            <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-green-400">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                  <div className="flex space-x-2">
                    <div className="h-8 w-8 bg-gray-700 rounded"></div>
                    <div className="h-8 w-8 bg-gray-700 rounded"></div>
                    <div className="h-8 w-8 bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : userLists.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">
                {languageCode === 'tr' ? 'Henüz Liste Yok' : 'No Lists Yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {languageCode === 'tr' 
                  ? 'İlk özel listenizi oluşturun ve favori film ve dizilerinizi organize edin.'
                  : 'Create your first custom list and organize your favorite movies and TV shows.'}
              </p>
              <button
                onClick={handleCreateList}
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors mx-auto"
              >
                <Plus className="w-5 h-5 mr-2" />
                {languageCode === 'tr' ? 'İlk Listeni Oluştur' : 'Create Your First List'}
              </button>
            </div>
          </div>
        ) : (
          /* Lists Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userLists.map((list) => (
              <div key={list.id} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors border border-gray-700">
                {/* Header with title and public/private toggle */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white mb-1 line-clamp-1">{getLocalizedListName(list, languageCode)}</h3>
                    <div className="flex items-center text-xs text-gray-400 mb-2">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{formatDate(list.created_at)}</span>
                      <span className="mx-2">•</span>
                      {!list.is_published && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="text-yellow-400 text-xs">
                            {languageCode === 'tr' ? 'Taslak' : 'Draft'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Public/Private and Publish Toggles */}
                  <div className="flex flex-col items-end">
                    {/* Publish Toggle */}
                    <div className="flex flex-col items-end">
                      <button
                        onClick={() => handleTogglePublishStatus(list.id, list.is_published || false)}
                        disabled={updatingPublicStatus === list.id}
                        className={`w-10 h-5 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${
                          list.is_published ? 'bg-blue-600 justify-end' : 'bg-gray-600 justify-start'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full transform transition-transform ${
                          list.is_published ? 'bg-white translate-x-[-2px]' : 'bg-gray-300 translate-x-[2px]'
                        }`}>
                          {updatingPublicStatus === list.id ? (
                            <div className="w-full h-full border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : list.is_published ? (
                            <Check className="w-2 h-2 text-blue-600 m-auto" />
                          ) : null}
                        </div>
                      </button>
                      <span className="text-xs text-gray-400 mt-1">
                        {list.is_published 
                          ? (languageCode === 'tr' ? 'Yayında' : 'Published')
                          : (languageCode === 'tr' ? 'Taslak' : 'Draft')
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Description */}
                {getLocalizedListDescription(list, languageCode) && (
                  <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                    {getLocalizedListDescription(list, languageCode)}
                  </p>
                )}
                
                {/* Action buttons */}
                <div className="flex items-center justify-end space-x-2 mt-4">
                  {/* Add Content button */}
                  <button
                    onClick={() => handleAddContent(list)}
                    className="p-2 text-gray-400 hover:text-primary-400 hover:bg-primary-900/20 rounded-lg transition-colors"
                    title={languageCode === 'tr' ? 'İçerik Ekle' : 'Add Content'}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  
                  {/* View button - only show if list has content */}
                  {list.item_count && list.item_count > 0 && (
                    <button
                      onClick={(e) => handleViewList(list, e)}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={languageCode === 'tr' ? 'Listeyi Görüntüle' : 'View List'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Share button - only show for public lists */}
                  {list.is_public && list.is_published && (
                    <button
                      onClick={() => handleShareListLink(list)}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={languageCode === 'tr' ? 'Listeyi Paylaş' : 'Share List'}
                    >
                      {copiedListId === list.id ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  
                  {/* Edit button */}
                  <button
                    onClick={() => handleEditList(list)}
                    className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                    title={languageCode === 'tr' ? 'Düzenle' : 'Edit'}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  {/* Delete button */}
                  {deleteConfirm === list.id ? (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleDeleteList(list.id)}
                        disabled={deleteLoading}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title={languageCode === 'tr' ? 'Silmeyi Onayla' : 'Confirm Delete'}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelDelete}
                        disabled={deleteLoading}
                        className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                        title={languageCode === 'tr' ? 'İptal' : 'Cancel'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      title={languageCode === 'tr' ? 'Sil' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingList 
                    ? (languageCode === 'tr' ? 'Listeyi Düzenle' : 'Edit List')
                    : (languageCode === 'tr' ? 'Yeni Liste Oluştur' : 'Create New List')
                  }
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveList} className="space-y-4">
                {/* List Name */}
                <div>
                  <label htmlFor="listName" className="block text-sm font-medium text-gray-300 mb-1">
                    {languageCode === 'tr' ? 'Liste Adı' : 'List Name'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="listName"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={languageCode === 'tr' ? 'Örn: Favori Aksiyon Filmleri' : 'e.g. Favorite Action Movies'}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="listDescription" className="block text-sm font-medium text-gray-300 mb-1">
                    {languageCode === 'tr' ? 'Açıklama' : 'Description'}
                  </label>
                  <textarea
                    id="listDescription"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={languageCode === 'tr' ? 'Bu liste hakkında kısa bir açıklama...' : 'A short description about this list...'}
                    rows={3}
                  />
                </div>

                {/* Public/Private Toggle */}

                {/* Publish Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      {languageCode === 'tr' ? 'Yayınla' : 'Publish'}
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      {languageCode === 'tr' 
                        ? 'Liste hazır olduğunda yayınlayın'
                        : 'Publish when your list is ready'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormIsPublished(!formIsPublished)}
                    className={`w-12 h-6 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${
                      formIsPublished ? 'bg-blue-500 justify-end' : 'bg-gray-600 justify-start'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full transform transition-transform ${
                      formIsPublished ? 'bg-white translate-x-[-4px]' : 'bg-gray-300 translate-x-[4px]'
                    }`}>
                      {formIsPublished && <Check className="w-3 h-3 text-blue-500 m-auto" />}
                    </div>
                  </button>
                </div>

                {/* Error Message */}
                {formError && (
                  <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 flex items-start">
                    <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-red-400 text-sm">{formError}</span>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {languageCode === 'tr' ? 'İptal' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading || !formName.trim()}
                    className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        {languageCode === 'tr' ? 'Kaydediliyor...' : 'Saving...'}
                      </>
                    ) : (
                      editingList 
                        ? (languageCode === 'tr' ? 'Öneri Listesini Güncelle' : 'Update Suggestion List')
                        : (languageCode === 'tr' ? 'Öneri Listesi Oluştur' : 'Create Suggestion List')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      
        {/* Add Content Modal */}
        {showAddContentModal && selectedListForContent && (
          <AddContentToListModal
            isOpen={showAddContentModal}
            onClose={() => {
              setShowAddContentModal(false)
              setSelectedListForContent(null)
            }}
            listId={selectedListForContent.id}
            listName={selectedListForContent.name}
            onContentChangeInList={(listId, contentId, contentType, added) => {
              // Update the specific list's item count immediately
              setUserLists(prev => prev.map(list => {
                if (list.id === listId) {
                  const newCount = Math.max((list.item_count || 0) + (added ? 1 : -1), 0)
                  console.log(`Updating list ${listId} count from ${list.item_count} to ${newCount}`)
                  return { ...list, item_count: newCount }
                }
                return list
              }))
              // Also reload lists to get updated data from server
              setTimeout(() => loadUserLists(), 100)
            }}
          />
        )}
      
        {/* List Content Display Modal */}
        {showListContentModal && selectedListForDisplay && (
          <ListContentDisplayModal
            isOpen={showListContentModal}
            onClose={() => {
              setShowListContentModal(false)
              setSelectedListForDisplay(null)
            }}
            listId={selectedListForDisplay.id}
            listName={selectedListForDisplay.name}
            onContentRemoved={() => {
              // Update the specific list's item count immediately
              if (selectedListForDisplay) {
                setUserLists(prev => prev.map(list => 
                  list.id === selectedListForDisplay.id 
                    ? { ...list, item_count: Math.max((list.item_count || 0) - 1, 0) }
                    : list
                ))
              }
              // Also reload lists to get updated data from server
              setTimeout(() => loadUserLists(), 100)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default MyListsPage