import React from 'react';

interface LanguageTabsProps {
  languages: { code: string; label: string }[];
  activeLanguage: string;
  onLanguageChange: (code: string) => void;
  translationStatus?: Record<string, boolean>;
}

const LanguageTabs: React.FC<LanguageTabsProps> = ({
  languages,
  activeLanguage,
  onLanguageChange,
  translationStatus
}) => {
  return (
    <div className="border-b border-gray-700">
      <div className="flex space-x-1">
        {languages.map((lang) => {
          const hasTranslation = translationStatus?.[lang.code];
          const isActive = activeLanguage === lang.code;

          return (
            <button
              key={lang.code}
              onClick={() => onLanguageChange(lang.code)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                isActive
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {lang.label}
              {translationStatus && (
                <span className={`ml-2 inline-block w-2 h-2 rounded-full ${
                  hasTranslation ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageTabs;
