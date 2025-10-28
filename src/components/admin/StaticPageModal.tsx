import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAdmin } from '../../contexts/AdminContext';
import { StaticPage } from '../../lib/database';
import Modal from './Modal';
import LanguageTabs from './LanguageTabs';
import LoadingSpinner from './LoadingSpinner';

interface StaticPageModalProps {
  page: StaticPage | null;
  onClose: () => void;
  onSave: () => void;
}

interface FormData {
  slug: string;
  is_published: boolean;
  translations: {
    [key: string]: {
      title: string;
      content: string;
      meta_description: string;
    };
  };
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' }
];

const StaticPageModal: React.FC<StaticPageModalProps> = ({ page, onClose, onSave }) => {
  const { user } = useAuth();
  const { logAdminAction } = useAdmin();
  const [activeLanguage, setActiveLanguage] = useState('en');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    slug: '',
    is_published: false,
    translations: {}
  });

  useEffect(() => {
    if (page) {
      const translations: FormData['translations'] = {};

      LANGUAGES.forEach(lang => {
        const titleTranslations = page.title_translations || {};
        const contentTranslations = page.content_translations || {};
        const metaTranslations = page.meta_description_translations || {};

        translations[lang.code] = {
          title: lang.code === 'en' ? page.title : (titleTranslations[lang.code] || ''),
          content: lang.code === 'en' ? page.content : (contentTranslations[lang.code] || ''),
          meta_description: lang.code === 'en' ? (page.meta_description || '') : (metaTranslations[lang.code] || '')
        };
      });

      setFormData({
        slug: page.slug,
        is_published: page.is_published,
        translations
      });
    } else {
      const initialTranslations: FormData['translations'] = {};
      LANGUAGES.forEach(lang => {
        initialTranslations[lang.code] = {
          title: '',
          content: '',
          meta_description: ''
        };
      });

      setFormData({
        slug: '',
        is_published: false,
        translations: initialTranslations
      });
    }
  }, [page]);

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLanguage]: {
          ...prev.translations[activeLanguage],
          title: value
        }
      }
    }));

    if (activeLanguage === 'en' && !page && !formData.slug) {
      setFormData(prev => ({
        ...prev,
        slug: generateSlug(value)
      }));
    }
  };

  const handleContentChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLanguage]: {
          ...prev.translations[activeLanguage],
          content: value
        }
      }
    }));
  };

  const handleMetaChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLanguage]: {
          ...prev.translations[activeLanguage],
          meta_description: value
        }
      }
    }));
  };

  const handleSave = async () => {
    if (!formData.translations.en.title || !formData.translations.en.content) {
      alert('English title and content are required');
      return;
    }

    if (!formData.slug) {
      alert('Slug is required');
      return;
    }

    try {
      setSaving(true);

      const titleTranslations: Record<string, string> = {};
      const contentTranslations: Record<string, string> = {};
      const metaTranslations: Record<string, string> = {};

      LANGUAGES.forEach(lang => {
        const trans = formData.translations[lang.code];
        if (trans.title) titleTranslations[lang.code] = trans.title;
        if (trans.content) contentTranslations[lang.code] = trans.content;
        if (trans.meta_description) metaTranslations[lang.code] = trans.meta_description;
      });

      const pageData = {
        slug: formData.slug,
        title: formData.translations.en.title,
        content: formData.translations.en.content,
        meta_description: formData.translations.en.meta_description || null,
        is_published: formData.is_published,
        title_translations: titleTranslations,
        content_translations: contentTranslations,
        meta_description_translations: metaTranslations,
        updated_by: user?.id,
        updated_at: new Date().toISOString()
      };

      if (page) {
        const { error } = await supabase
          .from('static_pages')
          .update(pageData)
          .eq('id', page.id);

        if (error) throw error;

        await logAdminAction('update_static_page', 'static_page', page.id, {
          slug: formData.slug,
          title: formData.translations.en.title
        });
      } else {
        const { error } = await supabase
          .from('static_pages')
          .insert({
            ...pageData,
            created_by: user?.id
          });

        if (error) throw error;

        await logAdminAction('create_static_page', 'static_page', formData.slug, {
          slug: formData.slug,
          title: formData.translations.en.title
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving page:', error);
      if (error.code === '23505') {
        alert('A page with this slug already exists');
      } else {
        alert('Failed to save page');
      }
    } finally {
      setSaving(false);
    }
  };

  const getTranslationStatus = (): Record<string, boolean> => {
    const status: Record<string, boolean> = {};
    LANGUAGES.forEach(lang => {
      const trans = formData.translations[lang.code];
      status[lang.code] = !!(trans?.title && trans?.content);
    });
    return status;
  };

  const currentTranslation = formData.translations[activeLanguage] || {
    title: '',
    content: '',
    meta_description: ''
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={page ? 'Edit Static Page' : 'Create Static Page'}
      size="xl"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Page
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Slug *
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
              placeholder="about-us"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-gray-300">Published</span>
            </label>
          </div>
        </div>

        <div>
          <LanguageTabs
            languages={LANGUAGES}
            activeLanguage={activeLanguage}
            onLanguageChange={setActiveLanguage}
            translationStatus={getTranslationStatus()}
          />

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title {activeLanguage === 'en' && '*'}
              </label>
              <input
                type="text"
                value={currentTranslation.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                placeholder={`Enter title in ${LANGUAGES.find(l => l.code === activeLanguage)?.label}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Content {activeLanguage === 'en' && '*'}
              </label>
              <textarea
                value={currentTranslation.content}
                onChange={(e) => handleContentChange(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 resize-none font-mono text-sm"
                placeholder="Enter content (Markdown supported)"
              />
              <p className="mt-1 text-xs text-gray-400">Supports Markdown formatting</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Meta Description
              </label>
              <textarea
                value={currentTranslation.meta_description}
                onChange={(e) => handleMetaChange(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 resize-none"
                placeholder="SEO meta description (recommended: 150-160 characters)"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StaticPageModal;
