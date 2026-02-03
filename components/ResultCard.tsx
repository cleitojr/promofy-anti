import React, { useState, useEffect } from 'react';
import { GeneratedCopy } from '../types';
import CopyButton from './CopyButton';
import { Smartphone, Home, Sparkles, Shirt, Coffee, Flame, HelpCircle, ExternalLink } from 'lucide-react';

interface ResultCardProps {
  result: GeneratedCopy;
}

const getCategoryStyles = (category: string) => {
  switch (category) {
    case 'TECH': return { icon: <Smartphone size={16} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', label: 'Tecnologia' };
    case 'HOME': return { icon: <Home size={16} />, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', label: 'Casa' };
    case 'BEAUTY': return { icon: <Sparkles size={16} />, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100', label: 'Beleza' };
    case 'FASHION': return { icon: <Shirt size={16} />, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', label: 'Moda' };
    case 'FOOD': return { icon: <Coffee size={16} />, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100', label: 'Alimentos' };
    case 'VIRAL': return { icon: <Flame size={16} />, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', label: 'Viral' };
    default: return { icon: <HelpCircle size={16} />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', label: 'Geral' };
  }
};

const ResultCard: React.FC<ResultCardProps> = ({ result }) => {
  const style = getCategoryStyles(result.category);
  const [editableText, setEditableText] = useState(result.text || '');

  // Update text if result prop changes
  useEffect(() => {
    setEditableText(result.text || '');
  }, [result.text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableText(e.target.value);
  };

  return (
    <div className="group bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-xl hover:shadow-slate-200/60 hover:border-green-500/20">

      {/* Card Header */}
      <div className="px-5 py-3 border-b border-slate-50 flex justify-between items-center bg-white">
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}>
          {style.icon}
          <span>{style.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md max-w-[180px]">
          <ExternalLink size={10} />
          <span className="truncate">{result.originalLink || 'Link não detectado'}</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-5 pb-5 pt-5">
        <div className="relative">
          {/* Simulated WhatsApp Bubble Background */}
          <div className="bg-[#DCF8C6]/30 p-1 rounded-tl-lg rounded-tr-2xl rounded-br-2xl rounded-bl-lg border border-[#DCF8C6] mb-4 relative focus-within:ring-2 focus-within:ring-green-400/50 focus-within:border-green-400 transition-all">

            {/* Small triangle for chat bubble effect */}
            <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-[#DCF8C6] border-l-[10px] border-l-transparent transform rotate-0 opacity-100 hidden sm:block"></div>

            {/* Product Image (if available) */}
            {result.imageUrl && (
              <div className="p-2 pb-0">
                <img
                  src={result.imageUrl}
                  alt="Produto"
                  className="w-full h-48 object-cover rounded-lg border border-green-100 shadow-sm"
                />
              </div>
            )}

            <textarea
              value={editableText}
              onChange={handleTextChange}
              className="w-full bg-transparent border-none focus:ring-0 p-3 text-[15px] leading-relaxed text-slate-800 font-sans resize-y min-h-[160px] outline-none"
              spellCheck={false}
            />

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-[10px] text-green-700/60 bg-white/50 px-1.5 py-0.5 rounded backdrop-blur-sm">Editável</span>
            </div>
          </div>
        </div>

        {/* Actions Grid - Only Copy Button */}
        <div className="border-t border-slate-50 pt-3 flex justify-center w-full">
          <div className="w-full max-w-[200px] flex justify-center">
            <CopyButton text={editableText} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;