import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  MessageSquare, 
  Check, 
  Eye, 
  EyeOff, 
  Sparkles, 
  RotateCcw,
  ExternalLink,
  Bot,
  Cpu,
  RefreshCw,
  Trash2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  WHATSAPP_TEMPLATES, 
  personalizeMessage 
} from '../utils/whatsappHelper';
import { checkScraperServerStatus, clearScraperCache } from '../services/placesApi';
import { testLLMConnection, fetchGroqModels } from '../services/aiPitchService';

const DEFAULT_AI = {
  provider: 'builtin',
  groqApiKey: '',
  groqModel: 'llama-3.1-8b-instant',
  deepseekApiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  senderName: '',
  agencyName: '',
  customOffer: 'diseñamos sitios web y landings orientadas a convertir visitas en consultas por WhatsApp'
};

export default function SettingsModal({
  isOpen,
  onClose,
  searchMode = 'scraper',
  setSearchMode,
  apiKey,
  setApiKey,
  waTemplates = WHATSAPP_TEMPLATES,
  setWaTemplates,
  aiSettings,
  setAiSettings
}) {
  const [tempMode, setTempMode] = useState(searchMode === 'api' ? 'api' : 'scraper');
  const [tempKey, setTempKey] = useState(apiKey || '');
  const [tempTemplates, setTempTemplates] = useState(waTemplates || WHATSAPP_TEMPLATES);
  const [tempAi, setTempAi] = useState(() => {
    const base = aiSettings || DEFAULT_AI;
    return {
      ...base,
      groqModel: (!base.groqModel || base.groqModel.includes('deepseek-r1-distill') || base.groqModel === 'llama-3.3-70b-versatile') 
        ? 'llama-3.1-8b-instant' 
        : base.groqModel
    };
  });
  const [groqDetectedModels, setGroqDetectedModels] = useState([]);
  const [isFetchingGroqModels, setIsFetchingGroqModels] = useState(false);
  const [activeTemplateTab, setActiveTemplateTab] = useState('no_web'); // 'no_web' | 'social_only' | 'redesign' | 'follow_up'
  const [showKey, setShowKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [cacheCleared, setCacheCleared] = useState(false);

  // Test LLM Connection state
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmTestStatus, setLlmTestStatus] = useState(null);

  const handleTestLLM = async (providerOverride) => {
    const prov = providerOverride || tempAi.provider;
    setTestingLlm(true);
    setLlmTestStatus(null);
    const key = prov === 'groq' ? tempAi.groqApiKey
      : prov === 'deepseek' ? tempAi.deepseekApiKey
      : prov === 'gemini' ? tempAi.geminiApiKey
      : prov === 'openai' ? tempAi.openaiApiKey
      : '';
    const model = prov === 'groq' ? tempAi.groqModel : '';
    const res = await testLLMConnection(prov, key, model);
    setLlmTestStatus(res);
    if (res.detectedModel && prov === 'groq') {
      setTempAi(prev => ({ ...prev, groqModel: res.detectedModel }));
    }
    setTestingLlm(false);
  };

  const handleFetchGroqModels = async () => {
    if (!tempAi.groqApiKey?.trim()) return;
    setIsFetchingGroqModels(true);
    try {
      const models = await fetchGroqModels(tempAi.groqApiKey.trim());
      if (models.length > 0) {
        setGroqDetectedModels(models);
        // If current model is not in list, pick the first one or llama-3.1-8b-instant
        const hasCurrent = models.some(m => m.id === tempAi.groqModel);
        if (!hasCurrent) {
          const preferred = models.find(m => m.id === 'llama-3.1-8b-instant') || models[0];
          setTempAi(prev => ({ ...prev, groqModel: preferred.id }));
        }
      }
    } finally {
      setIsFetchingGroqModels(false);
    }
  };

  // Sync state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    checkScraperServerStatus().then(online => {
      if (isMounted) {
        setServerStatus(online ? 'online' : 'offline');
      }
    });

    setTempTemplates(waTemplates || WHATSAPP_TEMPLATES);
    setTempMode(searchMode === 'api' ? 'api' : 'scraper');
    setTempKey(apiKey || '');
    const baseAi = aiSettings || DEFAULT_AI;
    setTempAi({
      ...baseAi,
      groqModel: (!baseAi.groqModel || baseAi.groqModel.includes('deepseek-r1-distill') || baseAi.groqModel === 'llama-3.3-70b-versatile')
        ? 'llama-3.1-8b-instant'
        : baseAi.groqModel
    });
    setLlmTestStatus(null);

    return () => {
      isMounted = false;
    };
  }, [isOpen, waTemplates, searchMode, apiKey, aiSettings]);

  if (!isOpen) return null;

  const sampleLead = {
    displayName: "Ferretería & Corralón La Tuerca",
    rubro: "Ferreterías y Corralones",
    city: "La Plata"
  };

  const currentTemplateObj = tempTemplates[activeTemplateTab] || WHATSAPP_TEMPLATES[activeTemplateTab];
  const previewMessage = personalizeMessage(currentTemplateObj?.text || '', sampleLead);

  const handleTemplateTextChange = (text) => {
    setTempTemplates(prev => ({
      ...prev,
      [activeTemplateTab]: {
        ...(prev[activeTemplateTab] || WHATSAPP_TEMPLATES[activeTemplateTab]),
        text
      }
    }));
  };

  const handleResetCurrentTemplate = () => {
    setTempTemplates(prev => ({
      ...prev,
      [activeTemplateTab]: {
        ...(prev[activeTemplateTab] || WHATSAPP_TEMPLATES[activeTemplateTab]),
        text: WHATSAPP_TEMPLATES[activeTemplateTab].text
      }
    }));
  };

  const handleResetAllTemplates = () => {
    setTempTemplates(WHATSAPP_TEMPLATES);
  };

  const handleSave = () => {
    if (setSearchMode) setSearchMode(tempMode);
    setApiKey(tempKey.trim());
    if (setWaTemplates) setWaTemplates(tempTemplates);
    if (setAiSettings) setAiSettings(tempAi);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  const handleTestServer = async () => {
    setServerStatus('checking');
    const online = await checkScraperServerStatus();
    setServerStatus(online ? 'online' : 'offline');
  };

  const handleClearCache = async () => {
    const success = await clearScraperCache();
    if (success) {
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white border border-[#E2E8F0] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] font-sans">Ajustes & Configuración</h3>
              <p className="text-xs text-[#64748B]">GETweb Engine // Motores de Scraping, Google Places & Plantillas</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Section 1: Search Engine Provider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 font-mono uppercase">
                <Cpu className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>01. MOTOR DE PROSPECCIÓN ACTIVO</span>
              </label>

              {/* Server Status Badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-[#64748B]">Backend:</span>
                <button
                  type="button"
                  onClick={handleTestServer}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition hover:opacity-80 cursor-pointer"
                  style={{
                    backgroundColor: serverStatus === 'online' ? '#EFF6FF' : serverStatus === 'offline' ? '#FFF1F2' : '#F1F5F9',
                    color: serverStatus === 'online' ? '#1E3A8A' : serverStatus === 'offline' ? '#E11D48' : '#64748B',
                    border: `1px solid ${serverStatus === 'online' ? '#BFDBFE' : serverStatus === 'offline' ? '#FECDD3' : '#E2E8F0'}`
                  }}
                  title="Clic para re-comprobar conectividad con el servidor local"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    serverStatus === 'online' ? 'bg-[#059669] animate-pulse' : serverStatus === 'offline' ? 'bg-[#E11D48]' : 'bg-[#94A3B8]'
                  }`} />
                  <span>{serverStatus === 'online' ? 'ONLINE (PUPPETEER PUERTO 3001)' : serverStatus === 'offline' ? 'DESCONECTADO (PORT 3001)' : 'VERIFICANDO...'}</span>
                  <RefreshCw className="w-2.5 h-2.5 ml-0.5" />
                </button>
              </div>
            </div>

            {/* Choice 1: Local Puppeteer Scraper */}
            <div 
              onClick={() => setTempMode('scraper')}
              className={`p-4 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                tempMode === 'scraper'
                  ? 'bg-[#F8FAFC] border-[#1E3A8A] shadow-sm ring-1 ring-[#1E3A8A]/20'
                  : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    tempMode === 'scraper' ? 'border-[#1E3A8A] bg-[#1E3A8A]' : 'border-[#CBD5E1]'
                  }`}>
                    {tempMode === 'scraper' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-[#1E3A8A]" />
                    <span>Scraper Local Chromium (Gratis & Sin Límites de Cuota)</span>
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                  RECOMENDADO
                </span>
              </div>
              <p className="text-xs text-[#64748B] pl-6 leading-relaxed">
                Utiliza el navegador headless Chromium en Node.js (puerto 3001) para navegar Google Maps en tiempo real, enriqueciendo datos de teléfono y extrayendo enlaces web con caché inteligente.
              </p>

              {tempMode === 'scraper' && (
                <div className="pl-6 pt-2 flex items-center justify-between border-t border-[#F1F5F9] mt-1" onClick={e => e.stopPropagation()}>
                  <span className="text-[11px] text-[#64748B]">
                    Caché de consultas en memoria activo (TTL: 90 min).
                  </span>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="font-mono text-[10px] text-[#E11D48] hover:text-[#9F1239] bg-[#FFF1F2] border border-[#FECDD3] px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{cacheCleared ? '¡CACHÉ VACIADO!' : 'LIMPIAR CACHÉ'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Choice 2: Official Google Cloud API */}
            <div 
              onClick={() => setTempMode('api')}
              className={`p-4 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                tempMode === 'api'
                  ? 'bg-[#F8FAFC] border-[#1E3A8A] shadow-sm ring-1 ring-[#1E3A8A]/20'
                  : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    tempMode === 'api' ? 'border-[#1E3A8A] bg-[#1E3A8A]' : 'border-[#CBD5E1]'
                  }`}>
                    {tempMode === 'api' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#1E3A8A]" />
                    <span>Google Places API Oficial (Cloud)</span>
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]">
                  API KEY REQUERIDA
                </span>
              </div>

              {tempMode === 'api' && (
                <div className="ml-6 space-y-2 pt-2 border-t border-[#F1F5F9]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#0F172A]">
                      API Key de Google Cloud
                    </label>
                    <a
                      href="https://developers.google.com/maps/documentation/places/web-service/get-api-key"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#1E3A8A] hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>Obtener Clave</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full pl-3.5 pr-10 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Section 2: WhatsApp Multi-Template Editor */}
          <div className="space-y-3 pt-4 border-t border-[#F1F5F9]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 font-mono uppercase">
                  <MessageSquare className="w-3.5 h-3.5 text-[#059669]" />
                  <span>02. PLANTILLAS DE PROSPECCIÓN WHATSAPP (B2B)</span>
                </label>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Personalizá los 4 ángulos de contacto comercial según el estado del prospecto.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetCurrentTemplate}
                  className="font-mono text-[10px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 py-1 px-2 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] transition cursor-pointer"
                  title="Restablecer plantilla activa a la versión original"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer Activa</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetAllTemplates}
                  className="font-mono text-[10px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 py-1 px-2 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] transition cursor-pointer"
                  title="Restablecer todas las plantillas"
                >
                  <span>Todas</span>
                </button>
              </div>
            </div>

            {/* Template Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#F1F5F9] p-1.5 rounded-xl border border-[#E2E8F0]">
              {Object.keys(WHATSAPP_TEMPLATES).map(key => {
                const t = WHATSAPP_TEMPLATES[key];
                const isActive = activeTemplateTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTemplateTab(key)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#1E3A8A] shadow-xs border border-[#CBD5E1]'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <span>{t.badge}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Template Details & Textarea */}
            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#0F172A]">
                    {currentTemplateObj?.title}
                  </span>
                  <p className="text-[11px] text-[#64748B]">
                    {currentTemplateObj?.subtitle}
                  </p>
                </div>
                <div className="text-[10px] text-[#64748B] font-mono">
                  Vars: <code className="text-[#1E3A8A]">{"{nombre}"}</code>, <code className="text-[#059669]">{"{rubro}"}</code>, <code className="text-[#D97706]">{"{ciudad}"}</code>
                </div>
              </div>

              <textarea
                rows={5}
                value={currentTemplateObj?.text || ''}
                onChange={(e) => handleTemplateTextChange(e.target.value)}
                className="w-full text-xs p-3 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]/20 font-sans leading-relaxed transition"
              />
            </div>

            {/* Live Message Preview */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-mono text-[10px] uppercase font-bold text-[#94A3B8] block mb-1.5 tracking-wider">
                VISTA PREVIA DE CONTACTO ({sampleLead.displayName}):
              </span>
              <div className="text-xs text-[#059669] whitespace-pre-wrap bg-[#ECFDF5] p-3 rounded-lg border border-[#A7F3D0] font-sans leading-relaxed">
                {previewMessage}
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* SECCIÓN 03: CONFIGURACIÓN DE IA PARA MENSAJES       */}
            {/* ---------------------------------------------------- */}
            <div className="space-y-4 pt-6 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-xs uppercase font-bold text-[#1E3A8A] flex items-center gap-1.5 tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>03. Inteligencia Artificial para Mensajes Personalizados</span>
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Generá pitches únicos para cada comercio según sus reseñas, estrellas y presencia web
                  </p>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] font-bold">
                  Motor Activo
                </span>
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                <span className="font-mono text-[10px] uppercase font-bold text-[#64748B] block">
                  PROVEEDOR DE IA:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* Built-in Smart AI */}
                  <label 
                    className={`flex flex-col p-3 rounded-xl border transition cursor-pointer ${
                      tempAi.provider === 'builtin'
                        ? 'border-[#1E3A8A] bg-[#EFF6FF] shadow-xs'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="builtin"
                        checked={tempAi.provider === 'builtin'}
                        onChange={() => setTempAi(prev => ({ ...prev, provider: 'builtin' }))}
                        className="text-[#1E3A8A]"
                      />
                      <span className="text-xs font-bold text-[#0F172A]">Smart AI B2B</span>
                    </div>
                    <span className="text-[11px] text-[#059669] font-medium font-mono">100% Gratis / Sin API</span>
                    <span className="text-[10px] text-[#64748B] mt-1 leading-tight">
                      Algoritmo copywriting B2B nativo hiperpersonalizado.
                    </span>
                  </label>

                  {/* Groq Cloud (DeepSeek R1) */}
                  <label 
                    className={`flex flex-col p-3 rounded-xl border transition cursor-pointer ${
                      tempAi.provider === 'groq'
                        ? 'border-[#1E3A8A] bg-[#EFF6FF] shadow-xs'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="groq"
                        checked={tempAi.provider === 'groq'}
                        onChange={() => setTempAi(prev => ({ ...prev, provider: 'groq' }))}
                        className="text-[#1E3A8A]"
                      />
                      <span className="text-xs font-bold text-[#0F172A]">Groq Cloud</span>
                    </div>
                    <span className="text-[11px] text-[#EA580C] font-medium font-mono">DeepSeek R1 Gratis</span>
                    <span className="text-[10px] text-[#64748B] mt-1 leading-tight">
                      Ultra rápido, 100% gratis y sin tarjeta de crédito.
                    </span>
                  </label>

                  {/* DeepSeek Oficial */}
                  <label 
                    className={`flex flex-col p-3 rounded-xl border transition cursor-pointer ${
                      tempAi.provider === 'deepseek'
                        ? 'border-[#1E3A8A] bg-[#EFF6FF] shadow-xs'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="deepseek"
                        checked={tempAi.provider === 'deepseek'}
                        onChange={() => setTempAi(prev => ({ ...prev, provider: 'deepseek' }))}
                        className="text-[#1E3A8A]"
                      />
                      <span className="text-xs font-bold text-[#0F172A]">DeepSeek Oficial</span>
                    </div>
                    <span className="text-[11px] text-[#0284C7] font-medium font-mono">deepseek-chat V3</span>
                    <span className="text-[10px] text-[#64748B] mt-1 leading-tight">
                      Conexión directa con la API oficial de DeepSeek.
                    </span>
                  </label>

                  {/* Google Gemini */}
                  <label 
                    className={`flex flex-col p-3 rounded-xl border transition cursor-pointer ${
                      tempAi.provider === 'gemini'
                        ? 'border-[#1E3A8A] bg-[#EFF6FF] shadow-xs'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="gemini"
                        checked={tempAi.provider === 'gemini'}
                        onChange={() => setTempAi(prev => ({ ...prev, provider: 'gemini' }))}
                        className="text-[#1E3A8A]"
                      />
                      <span className="text-xs font-bold text-[#0F172A]">Google Gemini</span>
                    </div>
                    <span className="text-[11px] text-[#2563EB] font-medium font-mono">1500 req/día Gratis</span>
                    <span className="text-[10px] text-[#64748B] mt-1 leading-tight">
                      Conexión directa con Google AI Studio.
                    </span>
                  </label>

                  {/* OpenAI */}
                  <label 
                    className={`flex flex-col p-3 rounded-xl border transition cursor-pointer ${
                      tempAi.provider === 'openai'
                        ? 'border-[#1E3A8A] bg-[#EFF6FF] shadow-xs'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="openai"
                        checked={tempAi.provider === 'openai'}
                        onChange={() => setTempAi(prev => ({ ...prev, provider: 'openai' }))}
                        className="text-[#1E3A8A]"
                      />
                      <span className="text-xs font-bold text-[#0F172A]">OpenAI GPT</span>
                    </div>
                    <span className="text-[11px] text-[#7C3AED] font-medium font-mono">GPT-4o-mini</span>
                    <span className="text-[10px] text-[#64748B] mt-1 leading-tight">
                      Generación con los modelos de OpenAI via API Key.
                    </span>
                  </label>
                </div>
              </div>

              {/* LLM Connection Test Result Banner */}
              {llmTestStatus && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-fade-in ${
                  llmTestStatus.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {llmTestStatus.success ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <p className="font-semibold">{llmTestStatus.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLlmTestStatus(null)}
                    className="text-xs font-bold opacity-60 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Groq API Key and Model input */}
              {tempAi.provider === 'groq' && (
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#0F172A] block">
                        Groq API Key (100% Gratis)
                      </label>
                      <span className="text-[10px] text-[#64748B]">
                        Ejecuta DeepSeek R1 a más de 300 tokens/segundo sin costo ni tarjeta de crédito.
                      </span>
                    </div>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#EA580C] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Obtener Key gratis</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showGroqKey ? 'text' : 'password'}
                      value={tempAi.groqApiKey || ''}
                      onChange={(e) => {
                        setTempAi(prev => ({ ...prev, groqApiKey: e.target.value }));
                        setLlmTestStatus(null);
                      }}
                      placeholder="gsk_..."
                      className="w-full text-xs font-mono pr-9 pl-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGroqKey(!showGroqKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                    >
                      {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-[#0F172A]">
                        Modelo Groq:
                      </label>
                      <button
                        type="button"
                        disabled={isFetchingGroqModels || !tempAi.groqApiKey?.trim()}
                        onClick={handleFetchGroqModels}
                        className="text-[10px] text-[#1E3A8A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        title="Consultar en vivo los modelos que tiene habilitada tu API key"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isFetchingGroqModels ? 'animate-spin' : ''}`} />
                        <span>{isFetchingGroqModels ? 'Detectando...' : '🔍 Detectar modelos de mi cuenta'}</span>
                      </button>
                    </div>

                    <select
                      value={tempAi.groqModel || 'llama-3.1-8b-instant'}
                      onChange={(e) => {
                        setTempAi(prev => ({ ...prev, groqModel: e.target.value }));
                        setLlmTestStatus(null);
                      }}
                      className="text-xs bg-white border border-[#CBD5E1] rounded-lg py-1.5 px-2.5 text-[#0F172A] focus:outline-none focus:border-[#1E3A8A] font-mono w-full"
                    >
                      {groqDetectedModels.length > 0 ? (
                        groqDetectedModels.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.id} {m.id.includes('8b') ? '— ⚡ Rápido' : m.id.includes('70b') ? '— 🧠 70B' : ''}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="llama-3.1-8b-instant">Meta Llama 3.1 8B (llama-3.1-8b-instant) — ⭐ Universal (100% disponible y rápido)</option>
                          <option value="llama-3.3-70b-versatile">Meta Llama 3.3 70B (llama-3.3-70b-versatile) — 🧠 Alta persuasión (si tu cuenta tiene acceso)</option>
                          <option value="mixtral-8x7b-32768">Mixtral 8x7B (mixtral-8x7b-32768) — ⚡ MoE</option>
                          <option value="gemma2-9b-it">Google Gemma 2 9B (gemma2-9b-it)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      disabled={testingLlm || !tempAi.groqApiKey?.trim()}
                      onClick={() => handleTestLLM('groq')}
                      className="text-[11px] font-bold text-[#1E3A8A] bg-[#EFF6FF] hover:bg-[#DBEAFE] disabled:opacity-40 px-3 py-1.5 rounded-lg border border-[#BFDBFE] flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingLlm ? 'animate-spin' : ''}`} />
                      <span>{testingLlm ? 'Probando clave con Groq...' : '⚡ Probar Conexión Groq'}</span>
                    </button>
                    {!tempAi.groqApiKey?.trim() && (
                      <span className="text-[10px] text-amber-700 font-medium">⚠️ Pegá tu API Key para habilitar</span>
                    )}
                  </div>
                </div>
              )}

              {/* DeepSeek Official API Key input */}
              {tempAi.provider === 'deepseek' && (
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#0F172A] block">
                        DeepSeek API Key
                      </label>
                      <span className="text-[10px] text-[#64748B]">
                        Utiliza el modelo oficial deepseek-chat (DeepSeek V3).
                      </span>
                    </div>
                    <a
                      href="https://platform.deepseek.com/api_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#0284C7] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Obtener Key en DeepSeek</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showDeepseekKey ? 'text' : 'password'}
                      value={tempAi.deepseekApiKey || ''}
                      onChange={(e) => {
                        setTempAi(prev => ({ ...prev, deepseekApiKey: e.target.value }));
                        setLlmTestStatus(null);
                      }}
                      placeholder="sk-..."
                      className="w-full text-xs font-mono pr-9 pl-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeepseekKey(!showDeepseekKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                    >
                      {showDeepseekKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      disabled={testingLlm || !tempAi.deepseekApiKey?.trim()}
                      onClick={() => handleTestLLM('deepseek')}
                      className="text-[11px] font-bold text-[#0284C7] bg-[#F0F9FF] hover:bg-[#E0F2FE] disabled:opacity-40 px-3 py-1.5 rounded-lg border border-[#BAE6FD] flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingLlm ? 'animate-spin' : ''}`} />
                      <span>{testingLlm ? 'Probando clave con DeepSeek...' : '⚡ Probar Conexión DeepSeek'}</span>
                    </button>
                    {!tempAi.deepseekApiKey?.trim() && (
                      <span className="text-[10px] text-amber-700 font-medium">⚠️ Pegá tu API Key para habilitar</span>
                    )}
                  </div>
                </div>
              )}

              {/* Gemini API Key input */}
              {tempAi.provider === 'gemini' && (
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#0F172A] block">
                        Google Gemini API Key
                      </label>
                      <span className="text-[10px] text-[#64748B]">
                        Utiliza gemini-1.5-flash (1.500 solicitudes por día gratis).
                      </span>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#1E3A8A] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Obtener Key gratis</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={tempAi.geminiApiKey || ''}
                      onChange={(e) => {
                        setTempAi(prev => ({ ...prev, geminiApiKey: e.target.value }));
                        setLlmTestStatus(null);
                      }}
                      placeholder="AIzaSy..."
                      className="w-full text-xs font-mono pr-9 pl-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                    >
                      {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      disabled={testingLlm || !tempAi.geminiApiKey?.trim()}
                      onClick={() => handleTestLLM('gemini')}
                      className="text-[11px] font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] disabled:opacity-40 px-3 py-1.5 rounded-lg border border-[#BFDBFE] flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingLlm ? 'animate-spin' : ''}`} />
                      <span>{testingLlm ? 'Probando clave con Google...' : '⚡ Probar Conexión Gemini'}</span>
                    </button>
                    {!tempAi.geminiApiKey?.trim() && (
                      <span className="text-[10px] text-amber-700 font-medium">⚠️ Pegá tu API Key para habilitar</span>
                    )}
                  </div>
                </div>
              )}

              {/* OpenAI API Key input */}
              {tempAi.provider === 'openai' && (
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#0F172A] block">
                        OpenAI API Key
                      </label>
                      <span className="text-[10px] text-[#64748B]">
                        Utiliza gpt-4o-mini mediante tu cuenta de OpenAI.
                      </span>
                    </div>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#1E3A8A] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Obtener Key en OpenAI</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? 'text' : 'password'}
                      value={tempAi.openaiApiKey || ''}
                      onChange={(e) => {
                        setTempAi(prev => ({ ...prev, openaiApiKey: e.target.value }));
                        setLlmTestStatus(null);
                      }}
                      placeholder="sk-proj-..."
                      className="w-full text-xs font-mono pr-9 pl-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                    >
                      {showOpenaiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      disabled={testingLlm || !tempAi.openaiApiKey?.trim()}
                      onClick={() => handleTestLLM('openai')}
                      className="text-[11px] font-bold text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#EDE9FE] disabled:opacity-40 px-3 py-1.5 rounded-lg border border-[#DDD6FE] flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingLlm ? 'animate-spin' : ''}`} />
                      <span>{testingLlm ? 'Probando clave con OpenAI...' : '⚡ Probar Conexión OpenAI'}</span>
                    </button>
                    {!tempAi.openaiApiKey?.trim() && (
                      <span className="text-[10px] text-amber-700 font-medium">⚠️ Pegá tu API Key para habilitar</span>
                    )}
                  </div>
                </div>
              )}

              {/* Personalization Inputs */}
              <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
                <span className="font-mono text-[10px] uppercase font-bold text-[#64748B] block">
                  PERSONALIZACIÓN DE TU PERFIL DE VENTA:
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#0F172A] block mb-1">
                      Tu Nombre o Firma
                    </label>
                    <input
                      type="text"
                      value={tempAi.senderName || ''}
                      onChange={(e) => setTempAi(prev => ({ ...prev, senderName: e.target.value }))}
                      placeholder="Ej: Lucas"
                      className="w-full text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#0F172A] block mb-1">
                      Tu Agencia o Marca
                    </label>
                    <input
                      type="text"
                      value={tempAi.agencyName || ''}
                      onChange={(e) => setTempAi(prev => ({ ...prev, agencyName: e.target.value }))}
                      placeholder="Ej: Nexo Digital"
                      className="w-full text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#0F172A] block mb-1">
                    Tu Oferta o Especialidad
                  </label>
                  <textarea
                    rows={2}
                    value={tempAi.customOffer || ''}
                    onChange={(e) => setTempAi(prev => ({ ...prev, customOffer: e.target.value }))}
                    placeholder="Ej: diseñamos sitios web rápidos optimizados para conseguir clientes por WhatsApp..."
                    className="w-full text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] resize-none font-sans"
                  />
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    La IA integrará este texto de forma natural en los mensajes generados para cada rubro.
                  </p>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* SECCIÓN 04: GOOGLE SHEETS & CRM (TICKET & WEBHOOK)   */}
            {/* ---------------------------------------------------- */}
            <div className="space-y-4 pt-6 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-xs uppercase font-bold text-[#1E3A8A] flex items-center gap-1.5 tracking-wider">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>04. CRM & Integración Google Sheets / Webhook</span>
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Definí el valor promedio por cliente y conectá tu Google Sheets para sincronizar con 1 clic
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ticket promedio */}
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                    <span>Ticket Promedio por Web (ARS)</span>
                    <span className="font-mono text-[10px] text-[#64748B]">Métricas CRM</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B]">$</span>
                    <input
                      type="number"
                      value={tempAi.avgTicket || 250000}
                      onChange={(e) => setTempAi(prev => ({ ...prev, avgTicket: Number(e.target.value) }))}
                      placeholder="250000"
                      className="w-full pl-7 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                    />
                  </div>
                  <p className="text-[10px] text-[#64748B]">
                    Calcula automáticamente el valor total del pipeline comercial en tu tablero CRM.
                  </p>
                </div>

                {/* Google Sheets Webhook URL */}
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                    <span>Webhook URL (Google Sheets / Make)</span>
                    <span className="font-mono text-[10px] text-[#059669]">POST Endpoint</span>
                  </label>
                  <input
                    type="url"
                    value={tempAi.webhookUrl || ''}
                    onChange={(e) => setTempAi(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs font-mono text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                  />
                  <p className="text-[10px] text-[#64748B]">
                    Al presionar "Sincronizar a Google Sheets" en el CRM, se enviarán tus leads a esta URL.
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F1F5F9] bg-[#F8FAFC]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={savedSuccess}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-95"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-[#34D399]" />
                <span>¡Guardado con éxito!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>Guardar Configuración</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
