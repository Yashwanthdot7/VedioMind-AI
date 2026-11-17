import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Library as LibraryIcon, Search, Star, Trash2, Loader2, PlayCircle, Clock } from 'lucide-react';
import { LibraryItem } from '../types';
import { getLibrary, removeFromLibrary, setFavorite } from '../services/apiService';
import { languageLabel } from '../constants/languages';
import { formatDuration } from '../lib/time';
import { errorMessage } from '../lib/errors';

interface LibraryProps {
  onOpen: (item: LibraryItem) => void;
}

export default function Library({ onOpen }: LibraryProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLibrary()
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) =>
      (!favoritesOnly || item.isFavorite) &&
      (!q || item.title.toLowerCase().includes(q) || item.author?.toLowerCase().includes(q)));
  }, [items, query, favoritesOnly]);

  const toggleFavorite = async (item: LibraryItem) => {
    const next = !item.isFavorite;
    setItems((prev) => prev.map((i) => (i.analysisId === item.analysisId ? { ...i, isFavorite: next } : i)));
    try {
      await setFavorite(item.analysisId, next);
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.analysisId === item.analysisId ? { ...i, isFavorite: !next } : i)));
      setError(errorMessage(err));
    }
  };

  const remove = async (item: LibraryItem) => {
    if (!window.confirm(`Remove “${item.title}” and its chat from your library?`)) return;
    const before = items;
    setItems((prev) => prev.filter((i) => i.analysisId !== item.analysisId));
    try {
      await removeFromLibrary(item.analysisId);
    } catch (err) {
      setItems(before);
      setError(errorMessage(err));
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-3 mr-auto">
          <LibraryIcon className="w-7 h-7 text-indigo-400" />
          <h1 className="text-3xl font-bold text-slate-100">My Library</h1>
          {!loading && <span className="text-sm text-slate-500">{items.length} videos</span>}
        </div>
        <button
          onClick={() => setFavoritesOnly((f) => !f)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            favoritesOnly ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Star className={`w-4 h-4 ${favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} /> Favourites
        </button>
        <div className="relative flex items-center w-full sm:w-72">
          <Search className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your videos…"
            className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-24 text-slate-500">
          {items.length === 0
            ? 'Your library is empty. Summarize a video and it will be saved here automatically.'
            : 'No videos match your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((item, i) => (
            <motion.div
              key={item.analysisId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="group bg-slate-900/50 border border-slate-800/50 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-colors"
            >
              <button onClick={() => onOpen(item)} className="block w-full text-left">
                <div className="relative aspect-video bg-slate-950">
                  <img
                    src={item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  <PlayCircle className="absolute inset-0 m-auto w-12 h-12 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {item.duration ? (
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white">
                      <Clock className="w-3 h-3" /> {formatDuration(item.duration)}
                    </span>
                  ) : null}
                </div>
                <div className="p-4 pb-2">
                  <h3 className="font-medium text-slate-200 line-clamp-2 leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {item.author ? `${item.author} · ` : ''}{languageLabel(item.language)} · {new Date(item.addedAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
              <div className="flex justify-end gap-1 px-3 pb-3">
                <button
                  onClick={() => toggleFavorite(item)}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label={item.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
                </button>
                <button
                  onClick={() => remove(item)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                  aria-label="Remove from library"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
