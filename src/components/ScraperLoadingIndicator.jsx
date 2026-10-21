import React, { useState, useEffect } from 'react';
import { Loader2, Cpu, Radar, CheckCircle2 } from 'lucide-react';

const SCRAPER_STEPS = [
  { text: "Iniciando Chromium Puppeteer en segundo plano...", progress: 20 },
  { text: "Navegando a Google Maps y cargando feed de comercios...", progress: 45 },
  { text: "Haciendo scroll automático e inspeccionando fichas de negocios...", progress: 70 },
  { text: "Extrayendo números de teléfono, direcciones y enlaces web...", progress: 85 },
  { text: "Clasificando oportunidades comerciales (Sin Web vs Con Web)...", progress: 95 }
];

export default function ScraperLoadingIndicator({ 
  isSearching = false,
  searchMode = 'scraper',
  targetQuery = '',
  query = ''
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const displayQuery = targetQuery || query || 'Comercios de la zona';

  useEffect(() => {
    if (!isSearching) {
      setCurrentStepIndex(0);
      setSecondsElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setSecondsElapsed(s => s + 1);
    }, 1000);

    const stepInterval = setInterval(() => {
      setCurrentStepIndex(prev => (prev < SCRAPER_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    return () => {
      clearInterval(timer);
      clearInterval(stepInterval);
    };
  }, [isSearching]);

  if (!isSearching) return null;

  const currentStep = SCRAPER_STEPS[currentStepIndex];

  return (
    <div className="mb-8 p-6 sm:p-7 rounded-2xl bg-white border border-[#BFDBFE] shadow-[0_8px_30px_rgba(30,58,138,0.08)] relative overflow-hidden animate-fade-in">
      {/* Top Hairline Sapphire Accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#059669] animate-pulse" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Left: Animated Icon & Main Status */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] shadow-sm shrink-0">
            <Radar className="w-7 h-7 text-[#1E3A8A] animate-radar-spin" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#059669]"></span>
            </span>
          </div>

          <div className="space-y-1.5 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-[#059669]" />
                <span>{searchMode === 'scraper' ? 'PUPPETEER CHROMIUM // EN VIVO' : 'PLACES RADAR // CLOUD'}</span>
              </span>
              <span className="text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0] font-semibold">
                ⏱️ {secondsElapsed}s transcurridos
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#0F172A] flex items-center justify-center sm:justify-start gap-2 font-sans">
              <span>Escaneando comercios en Google Maps</span>
              <Loader2 className="w-4 h-4 animate-spin text-[#1E3A8A]" />
            </h3>

            <p className="text-xs text-[#475569] max-w-lg">
              Objetivo: <strong className="text-[#0F172A] font-semibold font-mono">"{displayQuery}"</strong>
            </p>
          </div>
        </div>

        {/* Right: Live Extractor Status */}
        <div className="shrink-0 animate-fade-in hidden sm:block">
          <div className="px-3.5 py-2 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
            <span className="font-mono text-[11px]">Extracción en tiempo real</span>
          </div>
        </div>

      </div>

      {/* Dynamic Progress Bar & Steps Tracker */}
      <div className="mt-6 pt-5 border-t border-[#F1F5F9] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#0F172A] font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1E3A8A] animate-pulse" />
            <span>{currentStep.text}</span>
          </span>
          <span className="text-[#1E3A8A] font-mono font-bold text-xs">{currentStep.progress}%</span>
        </div>

        <div className="w-full bg-[#F1F5F9] h-2.5 rounded-full overflow-hidden border border-[#E2E8F0]">
          <div 
            className="bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#059669] h-full transition-all duration-700 ease-out rounded-full shadow-sm"
            style={{ width: `${currentStep.progress}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[10px] font-mono text-[#64748B]">
          {SCRAPER_STEPS.map((step, idx) => (
            <div 
              key={idx} 
              className={`flex items-center gap-1 truncate ${idx <= currentStepIndex ? 'text-[#1E3A8A] font-bold' : 'opacity-40'}`}
            >
              {idx < currentStepIndex ? (
                <CheckCircle2 className="w-3 h-3 text-[#059669] shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full border border-current text-[8px] flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
              )}
              <span className="truncate">Paso 0{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
