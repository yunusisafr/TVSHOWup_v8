import { SUPPORTED_LANGUAGES } from './languages';

export const AI_CHAT_TRANSLATIONS = {
  en: {
    welcome: "Hello! I'm here to help you discover amazing movies and TV shows. What kind of content are you looking for?",
    suggestionsLabel: "Try these suggestions:",
    placeholder: "What kind of content are you looking for?",
    limitReached: "Daily limit reached...",
    suggestions: [
      "Action movies on Netflix rated 8+",
      "Family movies available on Disney and Hulu",
      "Highly rated series on Apple TV+",
    ],
  },
  tr: {
    welcome: "Merhaba! Size mükemmel film ve dizi önerileri sunmak için buradayım. Ne tür içerik arıyorsunuz?",
    suggestionsLabel: "Önerilen aramalar:",
    placeholder: "Ne tür içerik arıyorsunuz?",
    limitReached: "Günlük limit doldu...",
    suggestions: [
      "Netflix'te 8+ puanlı aksiyon filmleri",
      "Disney ve Hulu'da izlenebilecek aile filmleri",
      "HBO Max'de 2025'te yayınlanan diziler",
    ],
  },
  de: {
    welcome: "Hallo! Ich helfe Ihnen dabei, fantastische Filme und Serien zu entdecken. Welche Art von Inhalten suchen Sie?",
    suggestionsLabel: "Probieren Sie diese Vorschläge:",
    placeholder: "Welche Art von Inhalten suchen Sie?",
    limitReached: "Tageslimit erreicht...",
    suggestions: [
      "Actionfilme auf Netflix mit 8+ Bewertung",
      "Familienfilme auf Disney und Hulu",
      "Top bewertete Serien auf Apple TV+",
    ],
  },
  fr: {
    welcome: "Bonjour! Je suis là pour vous aider à découvrir d'excellents films et séries. Quel type de contenu recherchez-vous?",
    suggestionsLabel: "Essayez ces suggestions:",
    placeholder: "Quel type de contenu recherchez-vous?",
    limitReached: "Limite quotidienne atteinte...",
    suggestions: [
      "Films d'action sur Netflix notés 8+",
      "Films familiaux disponibles sur Disney et Hulu",
      "Séries bien notées sur Apple TV+",
    ],
  },
  es: {
    welcome: "¡Hola! Estoy aquí para ayudarte a descubrir películas y series increíbles. ¿Qué tipo de contenido buscas?",
    suggestionsLabel: "Prueba estas sugerencias:",
    placeholder: "¿Qué tipo de contenido buscas?",
    limitReached: "Límite diario alcanzado...",
    suggestions: [
      "Películas de acción en Netflix con calificación 8+",
      "Películas familiares disponibles en Disney y Hulu",
      "Series mejor valoradas en Apple TV+",
    ],
  },
  it: {
    welcome: "Ciao! Sono qui per aiutarti a scoprire film e serie TV fantastici. Che tipo di contenuti stai cercando?",
    suggestionsLabel: "Prova questi suggerimenti:",
    placeholder: "Che tipo di contenuti stai cercando?",
    limitReached: "Limite giornaliero raggiunto...",
    suggestions: [
      "Film d'azione su Netflix con voto 8+",
      "Film per famiglie disponibili su Disney e Hulu",
      "Serie molto apprezzate su Apple TV+",
    ],
  },
  pt: {
    welcome: "Olá! Estou aqui para ajudá-lo a descobrir filmes e séries incríveis. Que tipo de conteúdo você está procurando?",
    suggestionsLabel: "Experimente estas sugestões:",
    placeholder: "Que tipo de conteúdo você está procurando?",
    limitReached: "Limite diário atingido...",
    suggestions: [
      "Filmes de ação na Netflix com avaliação 8+",
      "Filmes para a família disponíveis na Disney e Hulu",
      "Séries altamente avaliadas no Apple TV+",
    ],
  },
  ru: {
    welcome: "Здравствуйте! Я помогу вам найти потрясающие фильмы и сериалы. Какой контент вы ищете?",
    suggestionsLabel: "Попробуйте эти предложения:",
    placeholder: "Какой контент вы ищете?",
    limitReached: "Дневной лимит достигнут...",
    suggestions: [
      "Боевики на Netflix с рейтингом 8+",
      "Семейные фильмы на Disney и Hulu",
      "Высоко оцененные сериалы на Apple TV+",
    ],
  },
  ja: {
    welcome: "こんにちは！素晴らしい映画やテレビ番組を見つけるお手伝いをします。どんなコンテンツをお探しですか？",
    suggestionsLabel: "これらの提案を試してください：",
    placeholder: "どんなコンテンツをお探しですか？",
    limitReached: "1日の制限に達しました...",
    suggestions: [
      "Netflixの8+評価のアクション映画",
      "DisneyとHuluで視聴可能なファミリー映画",
      "Apple TV+の高評価シリーズ",
    ],
  },
  ko: {
    welcome: "안녕하세요! 멋진 영화와 TV 프로그램을 찾는 데 도움을 드리겠습니다. 어떤 콘텐츠를 찾고 계신가요?",
    suggestionsLabel: "이 제안을 시도해보세요:",
    placeholder: "어떤 콘텐츠를 찾고 계신가요?",
    limitReached: "일일 한도 도달...",
    suggestions: [
      "Netflix의 8+ 평점 액션 영화",
      "Disney와 Hulu에서 시청 가능한 가족 영화",
      "Apple TV+의 높은 평점 시리즈",
    ],
  },
  zh: {
    welcome: "你好！我在这里帮助您发现精彩的电影和电视节目。您在寻找什么类型的内容？",
    suggestionsLabel: "试试这些建议：",
    placeholder: "您在寻找什么类型的内容？",
    limitReached: "已达每日限额...",
    suggestions: [
      "Netflix上评分8+的动作电影",
      "Disney和Hulu上可观看的家庭电影",
      "Apple TV+上高评分系列",
    ],
  },
  ar: {
    welcome: "مرحباً! أنا هنا لمساعدتك في اكتشاف أفلام ومسلسلات رائعة. ما نوع المحتوى الذي تبحث عنه؟",
    suggestionsLabel: "جرب هذه الاقتراحات:",
    placeholder: "ما نوع المحتوى الذي تبحث عنه؟",
    limitReached: "تم الوصول إلى الحد اليومي...",
    suggestions: [
      "أفلام الحركة على Netflix بتقييم 8+",
      "أفلام عائلية متاحة على Disney و Hulu",
      "مسلسلات عالية التقييم على Apple TV+",
    ],
  },
  hi: {
    welcome: "नमस्ते! मैं आपको अद्भुत फिल्में और टीवी शो खोजने में मदद करने के लिए यहां हूं। आप किस प्रकार की सामग्री की तलाश कर रहे हैं?",
    suggestionsLabel: "इन सुझावों को आज़माएं:",
    placeholder: "आप किस प्रकार की सामग्री की तलाश कर रहे हैं?",
    limitReached: "दैनिक सीमा पूरी हुई...",
    suggestions: [
      "Netflix पर 8+ रेटिंग वाली एक्शन फिल्में",
      "Disney और Hulu पर उपलब्ध पारिवारिक फिल्में",
      "Apple TV+ पर उच्च रेटिंग वाली सीरीज़",
    ],
  },
  nl: {
    welcome: "Hallo! Ik ben hier om je te helpen geweldige films en tv-shows te ontdekken. Waar ben je naar op zoek?",
    suggestionsLabel: "Probeer deze suggesties:",
    placeholder: "Waar ben je naar op zoek?",
    limitReached: "Dagelijkse limiet bereikt...",
    suggestions: [
      "Actiefilms op Netflix met beoordeling 8+",
      "Familiefilms beschikbaar op Disney en Hulu",
      "Hoog gewaardeerde series op Apple TV+",
    ],
  },
  sv: {
    welcome: "Hej! Jag är här för att hjälpa dig att upptäcka fantastiska filmer och TV-serier. Vad letar du efter?",
    suggestionsLabel: "Prova dessa förslag:",
    placeholder: "Vad letar du efter?",
    limitReached: "Daglig gräns nådd...",
    suggestions: [
      "Actionfilmer på Netflix med betyg 8+",
      "Familjefilmer tillgängliga på Disney och Hulu",
      "Högt rankade serier på Apple TV+",
    ],
  },
  no: {
    welcome: "Hei! Jeg er her for å hjelpe deg med å oppdage fantastiske filmer og TV-serier. Hva leter du etter?",
    suggestionsLabel: "Prøv disse forslagene:",
    placeholder: "Hva leter du etter?",
    limitReached: "Daglig grense nådd...",
    suggestions: [
      "Actionfilmer på Netflix med vurdering 8+",
      "Familiefilmer tilgjengelig på Disney og Hulu",
      "Høyt rangerte serier på Apple TV+",
    ],
  },
  da: {
    welcome: "Hej! Jeg er her for at hjælpe dig med at opdage fantastiske film og tv-serier. Hvad leder du efter?",
    suggestionsLabel: "Prøv disse forslag:",
    placeholder: "Hvad leder du efter?",
    limitReached: "Daglig grænse nået...",
    suggestions: [
      "Actionfilm på Netflix med bedømmelse 8+",
      "Familiefilm tilgængelige på Disney og Hulu",
      "Højt vurderede serier på Apple TV+",
    ],
  },
  fi: {
    welcome: "Hei! Olen täällä auttamassa sinua löytämään upeita elokuvia ja TV-sarjoja. Mitä etsit?",
    suggestionsLabel: "Kokeile näitä ehdotuksia:",
    placeholder: "Mitä etsit?",
    limitReached: "Päiväraja saavutettu...",
    suggestions: [
      "Toimintaelokuvat Netflixissä arvosanalla 8+",
      "Perheelokuvat saatavilla Disneyltä ja Hulusta",
      "Korkeasti arvostetut sarjat Apple TV+:ssa",
    ],
  },
  pl: {
    welcome: "Cześć! Jestem tutaj, aby pomóc Ci odkrywać niesamowite filmy i seriale. Czego szukasz?",
    suggestionsLabel: "Wypróbuj te sugestie:",
    placeholder: "Czego szukasz?",
    limitReached: "Osiągnięto dzienny limit...",
    suggestions: [
      "Filmy akcji na Netflix z oceną 8+",
      "Filmy familijne dostępne na Disney i Hulu",
      "Wysoko oceniane seriale na Apple TV+",
    ],
  },
  el: {
    welcome: "Γεια σας! Είμαι εδώ για να σας βοηθήσω να ανακαλύψετε υπέροχες ταινίες και τηλεοπτικές σειρές. Τι είδους περιεχόμενο αναζητάτε;",
    suggestionsLabel: "Δοκιμάστε αυτές τις προτάσεις:",
    placeholder: "Τι είδους περιεχόμενο αναζητάτε;",
    limitReached: "Ημερήσιο όριο επιτεύχθηκε...",
    suggestions: [
      "Ταινίες δράσης στο Netflix με βαθμολογία 8+",
      "Οικογενειακές ταινίες διαθέσιμες στο Disney και Hulu",
      "Σειρές με υψηλή βαθμολογία στο Apple TV+",
    ],
  },
};

export function getAIChatTranslation(languageCode: string) {
  const lang = SUPPORTED_LANGUAGES.includes(languageCode as any) ? languageCode : 'en';
  return AI_CHAT_TRANSLATIONS[lang as keyof typeof AI_CHAT_TRANSLATIONS] || AI_CHAT_TRANSLATIONS.en;
}
