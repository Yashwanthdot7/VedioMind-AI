import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
// Anek (Ek Type): one family across Latin and Indian scripts, with width + weight axes.
// Each script's files are only downloaded when text in that script appears.
import '@fontsource-variable/anek-latin/wdth.css';
import '@fontsource-variable/anek-devanagari/wdth.css';
import '@fontsource-variable/anek-kannada/wdth.css';
import '@fontsource-variable/anek-tamil/wdth.css';
import '@fontsource-variable/anek-telugu/wdth.css';
import '@fontsource-variable/anek-malayalam/wdth.css';
import '@fontsource-variable/anek-bangla/wdth.css';
import '@fontsource-variable/anek-gujarati/wdth.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
