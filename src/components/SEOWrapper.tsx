import React from 'react'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import SEOHead from './SEOHead'

const SEOWrapper: React.FC = () => {
  const { languageCode } = useUserPreferences()

  return <SEOHead languageCode={languageCode} />
}

export default SEOWrapper
