import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { ContentItem } from './database';
import { createSEOSlug } from './utils';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  extractedParams?: QueryParams;
  resultsCount?: number;
  detectedMood?: string | null;
  moodConfidence?: number | null;
  isVagueQuery?: boolean;
  createdAt: string;
}

export interface QueryParams {
  genres?: number[];
  actors?: string[];
  directors?: string[];
  year?: number;
  yearRange?: { min: number; max: number };
  minRating?: number;
  contentType?: 'movie' | 'tv_show' | 'both';
  providers?: number[];
  mood?: string;
  specificTitle?: string;
  queryLanguage?: string;
  isOffTopic?: boolean;
  limit?: number;
  detectedMood?: string | null;
  moodConfidence?: number | null;
  isVagueQuery?: boolean;
}

export interface Conversation {
  id: string;
  userId?: string;
  sessionId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

class AIChatService {
  private sessionId: string;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('ai_chat_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ai_chat_session_id', sessionId);
    }
    return sessionId;
  }

  async createConversation(userId?: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .insert({
          user_id: userId || null,
          session_id: userId ? null : this.sessionId,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const [convResult, messagesResult] = await Promise.all([
        supabase
          .from('ai_chat_conversations')
          .select('*')
          .eq('id', conversationId)
          .maybeSingle(),
        supabase
          .from('ai_chat_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      ]);

      if (convResult.error || !convResult.data) {
        console.error('Error fetching conversation:', convResult.error);
        return null;
      }

      const messages: ChatMessage[] = (messagesResult.data || []).map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        extractedParams: msg.extracted_params,
        resultsCount: msg.results_count,
        createdAt: msg.created_at,
      }));

      return {
        id: convResult.data.id,
        userId: convResult.data.user_id,
        sessionId: convResult.data.session_id,
        messages,
        createdAt: convResult.data.created_at,
        updatedAt: convResult.data.updated_at,
      };
    } catch (error) {
      console.error('Error getting conversation:', error);
      return null;
    }
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const conversations = await Promise.all(
        (data || []).map((conv) => this.getConversation(conv.id))
      );

      return conversations.filter((conv): conv is Conversation => conv !== null);
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    extractedParams?: QueryParams,
    resultsCount?: number
  ): Promise<ChatMessage> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          extracted_params: extractedParams || {},
          results_count: resultsCount || 0,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('ai_chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return {
        id: data.id,
        role: data.role as 'user' | 'assistant',
        content: data.content,
        extractedParams: data.extracted_params,
        resultsCount: data.results_count,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  async processQuery(query: string, conversationHistory: ChatMessage[] = [], countryCode: string = 'US'): Promise<{
    content: ContentItem[];
    responseText: string;
    isOffTopic: boolean;
    topicChanged: boolean;
    detectedMood?: string | null;
    moodConfidence?: number | null;
    isVagueQuery?: boolean;
  }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-discover-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            query,
            conversationHistory: conversationHistory.slice(-5),
            countryCode: countryCode.toUpperCase(),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ AI service HTTP error:', response.status, errorText);
        throw new Error(`AI service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      console.log('🔍 Edge Function Response:', result);

      if (!result.success) {
        console.error('❌ Edge function returned error:', result.error);
        throw new Error(result.error || 'Failed to process query');
      }

      // Check if AI identified a specific title from scene description
      if (result.responseText?.startsWith('SEARCH_TITLE:')) {
        const identifiedTitle = result.responseText.replace('SEARCH_TITLE:', '').trim();
        console.log(`🎬 AI identified specific title: "${identifiedTitle}" - searching TMDB...`);

        // Perform a new search with the identified title
        const titleSearchResponse = await fetch(
          `${supabaseUrl}/functions/v1/ai-discover-content`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              query: identifiedTitle,
              conversationHistory: [],
              countryCode: countryCode.toUpperCase(),
            }),
          }
        );

        if (titleSearchResponse.ok) {
          const titleResult = await titleSearchResponse.json();
          if (titleResult.success && titleResult.results?.length > 0) {
            const formattedContent = this.formatChatGPTResults(titleResult.results);
            console.log(`✅ Found ${formattedContent.length} results for "${identifiedTitle}"`);

            // Detect language from query
            const detectLanguage = (text: string): string => {
              const lower = text.toLowerCase();

              // Turkish detection
              const turkishWords = ['film', 'dizi', 'için', 'olan', 'var', 'ne', 'hangi', 'gibi', 'diye', 'deki', 'ile'];
              const turkishChars = /[ğüşıöçĞÜŞİÖÇ]/;
              if (turkishChars.test(text) || turkishWords.some(word => lower.includes(` ${word} `) || lower.startsWith(`${word} `) || lower.endsWith(` ${word}`))) {
                return 'tr';
              }

              // German detection
              const germanWords = ['film', 'serie', 'mit', 'der', 'die', 'das'];
              const germanChars = /[äöüßÄÖÜ]/;
              if (germanChars.test(text) || (germanWords.some(word => lower.includes(` ${word} `)) && !turkishChars.test(text))) {
                return 'de';
              }

              // French detection
              const frenchWords = ['film', 'série', 'avec', 'pour', 'où'];
              const frenchChars = /[àâäéèêëïîôùûüÿœæç]/;
              if (frenchChars.test(text) || frenchWords.some(word => lower.includes(` ${word} `))) {
                return 'fr';
              }

              // Spanish detection
              const spanishWords = ['película', 'serie', 'con', 'donde', 'para'];
              const spanishChars = /[áéíóúñü¿¡]/;
              if (spanishChars.test(text) || spanishWords.some(word => lower.includes(` ${word} `))) {
                return 'es';
              }

              // Default to English
              return 'en';
            };

            const languageCode = detectLanguage(query);

            const responses: { [key: string]: string } = {
              tr: `Aradığınız içerik: "${identifiedTitle}"! ${formattedContent.length > 1 ? 'İlgili diğer öneriler de aşağıda.' : ''}`,
              en: `Found it: "${identifiedTitle}"! ${formattedContent.length > 1 ? 'Related suggestions below.' : ''}`,
              de: `Gefunden: "${identifiedTitle}"! ${formattedContent.length > 1 ? 'Weitere Vorschläge unten.' : ''}`,
              fr: `Trouvé: "${identifiedTitle}"! ${formattedContent.length > 1 ? 'Autres suggestions ci-dessous.' : ''}`,
              es: `Encontrado: "${identifiedTitle}"! ${formattedContent.length > 1 ? 'Más sugerencias abajo.' : ''}`
            };

            const responseText = responses[languageCode] || responses.en;

            return {
              content: formattedContent,
              responseText: responseText,
              isOffTopic: false,
              topicChanged: false,
              detectedMood: null,
              moodConfidence: null,
              isVagueQuery: false,
            };
          }
        }
      }

      const formattedContent = this.formatChatGPTResults(result.results || []);
      console.log('📦 Formatted Content:', formattedContent.length, 'items');

      if (result.detectedMood) {
        console.log(`🎭 Mood detected: ${result.detectedMood} (${result.moodConfidence}% confidence)`);
      }

      if (result.isVagueQuery) {
        console.log('💭 Vague query detected - showing trending content');
      }

      return {
        content: formattedContent,
        responseText: result.responseText || 'Here are some suggestions...',
        isOffTopic: result.isOffTopic || false,
        topicChanged: result.topicChanged || false,
        detectedMood: result.detectedMood || null,
        moodConfidence: result.moodConfidence || null,
        isVagueQuery: result.isVagueQuery || false,
      };
    } catch (error) {
      console.error('Error processing query:', error);

      return {
        content: [],
        responseText: 'Sorry, I encountered an error processing your request.',
        isOffTopic: false,
        topicChanged: false,
        detectedMood: null,
        moodConfidence: null,
        isVagueQuery: false,
      };
    }
  }

  private fallbackParser(query: string): QueryParams {
    const lowerQuery = query.toLowerCase();
    const params: QueryParams = {
      contentType: 'both',
      minRating: 6.0,
    };

    if (lowerQuery.includes('movie')) {
      params.contentType = 'movie';
    } else if (lowerQuery.includes('show') || lowerQuery.includes('series')) {
      params.contentType = 'tv_show';
    }

    return params;
  }

  private generateResponseText(query: string, params: QueryParams): string {
    const lang = params.queryLanguage || 'en';

    // Handle off-topic queries
    if (params.isOffTopic) {
      return this.getOffTopicMessage(lang);
    }

    // Handle specific title search
    if (params.specificTitle) {
      return this.getSpecificTitleMessage(params.specificTitle, lang);
    }

    const parts: string[] = [];

    if (params.contentType === 'movie') {
      parts.push(this.getTranslation('lookingForMovies', lang));
    } else if (params.contentType === 'tv_show') {
      parts.push(this.getTranslation('lookingForTVShows', lang));
    } else {
      parts.push(this.getTranslation('lookingForContent', lang));
    }

    if (params.providers && params.providers.length > 0) {
      parts.push(this.getTranslation('onPlatforms', lang));
    }

    if (params.genres && params.genres.length > 0) {
      parts.push(this.getTranslation('withGenres', lang));
    }

    if (params.actors && params.actors.length > 0) {
      parts.push(`${this.getTranslation('featuring', lang)} ${params.actors.join(', ')}`);
    }

    if (params.directors && params.directors.length > 0) {
      parts.push(`${this.getTranslation('directedBy', lang)} ${params.directors.join(', ')}`);
    }

    if (params.yearRange) {
      parts.push(`${this.getTranslation('from', lang)} ${params.yearRange.min}-${params.yearRange.max}`);
    } else if (params.year) {
      parts.push(`${this.getTranslation('from', lang)} ${params.year}`);
    }

    if (params.minRating && params.minRating > 6.5) {
      parts.push(this.getTranslation('highRatings', lang));
    }

    return parts.join(' ') + '...';
  }

  private getOffTopicMessage(lang: string): string {
    const messages: { [key: string]: string } = {
      'en': 'I can only help you find movies and TV shows. I don\'t have information about other topics.',
      'tr': 'Ben sadece film ve dizi içeriklerini bulmanıza yardımcı olabiliyorum. Diğer konular hakkında bilgi sahibi değilim.',
      'de': 'Ich kann Ihnen nur bei der Suche nach Filmen und Serien helfen. Ich habe keine Informationen zu anderen Themen.',
      'fr': 'Je ne peux vous aider qu\'à trouver des films et des séries. Je n\'ai pas d\'informations sur d\'autres sujets.',
      'es': 'Solo puedo ayudarte a encontrar películas y series. No tengo información sobre otros temas.',
      'it': 'Posso solo aiutarti a trovare film e serie TV. Non ho informazioni su altri argomenti.',
    };
    return messages[lang] || messages['en'];
  }

  private getSpecificTitleMessage(title: string, lang: string): string {
    const templates: { [key: string]: string } = {
      'en': `Searching for "${title}" and checking available platforms...`,
      'tr': `"${title}" için arama yapıyorum ve mevcut platformları kontrol ediyorum...`,
      'de': `Suche nach "${title}" und überprüfe verfügbare Plattformen...`,
      'fr': `Recherche de "${title}" et vérification des plateformes disponibles...`,
      'es': `Buscando "${title}" y verificando plataformas disponibles...`,
      'it': `Ricerca di "${title}" e verifica delle piattaforme disponibili...`,
    };
    return templates[lang] || templates['en'];
  }

  private getTranslation(key: string, lang: string): string {
    const translations: { [key: string]: { [lang: string]: string } } = {
      'lookingForMovies': {
        'en': 'Looking for movies',
        'tr': 'Film arıyorum',
        'de': 'Suche nach Filmen',
        'fr': 'Recherche de films',
        'es': 'Buscando películas',
        'it': 'Cerco film',
      },
      'lookingForTVShows': {
        'en': 'Looking for TV shows',
        'tr': 'Dizi arıyorum',
        'de': 'Suche nach Serien',
        'fr': 'Recherche de séries',
        'es': 'Buscando series',
        'it': 'Cerco serie TV',
      },
      'lookingForContent': {
        'en': 'Looking for movies and TV shows',
        'tr': 'Film ve dizi arıyorum',
        'de': 'Suche nach Filmen und Serien',
        'fr': 'Recherche de films et séries',
        'es': 'Buscando películas y series',
        'it': 'Cerco film e serie TV',
      },
      'onPlatforms': {
        'en': 'on selected platforms',
        'tr': 'seçili platformlarda',
        'de': 'auf ausgewählten Plattformen',
        'fr': 'sur les plateformes sélectionnées',
        'es': 'en plataformas seleccionadas',
        'it': 'su piattaforme selezionate',
      },
      'withGenres': {
        'en': 'in your selected genres',
        'tr': 'seçili türlerde',
        'de': 'in ausgewählten Genres',
        'fr': 'dans les genres sélectionnés',
        'es': 'en géneros seleccionados',
        'it': 'nei generi selezionati',
      },
      'featuring': {
        'en': 'featuring',
        'tr': 'oyuncular:',
        'de': 'mit',
        'fr': 'avec',
        'es': 'con',
        'it': 'con',
      },
      'directedBy': {
        'en': 'directed by',
        'tr': 'yönetmen:',
        'de': 'Regie:',
        'fr': 'réalisé par',
        'es': 'dirigida por',
        'it': 'diretto da',
      },
      'from': {
        'en': 'from',
        'tr': 'yıl:',
        'de': 'ab',
        'fr': 'de',
        'es': 'de',
        'it': 'dal',
      },
      'highRatings': {
        'en': 'with high ratings',
        'tr': 'yüksek puanlı',
        'de': 'mit hoher Bewertung',
        'fr': 'avec de bonnes notes',
        'es': 'con altas calificaciones',
        'it': 'con valutazioni alte',
      },
    };

    return translations[key]?.[lang] || translations[key]?.['en'] || key;
  }

  async searchContent(params: QueryParams, languageCode: string = 'en', countryCode: string = 'US'): Promise<ContentItem[]> {
    try {
      // Return empty for off-topic queries
      if (params.isOffTopic) {
        return [];
      }

      const results: ContentItem[] = [];

      // If specific title is provided, search for that title
      if (params.specificTitle) {
        return await this.searchSpecificTitle(params.specificTitle, languageCode, countryCode);
      }

      // If actors or directors are specified, use person-based discovery
      if ((params.actors && params.actors.length > 0) || (params.directors && params.directors.length > 0)) {
        return await this.searchByPerson(params, languageCode);
      }

      const discoverOptions: any = {
        page: 1,
        language: languageCode,
        sortBy: params.minRating && params.minRating >= 7.5 ? 'vote_average.desc' : 'popularity.desc',
        voteCountGte: 10,
      };

      if (params.genres && params.genres.length > 0) {
        discoverOptions.withGenres = params.genres.join(',');
      }

      if (params.minRating) {
        discoverOptions.voteAverageGte = params.minRating;
      }

      if (params.yearRange) {
        discoverOptions.releaseDateGte = `${params.yearRange.min}-01-01`;
        discoverOptions.releaseDateLte = `${params.yearRange.max}-12-31`;
        discoverOptions.firstAirDateGte = `${params.yearRange.min}-01-01`;
        discoverOptions.firstAirDateLte = `${params.yearRange.max}-12-31`;
      } else if (params.year) {
        discoverOptions.releaseDateGte = `${params.year}-01-01`;
        discoverOptions.releaseDateLte = `${params.year}-12-31`;
        discoverOptions.firstAirDateGte = `${params.year}-01-01`;
        discoverOptions.firstAirDateLte = `${params.year}-12-31`;
      }

      if (params.providers && params.providers.length > 0) {
        discoverOptions.withWatchProviders = params.providers.join(',');
        discoverOptions.watchRegion = countryCode;
      }

      if (params.contentType === 'both' || params.contentType === 'movie') {
        const movieResults = await tmdbService.discoverMovies(discoverOptions);

        if (movieResults?.results) {
          results.push(...this.formatMovieResults(movieResults.results));
        }
      }

      if (params.contentType === 'both' || params.contentType === 'tv_show') {
        const tvResults = await tmdbService.discoverTVShows(discoverOptions);

        if (tvResults?.results) {
          results.push(...this.formatTVResults(tvResults.results));
        }
      }

      const limit = params.limit || 24;
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching content:', error);
      return [];
    }
  }

  private async searchSpecificTitle(title: string, languageCode: string, countryCode: string): Promise<ContentItem[]> {
    try {
      const results: ContentItem[] = [];

      // Search for the specific title
      const movieSearch = await tmdbService.searchMovies(title, 1, languageCode);
      const tvSearch = await tmdbService.searchTVShows(title, 1, languageCode);

      // Combine and format results
      if (movieSearch?.results) {
        results.push(...this.formatMovieResults(movieSearch.results.slice(0, 5)));
      }

      if (tvSearch?.results) {
        results.push(...this.formatTVResults(tvSearch.results.slice(0, 5)));
      }

      // Sort by popularity
      results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      return results.slice(0, 10);
    } catch (error) {
      console.error('Error searching specific title:', error);
      return [];
    }
  }

  private async searchByPerson(params: QueryParams, languageCode: string): Promise<ContentItem[]> {
    try {
      const results: ContentItem[] = [];
      const personNames = [...(params.actors || []), ...(params.directors || [])];

      for (const personName of personNames) {
        // Search for person on TMDB
        const personSearch = await tmdbService.searchPerson(personName);

        if (personSearch?.results && personSearch.results.length > 0) {
          const person = personSearch.results[0];
          const personId = person.id;

          console.log(`🔍 Found person: ${person.name} (ID: ${personId})`);

          // Get their credits
          const credits = await tmdbService.getPersonCredits(personId);

          if (credits) {
            // Filter by content type
            let contentToAdd: any[] = [];

            if (params.contentType === 'both' || params.contentType === 'movie') {
              contentToAdd.push(...(credits.cast || []).filter((item: any) => item.media_type === 'movie'));
              if (params.directors?.includes(personName)) {
                contentToAdd.push(...(credits.crew || []).filter((item: any) =>
                  item.media_type === 'movie' && item.job === 'Director'
                ));
              }
            }

            if (params.contentType === 'both' || params.contentType === 'tv_show') {
              contentToAdd.push(...(credits.cast || []).filter((item: any) => item.media_type === 'tv'));
              if (params.directors?.includes(personName)) {
                contentToAdd.push(...(credits.crew || []).filter((item: any) =>
                  item.media_type === 'tv' && item.job === 'Director'
                ));
              }
            }

            // Apply filters
            contentToAdd = contentToAdd.filter((item: any) => {
              if (params.minRating && item.vote_average < params.minRating) return false;
              if (params.year && item.release_date && !item.release_date.startsWith(params.year.toString())) return false;
              if (params.yearRange) {
                const year = item.release_date ? parseInt(item.release_date.substring(0, 4)) :
                            item.first_air_date ? parseInt(item.first_air_date.substring(0, 4)) : 0;
                if (year < params.yearRange.min || year > params.yearRange.max) return false;
              }
              return true;
            });

            // Sort by popularity
            contentToAdd.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

            // Format and add to results
            for (const item of contentToAdd.slice(0, 20)) {
              if (item.media_type === 'movie') {
                results.push(...this.formatMovieResults([{
                  ...item,
                  title: item.title,
                  release_date: item.release_date,
                }]));
              } else if (item.media_type === 'tv') {
                results.push(...this.formatTVResults([{
                  ...item,
                  name: item.name,
                  first_air_date: item.first_air_date,
                }]));
              }
            }
          }
        }
      }

      // Remove duplicates
      const uniqueResults = results.filter((item, index, self) =>
        index === self.findIndex((t) => t.id === item.id && t.content_type === item.content_type)
      );

      const limit = params.limit || 24;
      return uniqueResults.slice(0, limit);
    } catch (error) {
      console.error('Error searching by person:', error);
      return [];
    }
  }

  private formatMovieResults(tmdbResults: any[]): ContentItem[] {
    return tmdbResults
      .filter((movie: any) => movie.poster_path && movie.overview)
      .map((movie: any) => ({
        id: movie.id,
        title: movie.title,
        original_title: movie.original_title,
        slug: createSEOSlug(movie.id, movie.original_title || movie.title, movie.title),
        overview: movie.overview,
        release_date: movie.release_date,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        popularity: movie.popularity,
        adult: movie.adult,
        original_language: movie.original_language,
        content_type: 'movie' as const,
        runtime: null,
        status: null,
        tagline: null,
        homepage: null,
        video: false,
        budget: 0,
        revenue: 0,
        imdb_id: null,
        belongs_to_collection: null,
        production_companies: null,
        production_countries: null,
        spoken_languages: null,
        genres: movie.genre_ids ? JSON.stringify(movie.genre_ids.map((id: number) => ({ id }))) : null,
        keywords: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
  }

  private formatTVResults(tmdbResults: any[]): ContentItem[] {
    return tmdbResults
      .filter((show: any) => show.poster_path && show.overview)
      .map((show: any) => ({
        id: show.id,
        title: show.name,
        name: show.name,
        original_name: show.original_name,
        slug: createSEOSlug(show.id, show.original_name || show.name, show.name),
        overview: show.overview,
        first_air_date: show.first_air_date,
        poster_path: show.poster_path,
        backdrop_path: show.backdrop_path,
        vote_average: show.vote_average,
        vote_count: show.vote_count,
        popularity: show.popularity,
        adult: show.adult,
        original_language: show.original_language,
        content_type: 'tv_show' as const,
        last_air_date: null,
        status: null,
        type: null,
        tagline: null,
        homepage: null,
        in_production: false,
        number_of_episodes: 0,
        number_of_seasons: 0,
        episode_run_time: null,
        origin_country: show.origin_country || null,
        created_by: null,
        genres: show.genre_ids ? JSON.stringify(show.genre_ids.map((id: number) => ({ id }))) : null,
        keywords: null,
        languages: null,
        last_episode_to_air: null,
        next_episode_to_air: null,
        networks: null,
        production_companies: null,
        production_countries: null,
        seasons: null,
        spoken_languages: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
  }

  private formatChatGPTResults(chatGPTResults: any[]): ContentItem[] {
    return chatGPTResults.map((item: any) => {
      if (item.content_type === 'movie') {
        const originalTitle = item.original_title || item.title;
        return {
          id: item.id,
          title: item.title,
          original_title: originalTitle,
          // Use slug from database if available, otherwise generate from original title
          slug: item.slug || createSEOSlug(item.id, originalTitle, originalTitle),
          overview: item.overview || '',
          release_date: item.release_date,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          vote_average: item.vote_average || 0,
          vote_count: item.vote_count || 0,
          popularity: item.popularity || 0,
          adult: item.adult || false,
          original_language: item.original_language || 'en',
          content_type: 'movie' as const,
          runtime: null,
          status: null,
          tagline: null,
          homepage: null,
          video: false,
          budget: 0,
          revenue: 0,
          imdb_id: null,
          belongs_to_collection: null,
          production_companies: null,
          production_countries: null,
          spoken_languages: null,
          genres: null,
          keywords: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        const originalName = item.original_name || item.name;
        return {
          id: item.id,
          title: item.name,
          name: item.name,
          original_name: originalName,
          // Use slug from database if available, otherwise generate from original name
          slug: item.slug || createSEOSlug(item.id, originalName, originalName),
          overview: item.overview || '',
          first_air_date: item.first_air_date,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          vote_average: item.vote_average || 0,
          vote_count: item.vote_count || 0,
          popularity: item.popularity || 0,
          adult: item.adult || false,
          original_language: item.original_language || 'en',
          content_type: 'tv_show' as const,
          last_air_date: null,
          status: null,
          type: null,
          tagline: null,
          homepage: null,
          in_production: false,
          number_of_episodes: 0,
          number_of_seasons: 0,
          episode_run_time: null,
          origin_country: null,
          created_by: null,
          genres: null,
          keywords: null,
          languages: null,
          last_episode_to_air: null,
          next_episode_to_air: null,
          networks: null,
          production_companies: null,
          production_countries: null,
          seasons: null,
          spoken_languages: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_chat_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  clearSessionId(): void {
    localStorage.removeItem('ai_chat_session_id');
    this.sessionId = this.getOrCreateSessionId();
  }

  async submitFeedback(
    conversationId: string,
    messageId: string,
    query: string,
    extractedParams: QueryParams,
    feedbackType: 'positive' | 'negative' | 'correction',
    resultsCount: number,
    correctedParams?: QueryParams,
    userComment?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ai_query_feedback')
        .insert({
          conversation_id: conversationId,
          message_id: messageId,
          user_id: user?.id || null,
          session_id: user ? null : this.sessionId,
          query,
          extracted_params: extractedParams,
          feedback_type: feedbackType,
          corrected_params: correctedParams || null,
          results_count: resultsCount,
          user_comment: userComment || null,
        });

      if (error) throw error;

      console.log('✅ Feedback submitted successfully');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  async getTrainingPatterns(limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ai_training_patterns')
        .select('*')
        .order('confidence_score', { ascending: false })
        .order('success_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching training patterns:', error);
      return [];
    }
  }
}

export const aiChatService = new AIChatService();
