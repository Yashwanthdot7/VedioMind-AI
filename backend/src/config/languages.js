/**
 * Languages the AI can answer in. Codes are ISO 639-1.
 * Keep in sync with Frontend/src/constants/languages.ts
 */
const LANGUAGES = {
    en: 'English',
    hi: 'Hindi',
    kn: 'Kannada',
    ta: 'Tamil',
    te: 'Telugu',
    ml: 'Malayalam',
    mr: 'Marathi',
    bn: 'Bengali',
    gu: 'Gujarati',
    ur: 'Urdu',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ar: 'Arabic',
    ja: 'Japanese',
};

const DEFAULT_LANGUAGE = 'en';

const isSupportedLanguage = (code) => Object.prototype.hasOwnProperty.call(LANGUAGES, code);

const languageName = (code) => LANGUAGES[code] || LANGUAGES[DEFAULT_LANGUAGE];

module.exports = { LANGUAGES, DEFAULT_LANGUAGE, isSupportedLanguage, languageName };
