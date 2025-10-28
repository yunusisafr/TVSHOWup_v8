import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, ListChecks, Share2, UserPlus } from 'lucide-react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTranslation } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { getUITranslation } from '../config/uiTranslations';

const IntroSection: React.FC = () => {
  const navigate = useNavigate();
  const { languageCode, isLoading: preferencesLoading } = useUserPreferences();
  const { t } = useTranslation(languageCode);
  const { user } = useAuth();

  // Don't show for logged in users
  if (user) return null;

  // Don't render until preferences are loaded
  if (preferencesLoading) {
    return (
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const handleSignUp = () => {
    navigate('/login', { state: { isSignUp: true } });
  };

  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left side - Text content */}
          <div className="md:w-2/3 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {getUITranslation('aiPoweredDiscovery', languageCode)}
            </h1>
            
            <p className="text-gray-300 text-sm sm:text-base">
              {languageCode === 'tr' ? 'Yapay zeka ile kişiselleştirilmiş içerik önerileri alın, tüm streaming platformlarında dizi ve filmleri keşfedin, izleme durumunuzu takip edin ve listenizi arkadaşlarınızla paylaşın.' :
               languageCode === 'de' ? 'Erhalten Sie personalisierte Inhaltsempfehlungen mit KI, entdecken Sie Serien und Filme auf allen Streaming-Plattformen, verfolgen Sie Ihren Fortschritt und teilen Sie Ihre Listen mit Freunden.' :
               languageCode === 'fr' ? 'Obtenez des recommandations de contenu personnalisées avec l\'IA, découvrez des séries et films sur toutes les plateformes de streaming, suivez votre progression et partagez vos listes avec vos amis.' :
               languageCode === 'es' ? 'Obtén recomendaciones de contenido personalizadas con IA, descubre series y películas en todas las plataformas de streaming, rastrea tu progreso y comparte tus listas con amigos.' :
               languageCode === 'it' ? 'Ottieni raccomandazioni di contenuti personalizzate con l\'IA, scopri serie e film su tutte le piattaforme di streaming, monitora i tuoi progressi e condividi le tue liste con gli amici.' :
               'Get personalized content recommendations with AI, discover shows and movies across all streaming platforms, track your progress, and share your lists with friends.'}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                </div>
                <p className="ml-2 text-sm text-gray-300">
                  {languageCode === 'tr' ? 'Yapay zeka destekli kişiselleştirilmiş öneriler' :
                   languageCode === 'de' ? 'KI-gestützte personalisierte Empfehlungen' :
                   languageCode === 'fr' ? 'Recommandations personnalisées par IA' :
                   languageCode === 'es' ? 'Recomendaciones personalizadas con IA' :
                   languageCode === 'it' ? 'Raccomandazioni personalizzate con IA' :
                   'AI-powered personalized recommendations'}
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <p className="ml-2 text-sm text-gray-300">
                  {languageCode === 'tr' ? 'Tüm platformlarda içerik takibi' :
                   languageCode === 'de' ? 'Inhaltsverfolgung auf allen Plattformen' :
                   languageCode === 'fr' ? 'Suivi de contenu sur toutes les plateformes' :
                   languageCode === 'es' ? 'Seguimiento de contenido en todas las plataformas' :
                   languageCode === 'it' ? 'Tracciamento dei contenuti su tutte le piattaforme' :
                   'Multi-platform content tracking'}
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <ListChecks className="h-5 w-5 text-amber-400" />
                </div>
                <p className="ml-2 text-sm text-gray-300">
                  {languageCode === 'tr' ? 'Özelleştirilebilir izleme listeleri' :
                   languageCode === 'de' ? 'Anpassbare Watchlisten' :
                   languageCode === 'fr' ? 'Listes de visionnage personnalisables' :
                   languageCode === 'es' ? 'Listas de seguimiento personalizables' :
                   languageCode === 'it' ? 'Watchlist personalizzabili' :
                   'Customizable watchlists'}
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Share2 className="h-5 w-5 text-pink-400" />
                </div>
                <p className="ml-2 text-sm text-gray-300">
                  {languageCode === 'tr' ? 'Arkadaşlarınızla liste paylaşımı' :
                   languageCode === 'de' ? 'Listen mit Freunden teilen' :
                   languageCode === 'fr' ? 'Partager des listes avec des amis' :
                   languageCode === 'es' ? 'Comparte listas con amigos' :
                   languageCode === 'it' ? 'Condividi liste con gli amici' :
                   'Share lists with friends'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Right side - CTA */}
          <div className="md:w-1/3 flex flex-col items-center md:items-end">
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-6 rounded-xl border border-primary-500/30 shadow-xl w-full max-w-xs backdrop-blur-sm">
              <div className="flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-primary-400 mr-2" />
                <h3 className="text-lg font-bold text-white text-center">
                  {languageCode === 'tr' ? 'Hemen Başlayın' :
                   languageCode === 'de' ? 'Jetzt starten' :
                   languageCode === 'fr' ? 'Commencez maintenant' :
                   languageCode === 'es' ? 'Comienza ahora' :
                   languageCode === 'it' ? 'Inizia ora' :
                   'Get Started Now'}
                </h3>
              </div>
              <p className="text-gray-300 text-sm mb-4 text-center">
                {languageCode === 'tr' ? 'Ücretsiz kayıt olun ve yapay zeka destekli önerilerle izleme deneyiminizi kişiselleştirin!' :
                 languageCode === 'de' ? 'Registrieren Sie sich kostenlos und personalisieren Sie Ihr Seherlebnis mit KI-gestützten Empfehlungen!' :
                 languageCode === 'fr' ? 'Inscrivez-vous gratuitement et personnalisez votre expérience de visionnage avec des recommandations IA!' :
                 languageCode === 'es' ? '¡Regístrate gratis y personaliza tu experiencia de visualización con recomendaciones de IA!' :
                 languageCode === 'it' ? 'Iscriviti gratuitamente e personalizza la tua esperienza di visione con raccomandazioni IA!' :
                 'Sign up for free and personalize your viewing experience with AI-powered recommendations!'}
              </p>
              <button
                onClick={handleSignUp}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-3 px-4 rounded-lg flex items-center justify-center transition-all shadow-lg hover:shadow-primary-500/50 hover:scale-105"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                {languageCode === 'tr' ? 'Ücretsiz Hesap Oluştur' :
                 languageCode === 'de' ? 'Kostenloses Konto erstellen' :
                 languageCode === 'fr' ? 'Créer un compte gratuit' :
                 languageCode === 'es' ? 'Crear cuenta gratuita' :
                 languageCode === 'it' ? 'Crea account gratuito' :
                 'Create Free Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntroSection;