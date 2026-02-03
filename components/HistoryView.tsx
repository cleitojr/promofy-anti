import React, { useState } from 'react';
import { GeneratedCopy } from '../types';
import ResultCard from './ResultCard';
import { Search, ShoppingBag, ShoppingCart, Truck, Store, Package, Grid, Trash2 } from 'lucide-react';

interface HistoryViewProps {
  history: GeneratedCopy[];
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory, onDeleteItem }) => {
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const platforms = [
    { id: 'ALL', label: 'Todos', icon: <Grid size={14} /> },
    { id: 'AMAZON', label: 'Amazon', icon: <ShoppingCart size={14} /> },
    { id: 'SHOPEE', label: 'Shopee', icon: <ShoppingBag size={14} /> },
    { id: 'MERCADO_LIVRE', label: 'Mercado Livre', icon: <Truck size={14} /> },
    { id: 'MAGALU', label: 'Magalu', icon: <Store size={14} /> },
    { id: 'OTHER', label: 'Outros', icon: <Package size={14} /> },
  ];

  const filteredHistory = history.filter(item => {
    // Check if item matches platform filter
    const matchesPlatform = filterPlatform === 'ALL' || item.platform === filterPlatform;

    // Check search term against link or text
    // Fallback for text to empty string in case of malformed data
    const textContent = item.text || '';
    const matchesSearch = item.originalLink.toLowerCase().includes(searchTerm.toLowerCase()) ||
      textContent.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesPlatform && matchesSearch;
  }).sort((a, b) => b.timestamp - a.timestamp);

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Histórico de Criações</h2>
          <p className="text-slate-500 text-sm">Gerencie, edite e reposte suas copys antigas.</p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Tem certeza que deseja apagar todo o histórico?')) {
                onClearHistory();
              }
            }}
            className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
            Limpar Histórico
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <Grid size={32} className="text-slate-300" />
          </div>
          <h3 className="text-slate-900 font-semibold text-lg">Nada por aqui ainda</h3>
          <p className="text-slate-500 max-w-xs mt-1">Gere suas primeiras copys na aba "Gerador" e elas aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por link ou texto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar lg:pb-0">
              {platforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFilterPlatform(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filterPlatform === p.id
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="grid gap-6">
            {filteredHistory.map((item) => (
              <div key={item.id} className="relative">
                <div className="absolute -top-3 left-4 z-10 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {formatDate(item.timestamp)}
                </div>
                <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-2 bg-white text-slate-400 hover:text-red-500 rounded-lg shadow-sm border border-slate-100 hover:bg-red-50"
                    title="Remover item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <ResultCard result={item} />
              </div>
            ))}

            {filteredHistory.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm italic">
                Nenhum item encontrado com esses filtros.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HistoryView;