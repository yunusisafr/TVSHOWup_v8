import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { StaticPage } from '../../lib/database';
import Modal from './Modal';

interface StaticPagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: StaticPage;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' }
];

const StaticPagePreviewModal: React.FC<StaticPagePreviewModalProps> = ({ isOpen, onClose, page }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const getContent = () => {
    if (selectedLanguage === 'en') {
      return {
        title: page.title,
        content: page.content,
        meta_description: page.meta_description
      };
    }

    const titleTranslations = page.title_translations || {};
    const contentTranslations = page.content_translations || {};
    const metaTranslations = page.meta_description_translations || {};

    return {
      title: titleTranslations[selectedLanguage] || page.title,
      content: contentTranslations[selectedLanguage] || page.content,
      meta_description: metaTranslations[selectedLanguage] || page.meta_description
    };
  };

  const content = getContent();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Page Preview"
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">Preview Language</h3>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
          >
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div className="border border-gray-700 rounded-lg p-6 bg-gray-900">
          <h1 className="text-3xl font-bold text-white mb-4">{content.title}</h1>
          {content.meta_description && (
            <p className="text-gray-400 italic mb-6">{content.meta_description}</p>
          )}
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-white mt-6 mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold text-white mt-5 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-bold text-white mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2">{children}</ol>,
                li: ({ children }) => <li className="text-gray-300">{children}</li>,
                a: ({ children, href }) => <a href={href} className="text-primary-400 hover:text-primary-300 underline">{children}</a>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-500 pl-4 italic text-gray-400 my-4">{children}</blockquote>,
                code: ({ children }) => <code className="bg-gray-800 text-primary-300 px-1 py-0.5 rounded text-sm">{children}</code>,
                pre: ({ children }) => <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>
              }}
            >
              {content.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StaticPagePreviewModal;
