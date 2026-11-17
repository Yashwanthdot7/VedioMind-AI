/**
 * Free fallback narration using the browser's built-in speech (Web Speech API).
 * Used when the Gemini voice isn't available. Costs nothing, works offline on most OSes.
 */

const LOCALES: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN', mr: 'mr-IN',
  bn: 'bn-IN', gu: 'gu-IN', ur: 'ur-IN', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ar: 'ar-SA', ja: 'ja-JP',
};

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const locale = LOCALES[lang] || lang;
  return voices.find((v) => v.lang === locale)
    || voices.find((v) => v.lang.toLowerCase().startsWith(`${lang}-`))
    || voices.find((v) => v.lang.toLowerCase().startsWith(lang));
}

/** Whether this computer has a voice for the language (otherwise the default voice reads it, often badly) */
export function hasVoiceFor(lang: string): boolean {
  return speechSupported() && Boolean(pickVoice(lang));
}

/**
 * Speak `text`; calls onEnd once when finished. `maxSeconds` is a safety net:
 * some browsers never fire onend (or have no voice at all), so we move on anyway.
 */
export function speak(text: string, lang: string, audience: string, onEnd: () => void, maxSeconds = 30): () => void {
  if (!speechSupported()) {
    onEnd();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALES[lang] || lang;
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.rate = audience === 'kids' ? 0.95 : 1;
  utterance.pitch = audience === 'kids' ? 1.1 : 1;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    onEnd();
  };
  const timer = window.setTimeout(finish, maxSeconds * 1000);
  utterance.onend = finish;
  utterance.onerror = finish;
  synth.speak(utterance);
  return () => {
    done = true;
    window.clearTimeout(timer);
    synth.cancel();
  };
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
