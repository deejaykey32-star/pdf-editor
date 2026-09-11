import {
  TranslationLanguage,
  TranslationProgress,
  ExtractedBookModel,
  ExtractedChapter,
  ExtractedParagraph,
} from '@/types/kdp-epub';

/**
 * Comprehensive list of 36 supported world languages with ISO codes, flags, and names
 */
export const AVAILABLE_TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: 'en', name: 'Angielski', nativeName: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Niemiecki', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Hiszpański', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Francuski', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Włoski', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'uk', name: 'Ukraiński', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'cs', name: 'Czeski', nativeName: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', name: 'Słowacki', nativeName: 'Slovenčina', flag: '🇸🇰' },
  { code: 'pt', name: 'Portugalski', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Holenderski', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Szwedzki', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norweski', nativeName: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Duński', nativeName: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Fiński', nativeName: 'Suomi', flag: '🇫🇮' },
  { code: 'pl', name: 'Polski', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Rosyjski', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ro', name: 'Rumuński', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'hu', name: 'Węgierski', nativeName: 'Magyar', flag: '🇭🇺' },
  { code: 'el', name: 'Grecki', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'tr', name: 'Turecki', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'zh-CN', name: 'Chiński (Uproszczony)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chiński (Tradycyjny)', nativeName: '繁體中文', flag: '🇹🇼' },
  { code: 'ja', name: 'Japoński', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Koreański', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabski', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'he', name: 'Hebrajski', nativeName: 'עברית', flag: '🇮🇱' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'id', name: 'Indonezyjski', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'vi', name: 'Wietnamski', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'hr', name: 'Chorwacki', nativeName: 'Hrvatski', flag: '🇭🇷' },
  { code: 'bg', name: 'Bułgarski', nativeName: 'Български', flag: '🇧🇬' },
  { code: 'sr', name: 'Serbski', nativeName: 'Српски', flag: '🇷🇸' },
  { code: 'sl', name: 'Słoweński', nativeName: 'Slovenščina', flag: '🇸🇮' },
  { code: 'lt', name: 'Litewski', nativeName: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv', name: 'Łotewski', nativeName: 'Latviešu', flag: '🇱🇻' },
  { code: 'et', name: 'Estoński', nativeName: 'Eesti', flag: '🇪🇪' },
];

/**
 * In-memory translation cache to avoid re-fetching duplicate phrases
 */
const translationCache = new Map<string, string>();

/**
 * Translates a single string into target language using Google Translate free endpoint
 * with fallback to MyMemory API.
 */
export async function translateSingleString(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto',
  signal?: AbortSignal
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  // Don't translate pure numbers or punctuation
  if (/^[\d\s.,:;!?()[\]{}<>\-_/\\+=*&%$#@|~`"']+$/.test(trimmed)) {
    return text;
  }

  const cacheKey = `${sourceLang}:${targetLang}:${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // 1. Attempt Google Translate public client endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;

    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((item: any) => (Array.isArray(item) ? item[0] : ''))
          .filter(Boolean)
          .join('');

        if (translated) {
          translationCache.set(cacheKey, translated);
          return translated;
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    // Continue to fallback
  }

  // 2. Fallback to MyMemory API
  try {
    const pair = `${sourceLang === 'auto' ? 'pl' : sourceLang}|${targetLang}`;
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed
    )}&langpair=${encodeURIComponent(pair)}`;

    const res = await fetch(myMemoryUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (translated && typeof translated === 'string' && !translated.startsWith('MYMEMORY WARNING')) {
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
  }

  // If both fail, return original text
  return text;
}

/**
 * Intelligent batch paragraph translator
 * Batches short paragraphs together with a unique separator to reduce HTTP requests
 */
export async function translateParagraphBatch(
  paragraphs: string[],
  targetLang: string,
  sourceLang: string = 'auto',
  signal?: AbortSignal
): Promise<string[]> {
  if (paragraphs.length === 0) return [];
  if (paragraphs.length === 1) {
    const single = await translateSingleString(paragraphs[0], targetLang, sourceLang, signal);
    return [single];
  }

  const SEPARATOR = ' [[§]] ';
  const combined = paragraphs.join(SEPARATOR);

  // If combined length is acceptable for URL request (< 1800 chars), translate all at once
  if (combined.length < 1800) {
    try {
      const translatedCombined = await translateSingleString(combined, targetLang, sourceLang, signal);
      const parts = translatedCombined.split(/\s*\[\[§\]\]\s*/);
      if (parts.length === paragraphs.length) {
        return parts;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  // Otherwise translate each individually with parallel concurrency limit
  const results: string[] = [];
  const chunkSize = 4;
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    if (signal?.aborted) {
      throw new DOMException('Aborted by user', 'AbortError');
    }
    const chunk = paragraphs.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((p) => translateSingleString(p, targetLang, sourceLang, signal))
    );
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Translates an entire ExtractedBookModel into target language with progress notifications
 */
export async function translateBookModel(
  bookModel: ExtractedBookModel,
  targetLang: string,
  onProgress?: (progress: TranslationProgress) => void,
  signal?: AbortSignal
): Promise<ExtractedBookModel> {
  const totalChapters = bookModel.chapters.length;
  let totalParagraphs = 0;
  bookModel.chapters.forEach((ch) => {
    totalParagraphs += ch.paragraphs.length;
  });
  // Add 2 for book title & author
  totalParagraphs += 2;

  let currentParagraphCount = 0;

  const updateProgress = (sample?: string) => {
    const percent = Math.min(100, Math.round((currentParagraphCount / totalParagraphs) * 100));
    onProgress?.({
      status: 'translating',
      currentChapter: 0,
      totalChapters,
      currentParagraph: currentParagraphCount,
      totalParagraphs,
      percent,
      currentTextSample: sample,
      targetLang,
    });
  };

  updateProgress('Tłumaczenie tytułu i metadanych...');

  // 1. Translate Book Title
  let translatedTitle = bookModel.title;
  if (bookModel.title) {
    translatedTitle = await translateSingleString(bookModel.title, targetLang, 'auto', signal);
    currentParagraphCount++;
    updateProgress(translatedTitle);
  }

  // 2. Author generally stays the same, but translate if subtitle/role exists
  let translatedAuthor = bookModel.author;
  currentParagraphCount++;
  updateProgress(translatedAuthor);

  // 3. Translate Chapters
  const translatedChapters: ExtractedChapter[] = [];

  for (let chIdx = 0; chIdx < totalChapters; chIdx++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted by user', 'AbortError');
    }

    const chapter = bookModel.chapters[chIdx];

    onProgress?.({
      status: 'translating',
      currentChapter: chIdx + 1,
      totalChapters,
      currentParagraph: currentParagraphCount,
      totalParagraphs,
      percent: Math.min(100, Math.round((currentParagraphCount / totalParagraphs) * 100)),
      currentTextSample: chapter.title,
      targetLang,
    });

    // Translate chapter title
    const translatedChapterTitle = await translateSingleString(
      chapter.title,
      targetLang,
      'auto',
      signal
    );

    // Group chapter paragraphs into batches of 3-5
    const batchSize = 3;
    const translatedParagraphs: ExtractedParagraph[] = [];

    for (let pIdx = 0; pIdx < chapter.paragraphs.length; pIdx += batchSize) {
      if (signal?.aborted) {
        throw new DOMException('Aborted by user', 'AbortError');
      }

      const batch = chapter.paragraphs.slice(pIdx, pIdx + batchSize);
      const batchTexts = batch.map((p) => p.text);

      const translatedTexts = await translateParagraphBatch(
        batchTexts,
        targetLang,
        'auto',
        signal
      );

      for (let b = 0; b < batch.length; b++) {
        const originalPara = batch[b];
        const newText = translatedTexts[b] || originalPara.text;

        translatedParagraphs.push({
          ...originalPara,
          text: newText,
        });

        currentParagraphCount++;
      }

      const latestSample = translatedTexts[0]?.slice(0, 70) || '';
      updateProgress(latestSample);

      // Brief delay to remain within friendly rate limits
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    translatedChapters.push({
      ...chapter,
      title: translatedChapterTitle,
      paragraphs: translatedParagraphs,
    });
  }

  // Re-calculate word count
  let newTotalWords = 0;
  translatedChapters.forEach((ch) => {
    ch.paragraphs.forEach((p) => {
      newTotalWords += p.text.split(/\s+/).filter(Boolean).length;
    });
  });

  onProgress?.({
    status: 'completed',
    currentChapter: totalChapters,
    totalChapters,
    currentParagraph: totalParagraphs,
    totalParagraphs,
    percent: 100,
    currentTextSample: 'Tłumaczenie zakończone pomyślnie!',
    targetLang,
  });

  return {
    title: translatedTitle,
    author: translatedAuthor,
    chapters: translatedChapters,
    totalWords: newTotalWords,
    sourcePageCount: bookModel.sourcePageCount,
    language: targetLang,
  };
}

/**
 * Clears the in-memory translation cache
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
