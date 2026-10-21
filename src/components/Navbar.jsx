import React from 'react';
import { 
  Radar, 
  Users, 
  Settings, 
  Sparkles, 
  Clock, 
  Flame,
  BadgeDollarSign,
  Bot
} from 'lucide-react';

export default function Navbar({ 
  currentTab, 
  setCurrentTab, 
  crmLeads = [], 
  searchMode = 'scraper',
  serverOnline = true,
  onOpenSettings 
}) {
  const totalLeads = crmLeads.length;
  const pendientes = crmLeads.filter(l => l.status === 'Pendiente' || !l.status).length;
  const enCharla = crmLeads.filter(l => l.status === 'En charla' || l.status === 'Propuesta enviada').length;
  const cerrados = crmLeads.filter(l => l.status === 'Cliente cerrado 💸').length;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md transition-colors shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-4">
          
          {/* Brand Logo & Title */}
          <div 
            onClick={() => setCurrentTab('explorer')}
            className="flex items-center gap-3.5 cursor-pointer group shrink-0"
          >
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white shadow-md shadow-[#1E3A8A]/25 group-hover:scale-105 transition-transform duration-200">
              <svg 
                className="w-5 h-5 sm:w-6 sm:h-6" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="getwebGradNavbar" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38BDF8" />
                    <stop offset="1" stopColor="#10B981" />
                  </linearGradient>
                </defs>
                {/* Globe Wireframe */}
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeOpacity="0.35" />
                <ellipse cx="12" cy="12" rx="4" ry="9" stroke="white" strokeWidth="1.5" strokeOpacity="0.35" />
                <path d="M3.5 9h17M3.5 15h17" stroke="white" strokeWidth="1.5" strokeOpacity="0.25" strokeLinecap="round" />
                {/* Dynamic GET Arrow */}
                <path 
                  d="M10 14l8-8m0 0h-5.5m5.5 0v5.5" 
                  stroke="url(#getwebGradNavbar)" 
                  strokeWidth="2.4" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <circle cx="10" cy="14" r="2" fill="#10B981" />
              </svg>

              {/* Status beacon pulse */}
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#059669] border border-white"></span>
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#0F172A] font-sans">
                  GET<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#0284C7] font-extrabold">web</span>
                </h1>
                <span className="hidden sm:inline-block font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]">
                  PROSPECCIÓN B2B // V2.5
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] hidden md:block font-mono tracking-tight">
                CAPTACIÓN DE CLIENTES SIN WEB // WHATSAPP & CRM
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
            <button
              onClick={() => setCurrentTab('explorer')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                currentTab === 'explorer'
                  ? 'bg-[#1E3A8A] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
              }`}
            >
              <Radar className="w-3.5 h-3.5" />
              <span>01 / EXPLORADOR</span>
            </button>

            <button
              onClick={() => setCurrentTab('crm')}
              className={`relative flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                currentTab === 'crm'
                  ? 'bg-[#1E3A8A] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>02 / PIPELINE CRM</span>
              {totalLeads > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                  currentTab === 'crm' 
                    ? 'bg-white/25 text-white' 
                    : 'bg-[#1E3A8A]/10 text-[#1E3A8A] border border-[#1E3A8A]/20'
                }`}>
                  {totalLeads}
                </span>
              )}
            </button>
          </nav>

          {/* Right: Engine Status Pill & Settings Modal Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Status Pill */}
            <button 
              type="button"
              onClick={onOpenSettings}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#1E3A8A] transition shadow-xs cursor-pointer text-left"
              title="Clic para configurar el motor de búsqueda o plantillas WhatsApp"
            >
              {searchMode === 'scraper' ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-[#059669] animate-pulse' : 'bg-[#E11D48]'}`}></span>
                  <span className={`text-[11px] font-mono font-bold flex items-center gap-1.5 ${serverOnline ? 'text-[#059669]' : 'text-[#E11D48]'}`}>
                    <Bot className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{serverOnline ? 'SCRAPER LOCAL // GRATIS' : 'SCRAPER OFFLINE'}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#1E3A8A]"></span>
                  <span className="text-[11px] font-mono font-bold text-[#1E3A8A] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">GOOGLE API CLOUD</span>
                  </span>
                </>
              )}
            </button>

            {/* Settings Trigger */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 text-[#64748B] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-xl transition shadow-xs cursor-pointer"
              aria-label="Abrir Configuración"
              title="Configuración de Motor & Plantillas WhatsApp"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Quick Metrics Bar Sub-header */}
        <div className="py-2 border-t border-[#F1F5F9] flex items-center justify-between text-xs overflow-x-auto gap-4 scrollbar-none font-mono">
          <div className="flex items-center gap-5 text-[#64748B] text-[11px] whitespace-nowrap">
            <button 
              type="button"
              onClick={() => setCurrentTab('crm')} 
              className="flex items-center gap-1.5 hover:text-[#1E3A8A] transition cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]"></span>
              <span>TOTAL CRM: <strong className="text-[#0F172A] font-bold">[{totalLeads}]</strong></span>
            </button>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#D97706]" />
              <span>POR CONTACTAR: <strong className="text-[#D97706] font-bold">[{pendientes}]</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-[#1E3A8A]" />
              <span>EN NEGOCIACIÓN: <strong className="text-[#1E3A8A] font-bold">[{enCharla}]</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeDollarSign className="w-3.5 h-3.5 text-[#059669]" />
              <span>CERRADOS: <strong className="text-[#059669] font-bold">[{cerrados}]</strong></span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-[#94A3B8] font-mono shrink-0">
            <span>DISPARO DIRECTO A WHATSAPP WEB</span>
            <span>•</span>
            <span>SIN DEPENDENCIAS EXTERNAS</span>
          </div>
        </div>

      </div>
    </header>
  );
}
