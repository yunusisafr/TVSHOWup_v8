import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Loader2, Sparkles, Trash2, RotateCcw, MessageCircle, X, Copy, Check, AlertCircle, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import { aiChatService, ChatMessage, QueryParams } from '../lib/aiChatService';
import { ContentItem } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import { useAuthPrompt } from '../contexts/AuthPromptContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTranslation } from '../lib/i18n';
import { rateLimitService, UsageLimits } from '../lib/rateLimitService';
import { useAdmin } from '../contexts/AdminContext';
import ContentCard from './ContentCard';
import { getAIChatTranslation } from '../config/aiChatTranslations';
import { getLanguageMetadata } from '../config/languages';

interface AIChatDiscoveryProps {
  onClose?: () => void;
}

const AIChatDiscovery: React.FC<AIChatDiscoveryProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { openAuthPrompt } = useAuthPrompt();
  const { languageCode, countryCode } = useUserPreferences();
  const { t } = useTranslation(languageCode);
  const { isAdmin } = useAdmin();

  const [conversationId, setConversationId] = useState<string | null>(() => {
    return sessionStorage.getItem('aiChatConversationId') || null;
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem('aiChatMessages');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ContentItem[]>(() => {
    const saved = sessionStorage.getItem('aiChatResults');
    return saved ? JSON.parse(saved) : [];
  });
  const [userWatchlistMap, setUserWatchlistMap] = useState<Map<number, string>>(new Map());
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const [visibleResults, setVisibleResults] = useState(24); // Show 24 initially
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const aiChatText = getAIChatTranslation(languageCode);
  const suggestions = aiChatText.suggestions;
  const languageMetadata = getLanguageMetadata(languageCode);
  const isRTL = languageMetadata?.isRTL || false;

  useEffect(() => {
    if (messages.length === 0) {
      initializeConversation();
    }
  }, [user]);

  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem('aiChatConversationId', conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('aiChatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (results.length > 0) {
      sessionStorage.setItem('aiChatResults', JSON.stringify(results));
    }
  }, [results]);

  // Removed auto-scroll on messages - let user control their position

  useEffect(() => {
    if (user) {
      loadUserWatchlist();
    }
  }, [user]);

  useEffect(() => {
    loadUsageLimits();
  }, [user, isAdmin]);

  const loadUsageLimits = async () => {
    setIsLoadingLimits(true);
    try {
      console.log('🔍 Loading limits for:', { userId: user?.id, isAdmin });
      let limits = await rateLimitService.getUserLimits(user?.id || null, isAdmin);

      if (!limits) {
        console.log('🔄 Initializing limits...');
        await rateLimitService.initializeUserLimits(user?.id || null, isAdmin);
        limits = await rateLimitService.getUserLimits(user?.id || null, isAdmin);
      }

      console.log('✅ Loaded usage limits:', limits);
      setUsageLimits(limits);
    } catch (error) {
      console.error('Error loading usage limits:', error);
    } finally {
      setIsLoadingLimits(false);
    }
  };

  // Save scroll position before navigating away
  useEffect(() => {
    const saveScrollPosition = () => {
      if (scrollContainerRef.current) {
        const scrollPos = scrollContainerRef.current.scrollTop;
        sessionStorage.setItem('aiChatScrollPosition', scrollPos.toString());
        console.log('💾 Saved scroll position:', scrollPos);
      }
    };

    // Save on any navigation or component unmount
    return () => {
      saveScrollPosition();
    };
  }, []);

  // Restore scroll position when component mounts or results change
  useEffect(() => {
    const savedPos = sessionStorage.getItem('aiChatScrollPosition');
    if (savedPos && scrollContainerRef.current) {
      // Delay to ensure DOM is ready and content is rendered
      const timeoutId = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = parseInt(savedPos, 10);
          console.log('🔄 Restored scroll position:', savedPos);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [results]);

  // No automatic scrolling - user controls their view

  const initializeConversation = async () => {
    try {
      const convId = await aiChatService.createConversation(user?.id);
      setConversationId(convId);
      setSetupError(null);

      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: aiChatText.welcome,
        createdAt: new Date().toISOString(),
      };

      setMessages([welcomeMessage]);
    } catch (error: any) {
      console.error('Error initializing conversation:', error);

      // Check if it's a table not found error
      if (error?.message?.includes('404') || error?.code === 'PGRST116') {
        setSetupError(languageCode === 'tr'
          ? 'AI Chat veritabanı tabloları henüz oluşturulmamış. Lütfen Supabase Dashboard\'da SQL Editor\'ü kullanarak migration dosyasını çalıştırın: supabase/migrations/20251016160000_create_ai_discovery_chat_schema.sql'
          : 'AI Chat database tables are not created yet. Please run the migration file in Supabase Dashboard SQL Editor: supabase/migrations/20251016160000_create_ai_discovery_chat_schema.sql'
        );
      }
    }
  };

  const loadUserWatchlist = async () => {
    if (!user) return;

    try {
      const { databaseService } = await import('../lib/database');
      const watchlist = await databaseService.getUserWatchlist(user.id);
      const watchlistMap = new Map<number, string>();
      watchlist.forEach(item => {
        watchlistMap.set(item.content_id, item.status);
      });
      setUserWatchlistMap(watchlistMap);
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const query = messageText || inputValue.trim();
    if (!query || !conversationId || isProcessing) return;

    if (usageLimits && usageLimits.remaining <= 0) {
      return;
    }

    console.log('🚀 Sending prompt - current remaining:', usageLimits?.remaining);

    const canProceed = await rateLimitService.incrementUsage(user?.id || null, isAdmin);
    console.log('✅ Increment result:', canProceed);

    if (!canProceed) {
      console.error('❌ Increment failed - limit exceeded');
      const errorMessage: ChatMessage = {
        id: `temp_limit_error_${Date.now()}`,
        role: 'assistant',
        content: languageCode === 'tr'
          ? 'Günlük limit doldu. Lütfen daha sonra tekrar deneyin.'
          : 'Daily limit reached. Please try again later.',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      await loadUsageLimits();
      return;
    }

    setInputValue('');
    setIsProcessing(true);

    setResults([]);
    setVisibleResults(24);
    sessionStorage.removeItem('aiChatResults');

    const userMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      await aiChatService.addMessage(conversationId, 'user', query);

      const { content, responseText, isOffTopic, topicChanged, detectedMood, moodConfidence, isVagueQuery } = await aiChatService.processQuery(query, messages, countryCode);

      if (detectedMood && moodConfidence) {
        console.log(`🎭 User mood detected: ${detectedMood} (${moodConfidence}% confidence)`);
      }

      if (isVagueQuery) {
        console.log('💭 Vague query - showing trending content');
      }

      const assistantMessage: ChatMessage = {
        id: `temp_assistant_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        resultsCount: content.length,
        detectedMood: detectedMood,
        moodConfidence: moodConfidence,
        isVagueQuery: isVagueQuery,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      await aiChatService.addMessage(
        conversationId,
        'assistant',
        responseText,
        undefined,
        content.length
      );

      if (!isOffTopic) {
        setResults(content);
        setVisibleResults(24);
      } else {
        setResults([]);
        setVisibleResults(24);
      }

    } catch (error) {
      console.error('❌ Error processing message:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));

      const errorMessage: ChatMessage = {
        id: `temp_error_${Date.now()}`,
        role: 'assistant',
        content: languageCode === 'tr'
          ? 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.'
          : 'Sorry, an error occurred. Please try again.',
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      console.log('🔄 Reloading limits after message processing...');
      await loadUsageLimits();
      console.log('✅ Limits reloaded - new remaining:', usageLimits?.remaining);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleFeedback = async (
    messageId: string,
    feedbackType: 'positive' | 'negative',
    message: ChatMessage
  ) => {
    if (feedbackGiven.has(messageId)) {
      return;
    }

    try {
      if (!conversationId) return;

      await aiChatService.submitFeedback(
        conversationId,
        messageId,
        message.content,
        message.extractedParams || {},
        feedbackType,
        message.resultsCount || 0
      );

      setFeedbackGiven(prev => new Set(prev).add(messageId));

      console.log(`✅ ${feedbackType} feedback submitted`);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleReset = async () => {
    // Delete conversation from database if it exists
    if (conversationId) {
      try {
        await aiChatService.deleteConversation(conversationId);
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    }

    // Clear all state and storage
    setMessages([]);
    setResults([]);
    setFeedbackGiven(new Set());
    setConversationId(null);
    sessionStorage.removeItem('aiChatConversationId');
    sessionStorage.removeItem('aiChatMessages');
    sessionStorage.removeItem('aiChatResults');

    // Initialize new conversation
    await initializeConversation();
  };

  const handleWatchlistStatusChange = async (
    contentId: number,
    contentType: 'movie' | 'tv_show',
    status: 'want_to_watch' | 'watching' | 'watched' | null
  ) => {
    if (!user) {
      openAuthPrompt('watchlist');
      return;
    }

    try {
      const { databaseService } = await import('../lib/database');

      if (status === null) {
        await databaseService.removeFromWatchlist(user.id, contentId, contentType);
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(contentId);
          return newMap;
        });
      } else {
        await databaseService.addToWatchlist(user.id, contentId, contentType, status, {
          onConflict: 'user_id,content_id,content_type',
        });
        setUserWatchlistMap(prev => {
          const newMap = new Map(prev);
          newMap.set(contentId, status);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
    }
  };

  // Show setup error if tables don't exist
  if (setupError) {
    return (
      <div className="flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden items-center justify-center p-8">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-2xl">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-red-600 rounded-lg flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">
                {languageCode === 'tr' ? 'Veritabanı Kurulumu Gerekli' : 'Database Setup Required'}
              </h3>
              <p className="text-red-200 text-sm mb-4 leading-relaxed">
                {setupError}
              </p>
              <div className="bg-gray-800 rounded p-3 mb-4">
                <p className="text-gray-300 text-xs mb-2">
                  {languageCode === 'tr' ? '1. Supabase Dashboard\'a gidin' : '1. Go to Supabase Dashboard'}
                </p>
                <p className="text-gray-300 text-xs mb-2">
                  {languageCode === 'tr' ? '2. SQL Editor\'ü açın' : '2. Open SQL Editor'}
                </p>
                <p className="text-gray-300 text-xs">
                  {languageCode === 'tr' ? '3. Migration dosyasını kopyalayıp çalıştırın' : '3. Copy and run the migration file'}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const setupLink = languageCode === 'tr'
                      ? 'https://github.com/your-repo/blob/main/SETUP_AI_CHAT.md'
                      : 'https://github.com/your-repo/blob/main/SETUP_AI_CHAT.md';
                    window.open(setupLink, '_blank');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>{languageCode === 'tr' ? 'Kurulum Talimatları' : 'Setup Instructions'}</span>
                </button>
                <button
                  onClick={() => window.open('https://supabase.com/dashboard/project/ycojglkexgpbrxcilkkm/sql/new', '_blank')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {languageCode === 'tr' ? 'SQL Editor\'ü Aç' : 'Open SQL Editor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full w-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 ai-chat-container ${isRTL ? 'rtl' : ''}`}>
      {/* Header - Mobile Optimized */}
      <div className="bg-gradient-to-r from-purple-800/40 to-blue-800/40 backdrop-blur-md p-3 sm:p-4 border-b border-purple-500/30 flex items-center justify-between shrink-0 shadow-lg">
        <div className={`flex items-center min-w-0 ${isRTL ? 'space-x-reverse space-x-2 sm:space-x-3' : 'space-x-2 sm:space-x-3'}`}>
          <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg sm:rounded-xl shadow-lg shrink-0">
            <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-base md:text-lg font-bold text-white leading-tight">
              <span className="hidden sm:inline">{languageCode === 'tr' ? 'TVSHOWup Keşif Asistanı' : 'TVSHOWup Discovery Assistant'}</span>
              <span className="sm:hidden leading-tight break-words">{languageCode === 'tr' ? 'TVSHOWup Keşif Asistanı' : 'TVSHOWup Discovery'}</span>
            </h2>
            <p className="text-xs text-gray-300 hidden sm:block">
              {languageCode === 'tr' ? 'Mükemmel içeriği bulmak için konuşun' : 'Chat to find perfect content'}
            </p>
          </div>
        </div>
        <div className={`flex items-center shrink-0 ${isRTL ? 'space-x-reverse space-x-1 sm:space-x-2' : 'space-x-1 sm:space-x-2'}`}>
          {!isLoadingLimits && usageLimits && (
            <>
              {/* Desktop Version */}
              <div className={`hidden sm:flex items-center px-3 py-1.5 bg-slate-800/60 rounded-lg border border-purple-500/30 relative ${isRTL ? 'space-x-reverse space-x-1.5' : 'space-x-1.5'}`}>
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span className={`text-xs font-medium ${usageLimits.remaining <= 2 ? 'text-red-400' : 'text-purple-300'}`}>
                  {usageLimits.remaining}/{usageLimits.dailyLimit}
                </span>
              </div>

              {/* Mobile Version */}
              <div className={`sm:hidden flex items-center px-2 py-1 bg-slate-800/60 rounded-lg border border-purple-500/30 relative ${isRTL ? 'space-x-reverse space-x-1' : 'space-x-1'}`}>
                <Clock className="w-3 h-3 text-purple-400" />
                <span className={`text-xs font-medium ${usageLimits.remaining <= 2 ? 'text-red-400' : 'text-purple-300'}`}>
                  {usageLimits.remaining}/{usageLimits.dailyLimit}
                </span>
              </div>
            </>
          )}
          <button
            onClick={handleReset}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-all hover:scale-105 text-gray-300 hover:text-white"
            title={languageCode === 'tr' ? 'Yeni sohbet başlat' : 'Start new chat'}
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-all hover:scale-105 text-red-400 hover:text-red-300"
              title={languageCode === 'tr' ? 'Kapat' : 'Close'}
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area - Mobile First Design */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-slate-900/50 to-slate-900">
        {/* Chat Section - Scrollable Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-600/50 scrollbar-track-transparent chat-scroll-area">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 shadow-lg ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-purple-500/30'
                      : 'bg-slate-800/80 backdrop-blur-md text-gray-100 border border-purple-500/20 shadow-purple-900/20'
                  }`}
                >
              {message.role === 'assistant' && (
                <div className={`flex items-center mb-3 ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs text-purple-300 font-semibold">TVSHOWup</span>
                </div>
              )}
              <p className="text-sm leading-relaxed break-words">{message.content}</p>
              {message.extractedParams && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">
                    {languageCode === 'tr' ? 'Arama parametreleri:' : 'Search parameters:'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {message.extractedParams.contentType && (
                      <span className="text-xs px-2 py-0.5 bg-blue-600/30 rounded">
                        {message.extractedParams.contentType}
                      </span>
                    )}
                    {message.extractedParams.genres && message.extractedParams.genres.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-green-600/30 rounded">
                        {message.extractedParams.genres.length} {languageCode === 'tr' ? 'tür' : 'genres'}
                      </span>
                    )}
                    {message.extractedParams.actors && message.extractedParams.actors.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-purple-600/30 rounded">
                        {message.extractedParams.actors.join(', ')}
                      </span>
                    )}
                    {message.extractedParams.directors && message.extractedParams.directors.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-orange-600/30 rounded">
                        {languageCode === 'tr' ? 'Yönetmen: ' : 'Director: '}{message.extractedParams.directors.join(', ')}
                      </span>
                    )}
                    {message.extractedParams.minRating && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-600/30 rounded">
                        {languageCode === 'tr' ? 'Puan' : 'Rating'} ≥ {message.extractedParams.minRating}
                      </span>
                    )}
                    {message.extractedParams.year && (
                      <span className="text-xs px-2 py-0.5 bg-pink-600/30 rounded">
                        {message.extractedParams.year}
                      </span>
                    )}
                    {message.extractedParams.yearRange && (
                      <span className="text-xs px-2 py-0.5 bg-pink-600/30 rounded">
                        {message.extractedParams.yearRange.min}-{message.extractedParams.yearRange.max}
                      </span>
                    )}
                    {message.extractedParams.providers && message.extractedParams.providers.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-cyan-600/30 rounded">
                        {message.extractedParams.providers.length} {languageCode === 'tr' ? 'platform' : 'platforms'}
                      </span>
                    )}
                    {message.extractedParams.specificTitle && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-600/30 rounded">
                        {languageCode === 'tr' ? 'Başlık: ' : 'Title: '}{message.extractedParams.specificTitle}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Feedback buttons for assistant messages */}
              {message.role === 'assistant' && message.id && (
                <div className={`mt-2 pt-2 border-t border-gray-700 flex items-center ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                  <span className="text-xs text-gray-400">
                    {languageCode === 'tr' ? 'Yararlı oldu mu?' : 'Was this helpful?'}
                  </span>
                  <button
                    onClick={() => handleFeedback(message.id!, 'positive', message)}
                    disabled={feedbackGiven.has(message.id)}
                    className={`p-1 rounded transition-colors ${
                      feedbackGiven.has(message.id)
                        ? 'text-green-500 cursor-not-allowed'
                        : 'text-gray-400 hover:text-green-500 hover:bg-green-500/10'
                    }`}
                    title={languageCode === 'tr' ? 'Evet, yararlı' : 'Yes, helpful'}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleFeedback(message.id!, 'negative', message)}
                    disabled={feedbackGiven.has(message.id)}
                    className={`p-1 rounded transition-colors ${
                      feedbackGiven.has(message.id)
                        ? 'text-red-500 cursor-not-allowed'
                        : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                    }`}
                    title={languageCode === 'tr' ? 'Hayır, yararlı değil' : 'No, not helpful'}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                  {feedbackGiven.has(message.id) && (
                    <span className="text-xs text-gray-500">
                      {languageCode === 'tr' ? 'Geri bildirim alındı' : 'Feedback received'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-sm text-gray-400">
                  {languageCode === 'tr' ? 'Düşünüyorum...' : 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {messages.length === 1 && !isProcessing && usageLimits && usageLimits.remaining > 0 && (
          <div className="mt-2 sm:mt-4 px-2">
            <p className="text-xs sm:text-sm text-purple-300 mb-2 text-center font-medium">
              {aiChatText.suggestionsLabel}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-800/70 hover:bg-purple-700/50 border border-purple-500/30 hover:border-purple-400/50 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-all hover:shadow-lg hover:shadow-purple-500/20"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results - Inline in chat flow with vertical expansion */}
        {results.length > 0 && (
          <div ref={resultsRef} className="mt-4 mb-4 space-y-4 animate-slideDown">
            <div className="flex items-center justify-center space-x-2 text-purple-300 bg-purple-900/30 backdrop-blur-sm rounded-lg py-2 px-4 border border-purple-500/30">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
              <span className="text-sm font-semibold">
                {languageCode === 'tr' ? `${results.length} sonuç bulundu` : `Found ${results.length} results`}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 auto-rows-auto">
              {results.slice(0, visibleResults).map((item) => (
                <ContentCard
                  key={`${item.content_type}-${item.id}`}
                  content={item}
                  onWatchlistStatusChange={handleWatchlistStatusChange}
                  watchlistStatus={(userWatchlistMap.get(item.id) as any) || 'none'}
                  onAuthRequired={() => openAuthPrompt('watchlist')}
                  variant="compact"
                />
              ))}
            </div>
            {results.length > visibleResults && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setVisibleResults(prev => Math.min(prev + 24, results.length))}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg hover:shadow-purple-500/50 flex items-center space-x-2"
                >
                  <span>{languageCode === 'tr' ? 'Daha Fazla Göster' : 'Show More'}</span>
                  <span className="text-sm opacity-75">
                    ({visibleResults}/{results.length})
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>

        {/* Limit Reached Banner */}
        {!isLoadingLimits && usageLimits && usageLimits.remaining <= 0 && (
          <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 bg-slate-900/95">
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-amber-200">
                    {languageCode === 'tr'
                      ? `Günlük ${usageLimits.dailyLimit} sorgu limitiniz doldu`
                      : `Daily limit of ${usageLimits.dailyLimit} queries reached`}
                  </p>
                  <p className="text-xs text-amber-100/80">
                    {languageCode === 'tr'
                      ? `Limitiniz ${rateLimitService.formatResetTime(usageLimits.resetAt, languageCode)} sonra sıfırlanacak.`
                      : `Your limit will reset in ${rateLimitService.formatResetTime(usageLimits.resetAt, languageCode)}.`}
                  </p>
                  {!user && (
                    <div className="pt-2 border-t border-amber-500/30">
                      <p className="text-xs text-amber-100 mb-2">
                        {languageCode === 'tr'
                          ? '🎉 Ücretsiz kayıt olun ve günlük limitinizi 25\'e çıkarın!'
                          : '🎉 Sign up for free and increase your daily limit to 25!'}
                      </p>
                      <button
                        onClick={() => openAuthPrompt('register')}
                        className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold text-sm transition-all shadow-lg hover:shadow-xl"
                      >
                        {languageCode === 'tr' ? 'Hemen Kaydol' : 'Sign Up Now'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input - Fixed at bottom, outside scroll area */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-900/95 backdrop-blur-md border-t border-purple-500/30 shadow-[0_-4px_20px_rgba(168,85,247,0.15)]">
          <div className={`flex ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isProcessing && usageLimits && usageLimits.remaining > 0) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                usageLimits && usageLimits.remaining <= 0
                  ? aiChatText.limitReached
                  : aiChatText.placeholder
              }
              className={`flex-1 bg-slate-800/70 border border-purple-500/30 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all hover:border-purple-400/50 disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
              disabled={isProcessing || (usageLimits !== null && usageLimits.remaining <= 0 && !isAdmin)}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isProcessing || (usageLimits !== null && usageLimits.remaining <= 0 && !isAdmin)}
              className="px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center min-w-[48px] sm:min-w-[60px]"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatDiscovery;
