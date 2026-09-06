import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, PenTool, CheckCircle2, UserCheck } from 'lucide-react';

interface DigitalSignaturePadProps {
  initialSignerName?: string;
  onSignatureChange: (dataUrl: string | null, signerName: string) => void;
  disabled?: boolean;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  initialSignerName = '',
  onSignatureChange,
  disabled = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState(initialSignerName);

  // Initialize canvas with high DPR and baseline guide
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set internal dimensions
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Use layout width or default
    const width = rect.width || 450;
    const height = 140;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 2.5;

    // Draw light baseline
    drawBaseline(ctx, width, height);
  }, []);

  const drawBaseline = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = '#cbd5e1'; // slate-300
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, height - 32);
    ctx.lineTo(width - 30, height - 32);
    ctx.stroke();
    
    // Draw signature indicator text
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.textAlign = 'center';
    ctx.fillText('✕ Assine sobre a linha pontilhada', width / 2, height - 16);
    ctx.restore();
  };

  useEffect(() => {
    initCanvas();
    const handleResize = () => {
      // Re-init if canvas empty
      if (!hasDrawn) {
        initCanvas();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas, hasDrawn]);

  // Coordinate normalizer
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent scrolling when drawing on touch screens
    if ('touches' in e) {
      e.preventDefault();
    }

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl, signerName);
    }
  };

  // Clear signature canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 450;
    const height = 140;
    drawBaseline(ctx, width, height);

    setHasDrawn(false);
    onSignatureChange(null, signerName);
  };

  // Update signer name
  const handleNameChange = (newName: string) => {
    setSignerName(newName);
    if (hasDrawn && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL('image/png'), newName);
    }
  };

  return (
    <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <PenTool className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">Assinatura Digital (Opcional)</span>
            <p className="text-[10px] text-slate-500">Escreva com o dedo na tela ou com o mouse</p>
          </div>
        </div>

        {hasDrawn && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Assinado
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100/60 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Limpar e assinar novamente"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          </div>
        )}
      </div>

      {/* Canvas Area with touch-action none to ensure drawing precision */}
      <div className="relative rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ touchAction: 'none', height: '140px' }}
          className="w-full cursor-crosshair block"
        />

        {!hasDrawn && (
          <div className="absolute top-2 right-2 pointer-events-none text-[10px] text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded">
            Toque/arraste para assinar
          </div>
        )}
      </div>

      {/* Signer Name Input */}
      <div className="flex items-center gap-2 pt-1">
        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Nome completo do responsável pela assinatura"
          value={signerName}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={disabled}
          className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
        />
      </div>
    </div>
  );
};
