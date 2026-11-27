import type { OutputLanguage } from '../../proposal-preferences/proposal-preferences.schema';

/**
 * High-frequency function words for each output language. A `Record` keyed
 * by `OutputLanguage`, so adding a language to `OUTPUT_LANGUAGES` does not
 * compile until it has a list here.
 *
 * Many of these words belong to more than one language: `a` is English,
 * Spanish, Portuguese and Italian, `in` is English, German, Italian and
 * Dutch. A word listed for two or more languages says nothing about which
 * one a text is in, so it is not counted at all (see `DISTINCTIVE`). Listing
 * a shared word under each language that uses it is what keeps it from
 * counting against the others: German `an` and `was` are listed so a German
 * draft does not score as English, and French `on`, `il`, `met` and `nos` are
 * listed so a casual French answer ("on a déjà fait ça, il y a un an") does
 * not score as English, Italian, Dutch or Portuguese.
 */
const STOPWORDS: Record<OutputLanguage, readonly string[]> = {
  en: [
    'a',
    'also',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'been',
    'but',
    'by',
    'can',
    'for',
    'from',
    'has',
    'have',
    'i',
    'in',
    'is',
    'it',
    'my',
    'not',
    'of',
    'on',
    'or',
    'our',
    'that',
    'the',
    'they',
    'this',
    'to',
    'was',
    'we',
    'which',
    'will',
    'with',
    'would',
    'you',
    'your',
  ],
  fr: [
    'à',
    'ai',
    'au',
    'aussi',
    'aux',
    'avec',
    'ce',
    'cette',
    'dans',
    'de',
    'des',
    'du',
    'en',
    'est',
    'et',
    'il',
    'je',
    'la',
    'le',
    'les',
    'met',
    'mon',
    'nos',
    'nous',
    'on',
    'ou',
    'par',
    'pas',
    'peux',
    'pour',
    'que',
    'qui',
    'sur',
    'très',
    'un',
    'une',
    'vos',
    'votre',
    'vous',
  ],
  de: [
    'aber',
    'an',
    'auch',
    'auf',
    'das',
    'dass',
    'dem',
    'den',
    'der',
    'die',
    'ein',
    'eine',
    'einen',
    'es',
    'für',
    'habe',
    'ich',
    'ihnen',
    'ihr',
    'ihre',
    'ist',
    'kann',
    'mit',
    'nicht',
    'noch',
    'oder',
    'sehr',
    'sie',
    'sind',
    'und',
    'von',
    'was',
    'wenn',
    'wir',
    'zu',
  ],
  es: [
    'a',
    'al',
    'así',
    'con',
    'de',
    'del',
    'el',
    'en',
    'es',
    'esta',
    'este',
    'hay',
    'la',
    'las',
    'lo',
    'los',
    'más',
    'mi',
    'mientras',
    'muy',
    'para',
    'pero',
    'por',
    'porque',
    'puedo',
    'que',
    'se',
    'su',
    'sus',
    'también',
    'un',
    'una',
    'usted',
    'y',
  ],
  it: [
    'a',
    'al',
    'alla',
    'anche',
    'che',
    'con',
    'da',
    'dei',
    'del',
    'della',
    'di',
    'e',
    'gli',
    'ho',
    'i',
    'il',
    'in',
    'la',
    'le',
    'lo',
    'mi',
    'nel',
    'non',
    'per',
    'più',
    'posso',
    'questa',
    'questo',
    'quindi',
    'sono',
    'su',
    'un',
    'una',
  ],
  nl: [
    'aan',
    'als',
    'bij',
    'dat',
    'de',
    'die',
    'dus',
    'een',
    'en',
    'heb',
    'heeft',
    'het',
    'ik',
    'in',
    'is',
    'je',
    'kan',
    'maar',
    'met',
    'naar',
    'niet',
    'of',
    'om',
    'ook',
    'op',
    'te',
    'u',
    'uw',
    'van',
    'voor',
    'was',
    'wat',
    'we',
    'wij',
    'zijn',
    'zou',
  ],
  pt: [
    'a',
    'ao',
    'as',
    'com',
    'da',
    'das',
    'de',
    'do',
    'dos',
    'e',
    'em',
    'então',
    'esta',
    'este',
    'eu',
    'já',
    'mais',
    'na',
    'não',
    'no',
    'nos',
    'num',
    'numa',
    'o',
    'os',
    'para',
    'pela',
    'pelo',
    'por',
    'posso',
    'que',
    'se',
    'seu',
    'sua',
    'também',
    'um',
    'uma',
    'você',
    'é',
  ],
};

/** Each word that is listed for exactly one language, and that language. */
const DISTINCTIVE: ReadonlyMap<string, OutputLanguage> = (() => {
  const owners = new Map<string, OutputLanguage[]>();
  for (const [language, words] of Object.entries(STOPWORDS) as Array<
    [OutputLanguage, readonly string[]]
  >) {
    for (const word of words) {
      owners.set(word, [...(owners.get(word) ?? []), language]);
    }
  }
  const distinctive = new Map<string, OutputLanguage>();
  for (const [word, languages] of owners) {
    const [only, ...others] = languages;
    if (only && others.length === 0) distinctive.set(word, only);
  }
  return distinctive;
})();

/** How few distinctive words a rival language needs before it counts. */
const MIN_RIVAL_HITS = 3;

/**
 * An all-caps word of two or more letters: an acronym such as `AI`, `IT` or
 * `US`, not a function word. Lowercased, `AI` would read as French `ai`, so
 * an English answer listing AI tools would score as French.
 */
function isAcronym(word: string): boolean {
  return (
    word.length >= 2 &&
    word === word.toLocaleUpperCase() &&
    word !== word.toLocaleLowerCase()
  );
}

/** The distinctive stopwords of each language found in `text`. */
export function languageHits(text: string): Record<OutputLanguage, number> {
  const hits = Object.fromEntries(
    Object.keys(STOPWORDS).map((language) => [language, 0]),
  ) as Record<OutputLanguage, number>;
  for (const word of text.match(/\p{L}+/gu) ?? []) {
    if (isAcronym(word)) continue;
    const language = DISTINCTIVE.get(word.toLocaleLowerCase());
    if (language) hits[language] += 1;
  }
  return hits;
}

/**
 * Whether `text` reads as a language other than `requested`: some other
 * language has at least three distinctive stopwords in it, and more than the
 * requested one has.
 *
 * It errs toward passing. A short block has too few function words to judge,
 * so it passes rather than risk rejecting a valid draft; the caller also
 * skips blocks under eight words. Over a paragraph the requested language
 * leads by a wide margin. The tests hold samples in every language.
 */
export function isInOtherLanguage(
  text: string,
  requested: OutputLanguage,
): boolean {
  const hits = languageHits(text);
  return (Object.keys(hits) as OutputLanguage[]).some(
    (language) =>
      language !== requested &&
      hits[language] >= MIN_RIVAL_HITS &&
      hits[language] > hits[requested],
  );
}

/** The distinctive words listed for `language`, for tests. */
export function distinctiveWords(language: OutputLanguage): string[] {
  return [...DISTINCTIVE].flatMap(([word, owner]) =>
    owner === language ? [word] : [],
  );
}
