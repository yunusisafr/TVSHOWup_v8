import React, { useState } from 'react'
import { Search, User, LogOut, Settings, List, Globe, Shield, Languages, Share2 } from 'lucide-react'
import { getLogoUrl } from '../lib/assets'
import { useAuth } from '../contexts/AuthContext'
import { useAdmin } from '../contexts/AdminContext'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { isAdminRoute, getLanguageFromPath } from '../lib/utils'
import { Link } from 'react-router-dom'
import LanguageLink from './LanguageLink'
import SearchDropdown from './SearchDropdown'
import SmartSearchBar from './SmartSearchBar'
import { useNavigate } from 'react-router-dom';
import { useRef, useEffect } from 'react';

interface HeaderProps {
  onSearch?: (query: string) => void
}

const Header: React.FC<HeaderProps> = ({ onSearch = () => {} }) => {
  const { user, signOut, userProfile } = useAuth()
  const { isAdmin, adminRole } = useAdmin()
  const { countryCode, languageCode, setCountryCode, getCountryName, getSupportedCountries, isLoading: preferencesLoading } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showCountryMenu, setShowCountryMenu] = useState(false)
  const [countrySearchQuery, setCountrySearchQuery] = useState('')
  const navigate = useNavigate();
  
  // Refs for click outside detection
  const countryMenuRef = useRef<HTMLDivElement>(null)
  const countryButtonRef = useRef<HTMLButtonElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userButtonRef = useRef<HTMLButtonElement>(null)
  
  // Don't render until preferences are loaded
  if (preferencesLoading) {
    return (
      <header className="bg-gray-900 text-white shadow-lg fixed top-0 left-0 right-0 z-[9999]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1 md:py-0">
          <div className="flex items-center justify-center h-16">
            <div className="text-white">Loading...</div>
          </div>
        </div>
      </header>
    )
  }
  
  // Format the country/language display
  const getLocationDisplay = () => {
    return countryCode ? countryCode.toUpperCase() : 'US'
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    setShowCountryMenu(false);
    // Language will be automatically updated by UserPreferencesContext
  }

  // Close other menu when opening one
  const toggleCountryMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUserMenu(false);
    setShowCountryMenu(!showCountryMenu);
    if (!showCountryMenu) {
      setCountrySearchQuery('');
    }
  }
  
  const toggleUserMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCountryMenu(false);
    setCountrySearchQuery('');
    setShowUserMenu(!showUserMenu);
  }

  // Filter countries based on search query
  const supportedCountries = getSupportedCountries()
  const filteredCountries = Object.fromEntries(
    Object.entries(supportedCountries).filter(([code, name]) =>
      name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
      code.toLowerCase().includes(countrySearchQuery.toLowerCase())
    )
  )

  return (
    <header className="bg-gray-900 text-white shadow-lg fixed top-0 left-0 right-0 z-[9999]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1 md:py-0">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 h-auto md:h-16">
          {/* Logo */}
          <div className="flex items-center justify-between py-3 md:py-0 md:w-auto">
            <LanguageLink
              to="/"
              className="flex items-center flex-shrink-0 md:mr-4"
              onClick={(e) => {
                const currentPath = window.location.pathname
                const urlLang = getLanguageFromPath(currentPath) || languageCode
                const isHomePage = currentPath === `/${urlLang}` || currentPath === '/' || currentPath === `/${urlLang}/`

                if (isHomePage) {
                  e.preventDefault()
                  window.location.href = `/${languageCode}`
                }
              }}
            >
              <img
                src={getLogoUrl()}
                alt="TVSHOWup"
                className="h-11"
                loading="eager"
              />
            </LanguageLink>
            
            {/* Right side - User menu (mobile only) */}
            <div className="flex items-center space-x-2 md:hidden">
              {/* Country Switcher - Mobile */}
              <div className="relative">
                <button
                  ref={countryButtonRef}
                  onClick={toggleCountryMenu}
                  className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  aria-label={t.changeCountry}
                >
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="text-xs uppercase">{countryCode}</span>
                </button>
              </div>
              
              {/* User menu - Mobile */}
              {user ? (
                <div className="relative">
                  <button
                    ref={userButtonRef}
                    onClick={toggleUserMenu}
                    className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors cursor-pointer relative z-10 overflow-hidden"
                    aria-label={t.changeCountry}
                  >
                    {userProfile?.avatar_url ? (
                      <img 
                        src={`${userProfile.avatar_url}${userProfile.avatar_url.includes('?') ? '&' : '?'}t=${Date.now()}`} 
                        alt={userProfile.display_name || 'User'} 
                        className="w-7 h-7 rounded-full object-cover border border-gray-600 bg-gray-700"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '';
                          e.currentTarget.style.display = 'none';
                          // Text initial fallback
                          e.currentTarget.parentElement!.innerHTML = `
                            <div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                              <span class="text-white text-sm font-medium">${(userProfile?.display_name || 'U').charAt(0).toUpperCase()}</span>
                            </div>
                          `;
                        }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {(userProfile?.display_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <LanguageLink
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    {t.signInButton}
                  </LanguageLink>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Search Bar */}
          <div className="w-full pb-2 md:pb-0 md:flex-1 md:max-w-lg mx-auto">
            <SearchDropdown onSearch={onSearch} />
          </div>

          {/* Right side - User menu (desktop only) */}
          <div className="hidden md:flex items-center space-x-4 flex-shrink-0">            
            {/* Country Switcher - Desktop */}
            <div className="relative">
              <button
                ref={countryButtonRef}
                onClick={toggleCountryMenu}
                className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
                aria-label={t.changeCountry}
              >
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-xs uppercase">{countryCode}</span>
              </button>
              
              {showCountryMenu && (
                <div 
                  ref={countryMenuRef} 
                  className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-md shadow-lg py-1 z-[1001] max-h-80 overflow-hidden border border-gray-700" 
                  style={{ minWidth: '256px', pointerEvents: 'auto' }}
                >                  
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-700">
                    <input
                      type="text"
                      value={countrySearchQuery}
                      onChange={(e) => setCountrySearchQuery(e.target.value)}
                      placeholder={languageCode === 'tr' ? 'Ülke ara...' :
                                   languageCode === 'de' ? 'Land suchen...' :
                                   languageCode === 'fr' ? 'Rechercher un pays...' :
                                   languageCode === 'es' ? 'Buscar país...' :
                                   languageCode === 'it' ? 'Cerca paese...' :
                                   'Search country...'}
                      className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  
                  {/* Countries List */}
                  <div className="max-h-60 overflow-y-auto">
                    {Object.entries(filteredCountries).map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => {
                          handleCountryChange(code);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm transition-colors ${
                          countryCode === code ? 'text-primary-400 font-medium bg-primary-900/20' : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span className="mr-2 text-xs font-mono text-gray-500">{code}</span>
                        {name}
                      </button>
                    ))}
                    
                    {Object.keys(filteredCountries).length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-400 text-center">
                        {languageCode === 'tr' ? 'Ülke bulunamadı' :
                         languageCode === 'de' ? 'Kein Land gefunden' :
                         languageCode === 'fr' ? 'Aucun pays trouvé' :
                         languageCode === 'es' ? 'No se encontró país' :
                         languageCode === 'it' ? 'Nessun paese trovato' :
                         'No country found'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {user ? (
              <div className="relative">
                <button
                  ref={userButtonRef}
                  onClick={toggleUserMenu}
                  className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors cursor-pointer relative z-10"
                >
                  {userProfile?.avatar_url && userProfile.avatar_url.trim() !== '' ? (
                    <img 
                      src={`${userProfile.avatar_url}${userProfile.avatar_url.includes('?') ? '&' : '?'}t=${Date.now()}`}
                      alt={userProfile.display_name || 'User'} 
                      className="w-7 h-7 rounded-full object-cover border border-gray-600"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '';
                        e.currentTarget.style.display = 'none';
                        // Text initial fallback
                        e.currentTarget.parentElement!.innerHTML = `
                          <div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                            <span class="text-white text-sm font-medium">${(userProfile?.display_name || 'U').charAt(0).toUpperCase()}</span>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {(userProfile?.display_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {isAdmin && (
                    <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {adminRole?.toUpperCase() || 'ADMIN'}
                    </span>
                  )}
                </button>

                {showUserMenu && (
                  <div 
                    ref={userMenuRef}
                    className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-[10002]"
                  >
                    <LanguageLink
                      to="/watchlist"
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                      onClick={() => {
                        setShowUserMenu(false);
                      }}
                    >
                      <List className="w-4 h-4 mr-3" />
                      {t.myWatchlist}
                    </LanguageLink>
                    <LanguageLink
                      to="/my-lists"
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                      onClick={() => {
                        setShowUserMenu(false);
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-3" />
                      {languageCode === 'tr' ? 'Öneri Listelerim' : 'My Suggestion Lists'}
                    </LanguageLink>
                    <LanguageLink
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                      onClick={() => {
                        setShowUserMenu(false);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-3" />
                      {t.settings}
                    </LanguageLink>
                    {isAdmin && !isAdminRoute() && (
                      <>
                        <a
                          href="https://admin.tvshowup.com"
                          className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                          onClick={() => setShowUserMenu(false)}
                          rel="noopener noreferrer"
                        >
                          <Shield className="w-4 h-4 mr-3" />
                          Admin Panel
                        </a>
                        <LanguageLink
                          to="/my-lists"
                          className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Share2 className="w-4 h-4 mr-3" />
                          {languageCode === 'tr' ? 'Öneri Listelerim' :
                           languageCode === 'de' ? 'Meine Vorschlagslisten' :
                           languageCode === 'fr' ? 'Mes listes de suggestions' :
                           languageCode === 'es' ? 'Mis listas de sugerencias' :
                           languageCode === 'it' ? 'Le mie liste di suggerimenti' :
                           'My Suggestion Lists'}
                        </LanguageLink>
                      </>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      {t.signOut}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <LanguageLink
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors cursor-pointer"
                >
                  {t.signInButton}
                </LanguageLink>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Menus - Rendered at the bottom of the header to avoid z-index issues */}
      {showCountryMenu && (
        <div 
          className="md:hidden fixed inset-0 z-[10001] bg-black bg-opacity-50 touch-none"
          onClick={() => setShowCountryMenu(false)}
        >
          <div 
            ref={countryMenuRef}
            className="absolute right-3 top-16 w-64 bg-gray-800 rounded-md shadow-lg py-1 max-h-[70vh] overflow-hidden z-[10002]"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                value={countrySearchQuery}
                onChange={(e) => setCountrySearchQuery(e.target.value)}
                placeholder={languageCode === 'tr' ? 'Ülke ara...' :
                             languageCode === 'de' ? 'Land suchen...' :
                             languageCode === 'fr' ? 'Rechercher un pays...' :
                             languageCode === 'es' ? 'Buscar país...' :
                             languageCode === 'it' ? 'Cerca paese...' :
                             'Search country...'}
                className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
            
            {/* Countries List */}
            <div className="max-h-52 overflow-y-auto">
              {Object.entries(filteredCountries).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => handleCountryChange(code)}
                  className={`flex items-center w-full px-4 py-2 text-sm cursor-pointer ${
                    countryCode === code ? 'text-primary-400 font-medium bg-primary-900/20' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-2 text-xs font-mono text-gray-500">{code}</span>
                  {name}
                </button>
              ))}
              
              {Object.keys(filteredCountries).length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  {languageCode === 'tr' ? 'Ülke bulunamadı' :
                   languageCode === 'de' ? 'Kein Land gefunden' :
                   languageCode === 'fr' ? 'Aucun pays trouvé' :
                   languageCode === 'es' ? 'No se encontró país' :
                   languageCode === 'it' ? 'Nessun paese trovato' :
                   'No country found'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {showUserMenu && user && (
        <div 
          className="md:hidden fixed inset-0 z-[10003] bg-black bg-opacity-50 touch-none"
          onClick={() => setShowUserMenu(false)}
        >
          <div 
            ref={userMenuRef}
            className="absolute right-3 top-16 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-[10004]"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <LanguageLink
              to="/watchlist"
              className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              onClick={() => setShowUserMenu(false)}
            >
              <List className="w-4 h-4 mr-3" />
              {t.myWatchlist}
            </LanguageLink>
            <LanguageLink
              to="/my-lists"
              className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              onClick={() => setShowUserMenu(false)}
            >
              <Share2 className="w-4 h-4 mr-3" />
              {languageCode === 'tr' ? 'Öneri Listelerim' : 'My Suggestion Lists'}
            </LanguageLink>
            <LanguageLink
              to="/settings"
              className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              onClick={() => setShowUserMenu(false)}
            >
              <Settings className="w-4 h-4 mr-3" />
              {t.settings}
            </LanguageLink>
            {isAdmin && !isAdminRoute() && (
              <>
              <a
                href="https://admin.tvshowup.com"
                className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                onClick={() => setShowUserMenu(false)}
                rel="noopener noreferrer"
              >
                <Shield className="w-4 h-4 mr-3" />
                Admin Panel
              </a>
              <LanguageLink
                to="/my-lists"
                className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                onClick={() => setShowUserMenu(false)}
              >
                <Share2 className="w-4 h-4 mr-3" />
                {languageCode === 'tr' ? 'Öneri Listelerim' :
                 languageCode === 'de' ? 'Meine Vorschlagslisten' :
                 languageCode === 'fr' ? 'Mes listes de suggestions' :
                 languageCode === 'es' ? 'Mis listas de sugerencias' :
                 languageCode === 'it' ? 'Le mie liste di suggerimenti' :
                 'My Suggestion Lists'}
              </LanguageLink>
              </>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-3" />
              {t.signOut}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header