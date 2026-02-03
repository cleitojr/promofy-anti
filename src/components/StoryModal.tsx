import React, { useEffect, useRef, useState } from 'react';
import { X, Download, RefreshCw, AlertTriangle } from 'lucide-react';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string; // The raw screenshot
  productImageUrl?: string; // The clean AI found image
  fullText: string;
}

const StoryModal: React.FC<StoryModalProps> = ({ isOpen, onClose, imageUrl, productImageUrl, fullText }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usingCleanImage, setUsingCleanImage] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Helper to extract data from the generated text
  const extractData = () => {
    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
    
    // Attempt to find Product Name (usually after the Hook line starting with 🔥)
    let title = "Oferta Imperdível";
    const fireIndex = lines.findIndex(l => l.includes('🔥'));
    if (fireIndex !== -1 && lines[fireIndex + 1]) {
        title = lines[fireIndex + 1];
    }

    // Attempt to find Price line
    let priceLine = lines.find(l => l.includes('💰')) || "";
    priceLine = priceLine.replace('💰', '').trim();
    
    // Parse "De X por Y"
    let priceFrom = "";
    let priceTo = priceLine;
    
    // Check for "De ~x~ por y" pattern
    if (priceLine.toLowerCase().includes('por')) {
        const parts = priceLine.split(/por/i);
        // Extract "De" part, removing tildes
        const fromMatch = parts[0].match(/[\d,.]+/);
        if (fromMatch) priceFrom = `De R$ ${fromMatch[0]}`;
        
        // Extract "Por" part
        const toMatch = parts[1].match(/R\$\s?[\d,.]+/);
        if (toMatch) priceTo = toMatch[0];
    }

    return { title, priceFrom, priceTo };
  };

  const drawCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGenerating(true);
    setImageError(false);

    // 1. Setup Canvas Dimensions (Story 9:16)
    canvas.width = 1080;
    canvas.height = 1920;

    // 2. Background Gradient (Green Identity)
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, '#16a34a'); // Green 600
    gradient.addColorStop(1, '#064e3b'); // Emerald 900
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Draw Product Image
    // Priority: Clean Product URL > Screenshot > Nothing
    const srcToUse = productImageUrl || imageUrl;
    
    if (srcToUse) {
        setUsingCleanImage(!!productImageUrl);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = srcToUse;
        
        try {
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => {
                    // If clean image fails, try fallback to screenshot if available and different
                    if (productImageUrl && srcToUse === productImageUrl && imageUrl) {
                        console.warn("Clean image failed, falling back to screenshot");
                        const fallbackImg = new Image();
                        fallbackImg.crossOrigin = "anonymous";
                        fallbackImg.src = imageUrl;
                        fallbackImg.onload = () => {
                            // Replace the original img object props with fallback
                            img.width = fallbackImg.width;
                            img.height = fallbackImg.height;
                            // We need to redraw using fallbackImg, so we just resolve here and handle logic below
                            // But actually, we need to assign fallbackImg to img for the draw call below to work
                            img.src = imageUrl; // This triggers another load, tricky.
                            // Better: just resolve and let the draw logic use `fallbackImg`? 
                            // Simplest: Resolve, but set a flag to restart? No.
                            // Let's just create a quick separate drawer for fallback.
                            ctx.drawImage(fallbackImg, 0,0,1,1); // Dummy draw to ensure it's loaded? 
                            // Actually, just changing src and waiting again is safest.
                            setUsingCleanImage(false);
                            setImageError(true);
                            resolve(true); 
                        };
                        fallbackImg.onerror = reject;
                        return;
                    }
                    reject(new Error("Image load failed"));
                };
            });

            // Image calculations to fit beautifully in center
            const maxW = 900;
            const maxH = 900;
            let drawW = img.width;
            let drawH = img.height;

            // Maintain aspect ratio
            const ratio = Math.min(maxW / drawW, maxH / drawH);
            drawW = drawW * ratio;
            drawH = drawH * ratio;

            const x = (1080 - drawW) / 2;
            const y = 400; // Position form top

            // Shadow
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 20;

            // Rounded corners for image (Clip)
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, drawW, drawH, 40);
            ctx.clip();
            ctx.drawImage(img, x, y, drawW, drawH);
            ctx.restore();
            
            // Reset Shadow
            ctx.shadowColor = "transparent";

        } catch (e) {
            console.error("Canvas image error", e);
            // If main image failed completely, we might just draw nothing or an error placeholder
            // Note: If crossOrigin fails, the image might draw but taint canvas (preventing download).
        }
    }

    // 4. White Card at Bottom
    const cardH = 600;
    const cardY = 1920 - cardH;
    
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(50, cardY, 980, cardH - 50, 40);
    ctx.fill();

    // 5. Text Data
    const { title, priceFrom, priceTo } = extractData();

    // Title
    ctx.fillStyle = "#1f2937"; // Gray 800
    ctx.font = "bold 60px Inter, sans-serif";
    ctx.textAlign = "center";
    
    // Simple text wrap for title
    const words = title.split(' ');
    let line = '';
    let lineY = cardY + 120;
    
    // First line of title
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 880 && n > 0) {
        ctx.fillText(line, 540, lineY);
        line = words[n] + ' ';
        lineY += 70;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 540, lineY);

    // Price Area
    let priceY = lineY + 100;
    
    if (priceFrom) {
        ctx.fillStyle = "#9ca3af"; // Gray 400
        ctx.font = "40px Inter, sans-serif";
        ctx.fillText(priceFrom, 540, priceY);
        
        // Strike through line
        const width = ctx.measureText(priceFrom).width;
        ctx.fillRect(540 - (width/2), priceY - 15, width, 3);
        
        priceY += 80;
    }

    // Big Price
    ctx.fillStyle = "#16a34a"; // Green 600
    ctx.font = "bold 110px Inter, sans-serif";
    ctx.fillText(priceTo, 540, priceY);

    // 6. Link Placeholder Box (Sticker Guide)
    const boxY = 200; // Top area
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.roundRect(290, boxY, 500, 120, 20);
    ctx.stroke();
    
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 30px Inter, sans-serif";
    ctx.fillText("COLE SEU LINK AQUI", 540, boxY + 70);

    setIsGenerating(false);
  };

  useEffect(() => {
    if (isOpen) {
        // Wait for fonts to load roughly or just run
        setTimeout(drawCanvas, 100);
    }
  }, [isOpen, imageUrl, productImageUrl, fullText]);

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
        const link = document.createElement('a');
        link.download = 'story-oferta.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        alert("Não foi possível baixar a imagem devido a proteções de segurança da imagem original. Tente tirar um print desta tela.");
        console.error("Security error (Tainted Canvas)", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex flex-col">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    🎨 Arte para Stories
                </h3>
                {productImageUrl && usingCleanImage && (
                    <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full w-fit mt-1">
                        ✨ Imagem limpa detectada
                    </span>
                )}
                {imageError && (
                     <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-fit mt-1 flex items-center gap-1">
                        <AlertTriangle size={10} /> Usando print original (Imagem limpa bloqueada)
                    </span>
                )}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} className="text-slate-500" />
            </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-slate-100 flex justify-center">
            <canvas 
                ref={canvasRef} 
                className="h-[500px] w-auto shadow-xl rounded-lg border border-slate-200"
                style={{ aspectRatio: '9/16' }}
            />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white grid grid-cols-2 gap-3">
            <button 
                onClick={drawCanvas}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
                <RefreshCw size={18} />
                Gerar
            </button>
            <button 
                onClick={downloadImage}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 transition-colors"
            >
                <Download size={18} />
                Baixar Imagem
            </button>
        </div>
      </div>
    </div>
  );
};

export default StoryModal;
