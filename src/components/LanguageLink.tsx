import React from 'react'
import { Link, LinkProps, useLocation } from 'react-router-dom'
import { getLanguageFromPath, buildLanguagePath, DEFAULT_LANGUAGE } from '../lib/utils'

interface LanguageLinkProps extends Omit<LinkProps, 'to'> {
  to: string
  lang?: string
}

const LanguageLink: React.FC<LanguageLinkProps> = ({ to, lang, ...props }) => {
  const location = useLocation()

  const currentLang = lang || getLanguageFromPath(location.pathname) || DEFAULT_LANGUAGE

  const languageAwarePath = to.startsWith('http') || to.startsWith('#') || to.startsWith('mailto:')
    ? to
    : buildLanguagePath(to, currentLang)

  return <Link to={languageAwarePath} {...props} />
}

export default LanguageLink
