import React, { useState, useRef, useEffect } from 'react';
import { generateAffiliateText } from './services/geminiService';
import { GeneratedCopy, AppStatus } from './types';
import ResultCard from './components/ResultCard';
import HistoryView from './components/HistoryView';
import {
  Wand2, AlertCircle, Trash2, MessageSquare,
  ImageIcon, X, Plus, History, LayoutGrid,
  ArrowLeft, CheckCircle2, Loader2
} from 'lucide-react';

import { supabase } from './services/supabase';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';

type ViewState = 'input' | 'loading' | 'results' | 'history';

const AppContent: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewState>('input');

  // Data State
  const [inputText, setInputText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<GeneratedCopy[]>([]);
  const [history, setHistory] = useState<GeneratedCopy[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Loading State
  const [progress, setProgress] = useState(0);
  // Ref for interval to ensure we can clear it from anywhere
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load History from Supabase/LocalStorage on mount
  useEffect(() => {
    const loadHistory = async () => {
      // First try local storage for immediate UI
      const savedHistory = localStorage.getItem('affilizap_history');
      if (savedHistory) {
        try {
          setHistory(JSON.parse(savedHistory));
        } catch (e) {
          console.error("Failed to parse history", e);
        }
      }

      // Then try Supabase if available
      try {
        const { data, error } = await supabase
          .from('link_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (data && !error) {
          // Merge or replace? Let's replace for now to keep it clean
          const supabaseHistory: GeneratedCopy[] = data.map(item => ({
            id: item.id,
            originalLink: item.original_url,
            text: item.text || item.generated_url, // fallback
            platform: item.platform as any,
            category: 'OTHER', // Default or fetch if stored
            timestamp: new Date(item.created_at).getTime(),
            isError: item.status === 'error'
          }));

          if (supabaseHistory.length > 0) {
            setHistory(supabaseHistory);
          }
        }
      } catch (e) {
        console.error("Supabase load error", e);
      }
    };

    loadHistory();
  }, []);

  // Save History to LocalStorage whenever it changes
  // CRITICAL FIX: Do NOT save base64 images to localStorage to prevent QuotaExceededError and White Screen crashes
  useEffect(() => {
    try {
      const historyToSave = history.map(item => ({
        ...item,
        imageUrl: undefined // Strip image data before saving
      }));
      localStorage.setItem('affilizap_history', JSON.stringify(historyToSave));
    } catch (e) {
      console.error("Storage limit reached, could not save history", e);
    }
  }, [history]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
              setImages(prev => [...prev, event.target!.result as string]);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to Array to iterate
      const files = Array.from(e.target.files);

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result && typeof event.target.result === 'string') {
            setImages(prev => {
              // Prevent duplicates if possible, or just append
              if (prev.length >= 5) return prev; // Hard limit 5 via upload
              return [...prev, event.target!.result as string];
            });
          }
        };
        // Explicitly cast file to Blob to satisfy type checking if inference is unknown
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    const links = inputText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (links.length === 0 && images.length === 0) {
      setErrorMsg("Por favor, cole um link ou uma imagem do produto.");
      return;
    }

    if (links.length > 5) {
      setErrorMsg("Por favor, processe no máximo 5 links por vez.");
      return;
    }

    setErrorMsg(null);
    setCurrentView('loading');
    setProgress(0);
    setResults([]);

    // Clear any existing interval
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // Simulate progress
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90;
        return prev + Math.floor(Math.random() * 10) + 5;
      });
    }, 500);

    try {
      const generatedData = await generateAffiliateText(links, images);

      // Ensure we hit 100% and clear interval
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);

      // Delay slightly to show 100% completion before switching
      setTimeout(() => {
        setResults(generatedData);

        // Add valid results to history
        const validResults = generatedData.filter(d => !d.isError);
        if (validResults.length > 0) {
          setHistory(prev => [...validResults, ...prev]);

          // Save to Supabase
          validResults.forEach(async (res) => {
            try {
              await supabase.from('link_history').insert({
                original_url: res.originalLink,
                generated_url: res.text,
                platform: res.platform,
                status: 'success'
              });
            } catch (e) {
              console.error("Failed to save to Supabase", e);
            }
          });
        }

        // Auto-clear inputs
        setImages([]);
        setInputText('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        setCurrentView('results');
      }, 600);

    } catch (error) {
      // Robust error handling
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      console.error(error);
      setErrorMsg("Ocorreu um erro ao conectar com a IA. Tente novamente.");
      setCurrentView('input');
    }
  };

  const startNew = () => {
    setResults([]);
    setInputText('');
    setImages([]);
    setErrorMsg(null);
    setCurrentView('input');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('affilizap_history');
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // --- RENDER HELPERS ---

  const renderNavbar = () => (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-white/50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setCurrentView('input')}
        >
          <div className="bg-gradient-to-tr from-green-600 to-emerald-500 text-white p-2 rounded-lg shadow-lg shadow-green-500/20">
            <MessageSquare size={20} fill="currentColor" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">AffiliZap Gen</h1>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">AI Copywriter</span>
          </div>
        </div>

        <nav className="flex items-center bg-slate-100/50 p-1 rounded-xl border border-slate-200/60">
          <button
            onClick={() => setCurrentView('input')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'input' || currentView === 'loading' || currentView === 'results'
              ? 'bg-white text-green-700 shadow-sm border border-slate-100'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <LayoutGrid size={14} />
            <span className="hidden xs:inline">Gerador</span>
          </button>
          <button
            onClick={() => setCurrentView('history')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'history'
              ? 'bg-white text-green-700 shadow-sm border border-slate-100'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <History size={14} />
            <span className="hidden xs:inline">Histórico</span>
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-[11px] font-bold text-slate-900 leading-none">{user?.user_metadata?.full_name || user?.email?.split('@')[0]}</span>
            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Premium User</span>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Sair"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>
    </header>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-green-600 animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const renderInputView = () => (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Transforme Links em <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">Vendas</span>
        </h2>
        <p className="text-lg text-slate-600 leading-relaxed">
          Cole seus links e prints abaixo. Vamos criar a copy perfeita para o WhatsApp.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all hover:shadow-2xl hover:shadow-slate-200/60">
        <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entrada de Dados</span>
          {inputText || images.length > 0 ? (
            <button onClick={() => { setInputText(''); setImages([]); }} className="text-xs text-slate-400 hover:text-red-600 font-medium flex items-center gap-1 transition-colors">
              <Trash2 size={12} /> Limpar
            </button>
          ) : null}
        </div>

        <div className="p-6">
          <div className="relative group">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Cole aqui os links (1 por linha) ou deixe vazio se o link estiver no print..."
              className="w-full h-40 bg-slate-50 hover:bg-white focus:bg-white p-4 rounded-xl border-2 border-transparent focus:border-green-500/30 outline-none resize-none text-sm transition-all text-slate-700 placeholder:text-slate-400 font-medium"
              style={{ boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)' }}
            />
            {images.length === 0 && !inputText && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-center opacity-40">
                  <p className="text-xs">Dica: Cole um Print (Ctrl+V) aqui</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            {images.length > 0 ? (
              <>
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prints Anexados ({images.length})</span>
                  <button onClick={clearImages} className="text-[11px] text-red-500 hover:text-red-600 font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors">
                    Remover todas
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square">
                      <img src={img} alt="Preview" className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button onClick={() => removeImage(idx)} className="text-white bg-red-500/80 hover:bg-red-600 p-1.5 rounded-full backdrop-blur-sm transition-transform hover:scale-110">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <button onClick={() => fileInputRef.current?.click()} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:text-green-600 hover:border-green-300 hover:bg-green-50/50 transition-all">
                      <Plus size={20} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-green-600 hover:border-green-400 hover:bg-green-50/30 transition-all group">
                <div className="p-1.5 bg-slate-100 group-hover:bg-white rounded-md transition-colors shadow-sm">
                  <ImageIcon size={16} />
                </div>
                <span className="text-sm font-medium">Adicionar Print/Foto do Produto</span>
              </button>
            )}
            {/* Added 'multiple' attribute to allow selecting multiple images at once */}
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" ref={fileInputRef} />
          </div>

          {errorMsg && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleGenerate}
              disabled={!inputText.trim() && images.length === 0}
              className="w-full relative overflow-hidden group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-300 disabled:to-slate-400 text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-green-600/20 hover:shadow-green-600/30 transition-all active:scale-[0.98] text-lg"
            >
              <div className="flex items-center justify-center gap-2 relative z-10">
                <Wand2 size={24} className="group-hover:rotate-12 transition-transform" />
                <span>Gerar Copy de Vendas</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLoadingView = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-xl mx-auto text-center px-4 animate-in fade-in duration-500">
      <div className="w-full mb-8 relative">
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <span>Iniciando IA</span>
          <span>Analisando Produto</span>
          <span>Criando Copy</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-full shadow-xl shadow-green-100 mb-6 relative">
        <div className="absolute inset-0 rounded-full border-4 border-green-100 border-t-green-500 animate-spin"></div>
        <Wand2 size={40} className="text-green-600 relative z-10" />
      </div>

      <h3 className="text-2xl font-bold text-slate-800 mb-2">Criando sua oferta irresistível...</h3>
      <p className="text-slate-500">Estamos analisando a imagem, detectando preços e aplicando gatilhos mentais.</p>
    </div>
  );

  const renderResultsView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="text-green-500" size={32} />
            Suas Copys Estão Prontas!
          </h2>
          <p className="text-slate-500 mt-1">Copie abaixo e cole direto no WhatsApp.</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
        >
          <ArrowLeft size={18} />
          Criar Novos Textos
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {results.map((result, idx) => (
          <div key={result.id} className="animate-in zoom-in-50 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            <ResultCard result={result} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-emerald-50/50 text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {renderNavbar()}

      <main className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        {currentView === 'history' && (
          <HistoryView
            history={history}
            onClearHistory={clearHistory}
            onDeleteItem={deleteHistoryItem}
          />
        )}

        {currentView === 'input' && renderInputView()}
        {currentView === 'loading' && renderLoadingView()}
        {currentView === 'results' && renderResultsView()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;