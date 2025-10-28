import React, { useState, useEffect } from 'react';
import { X, Folder, FolderPlus, Check, Loader2, AlertCircle, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTranslation } from '../lib/i18n';
import { databaseService, ShareList } from '../lib/database';

interface ShareListSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: number;
  contentType: 'movie' | 'tv_show';
  onContentChangeInList?: (listId: string, contentId: number, contentType: 'movie' | 'tv_show', added: boolean) => void;
}

export default function ShareListSelectModal({
  isOpen,
  onClose,
  contentId,
  contentType,
  onContentChangeInList,
}: ShareListSelectModalProps) {
  const { user } = useAuth();
  const { languageCode } = useUserPreferences();
  const { t } = useTranslation(languageCode);

  const [userLists, setUserLists] = useState<ShareList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listContentStatus, setListContentStatus] = useState<Map<string, boolean>>(new Map());
  const [savingListId, setSavingListId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListIsPublic, setNewListIsPublic] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !user) return;

      setLoading(true);
      setError(null);

      try {
        const lists = await databaseService.getShareLists(user.id);
        setUserLists(lists);

        // Fetch all share_list_items for the current content
        const { data: contentShareItems, error: itemsError } = await databaseService.supabase
          .from('share_list_items')
          .select('list_id')
          .eq('content_id', contentId)
          .eq('content_type', contentType);

        if (itemsError) throw itemsError;

        const currentStatusMap = new Map<string, boolean>();
        const contentInLists = new Set(contentShareItems?.map(item => item.list_id) || []);

        lists.forEach(list => {
          currentStatusMap.set(list.id, contentInLists.has(list.id));
        });
        setListContentStatus(currentStatusMap);

      } catch (err: any) {
        console.error('Error loading share lists or content status:', err);
        setError(err.message || (languageCode === 'tr' ? 'Listeler yüklenirken hata oluştu' : 'Error loading lists'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, user, contentId, contentType, languageCode]);

  const handleToggleList = async (listId: string, isChecked: boolean) => {
    if (!user) return;

    setSavingListId(listId);
    setError(null);

    try {
      let success = false;
      if (isChecked) {
        success = await databaseService.addContentToShareList(listId, contentId, contentType);
      } else {
        success = await databaseService.removeContentFromShareList(listId, contentId, contentType);
      }

      if (success) {
        setListContentStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(listId, isChecked);
          return newMap;
        });
        
        // Show confirmation message
        const list = userLists.find(l => l.id === listId);
        const listName = list?.name || 'Liste';
        const message = isChecked 
          ? (languageCode === 'tr' ? `"${listName}" listesine eklendi` : `Added to "${listName}"`)
          : (languageCode === 'tr' ? `"${listName}" listesinden çıkarıldı` : `Removed from "${listName}"`);
        
        setConfirmationMessage(message);
        
        // Clear message after 3 seconds
        setTimeout(() => {
          setConfirmationMessage(null);
        }, 3000);
        
        // Notify parent component about the change
        if (onContentChangeInList) {
          onContentChangeInList(list.id, contentId, contentType, isChecked);
        }
      } else {
        setError(languageCode === 'tr' ? 'Değişiklikler kaydedilirken hata oluştu' : 'Error saving changes');
      }
    } catch (err: any) {
      console.error('Error toggling content in list:', err);
      setError(err.message || (languageCode === 'tr' ? 'Değişiklikler kaydedilirken hata oluştu' : 'Error saving changes'));
    } finally {
      setSavingListId(null);
    }
  };

  const handleCreateNewList = async () => {
    if (!user || !newListName.trim()) {
      setCreateError(languageCode === 'tr' ? 'Liste adı gereklidir' : 'List name is required');
      return;
    }

    setCreatingList(true);
    setCreateError(null);

    try {
      // Create new list
      const newList = await databaseService.createShareList(
        user.id,
        newListName.trim(),
        newListDescription.trim() || undefined,
        newListIsPublic
      );

      if (newList) {
        // Add content to the new list
        const success = await databaseService.addContentToShareList(newList.id, contentId, contentType);
        
        if (success) {
          // Show confirmation message
          const message = languageCode === 'tr' 
            ? `"${newList.name}" listesi oluşturuldu ve içerik eklendi`
            : `"${newList.name}" created and content added`;
          
          setConfirmationMessage(message);
          
          // Close modal after showing message briefly
          setTimeout(() => {
            setConfirmationMessage(null);
            onClose();
          }, 2000);
          
          // Notify parent component about the change
          if (onContentChangeInList) {
            onContentChangeInList(newList.id, contentId, contentType, true);
          }
          
          // Close modal and reset form
          setNewListName('');
          setNewListDescription('');
          setNewListIsPublic(false);
          setShowCreateForm(false);
        } else {
          setCreateError(languageCode === 'tr' ? 'İçerik listeye eklenirken hata oluştu' : 'Error adding content to list');
        }
      } else {
        setCreateError(languageCode === 'tr' ? 'Liste oluşturulurken hata oluştu' : 'Error creating list');
      }
    } catch (err: any) {
      console.error('Error creating new list:', err);
      setCreateError(err.message || (languageCode === 'tr' ? 'Bir hata oluştu' : 'An error occurred'));
    } finally {
      setCreatingList(false);
    }
  };
  
  // Clear confirmation message when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmationMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6 text-center">
          {languageCode === 'tr' ? 'Öneri Listelerime Ekle' : 'Add to Suggestion Lists'}
        </h2>
        
        {/* Confirmation Message */}
        {confirmationMessage && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-3 mb-4 flex items-center">
            <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
            <span className="text-green-400 text-sm">{confirmationMessage}</span>
          </div>
        )}

        {showCreateForm ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="newListName" className="block text-sm font-medium text-gray-300 mb-1">
                {languageCode === 'tr' ? 'Liste Adı' : 'List Name'} <span className="text-red-400">*</span>
              </label>
              <input
                id="newListName"
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={languageCode === 'tr' ? 'Örn: Favori Aksiyon Filmleri' : 'e.g. Favorite Action Movies'}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="newListDescription" className="block text-sm font-medium text-gray-300 mb-1">
                {languageCode === 'tr' ? 'Açıklama (İsteğe bağlı)' : 'Description (Optional)'}
              </label>
              <textarea
                id="newListDescription"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={languageCode === 'tr' ? 'Bu liste hakkında kısa bir açıklama...' : 'A short description about this list...'}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">
                  {languageCode === 'tr' ? 'Herkese Açık' : 'Public'}
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  {languageCode === 'tr' 
                    ? 'Diğer kullanıcılar bu listeyi görebilir'
                    : 'Other users can view this list'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewListIsPublic(!newListIsPublic)}
                className={`w-12 h-6 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${
                  newListIsPublic ? 'bg-primary-500 justify-end' : 'bg-gray-600 justify-start'
                }`}
              >
                <div className={`w-5 h-5 rounded-full transform transition-transform ${
                  newListIsPublic ? 'bg-white translate-x-[-4px]' : 'bg-gray-300 translate-x-[4px]'
                }`}>
                  {newListIsPublic && <Check className="w-3 h-3 text-primary-500 m-auto" />}
                </div>
              </button>
            </div>

            {createError && (
              <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 flex items-start">
                <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-red-400 text-sm">{createError}</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewListName('');
                  setNewListDescription('');
                  setNewListIsPublic(false);
                  setCreateError(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
              >
                {languageCode === 'tr' ? 'Geri' : 'Back'}
              </button>
              <button
                onClick={handleCreateNewList}
                disabled={creatingList || !newListName.trim()}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingList ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {languageCode === 'tr' ? 'Öneri Listesi Oluşturuluyor...' : 'Creating Suggestion List...'}
                  </>
                ) : (
                  languageCode === 'tr' ? 'Öneri Listesi Oluştur ve Ekle' : 'Create Suggestion List & Add'
                )}
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-3 text-gray-300">{t.loading}</span>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-red-400">{error}</span>
          </div>
        ) : userLists.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">
              {languageCode === 'tr' ? 'Henüz özel liste oluşturmadınız.' : 'You haven\'t created any custom lists yet.'}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {languageCode === 'tr' ? 'İlk Listemi Oluştur' : 'Create First List'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {/* Create New List Button */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center bg-primary-500 hover:bg-primary-600 text-white p-3 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              {languageCode === 'tr' ? 'Yeni Öneri Listesi Oluştur' : 'Create New Suggestion List'}
            </button>
            
            {/* Existing Lists */}
            {userLists.map(list => (
              <div
                key={list.id}
                className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="mr-3">
                    <Folder className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{list.name}</p>
                  </div>
                </div>
                {listContentStatus.get(list.id) ? (
                  <button
                    onClick={() => handleToggleList(list.id, false)}
                    disabled={savingListId === list.id}
                    className="bg-green-600 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    title={languageCode === 'tr' ? 'Listeden çıkar' : 'Remove from list'}
                  >
                    {savingListId === list.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {languageCode === 'tr' ? 'Çıkarılıyor...' : 'Removing...'}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {languageCode === 'tr' ? 'Eklendi' : 'Added'}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleList(list.id, true)}
                    disabled={savingListId === list.id}
                    className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingListId === list.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {languageCode === 'tr' ? 'Ekleniyor...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        {languageCode === 'tr' ? 'Ekle' : 'Add'}
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}