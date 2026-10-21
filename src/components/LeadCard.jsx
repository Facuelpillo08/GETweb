import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Phone, 
  ExternalLink, 
  Star, 
  Globe, 
  Check, 
  BookmarkPlus, 
  BookmarkCheck, 
  MessageCircle, 
  Copy,
  SearchCode,
  Sparkles,
  Wand2,
  RefreshCw,
  SlidersHorizontal,
  Calendar
} from 'lucide-react';
import { 
  generateWhatsAppLink, 
  formatPhoneForWhatsApp,
  getPhoneType,
  getRecommendedTemplateId,
  personalizeMessage,
  WHATSAPP_TEMPLATES
} from '../utils/whatsappHelper';
import { auditWebsite } from '../services/placesApi';
import { generateAIPitch, generateBuiltInAIPitch, AI_TONES } from '../services/aiPitchService';

export default function LeadCard({ 
  lead, 
  isSaved = false, 
  isAlreadyContacted = false,
  contactedRecord = null,
  onMarkContacted,
  onSaveLead, 
  onRemoveLead,
  onUpdateLead,
  waTemplates = WHATSAPP_TEMPLATES,
  aiSettings = {},
  _onOpenSettings,
  index
}) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const { classification } = lead;

  // Helper to determine active provider label
  const getBadgeLabel = () => {
    if (aiSettings?.provider === 'groq') return '⚡ Groq (Llama 3)';
    if (aiSettings?.provider === 'deepseek') return '🐳 DeepSeek Oficial';
    if (aiSettings?.provider === 'gemini') return '✨ Google Gemini';
    if (aiSettings?.provider === 'openai') return '🤖 GPT-4o mini';
    return '⚡ Motor IA Smart';
  };

  // AI & Message states
  const [activePitchMode, setActivePitchMode] = useState('ai'); // 'ai' | 'template'
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => getRecommendedTemplateId(lead));
  const [aiTone, setAiTone] = useState('friendly');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const [aiPitchText, setAiPitchText] = useState(() => {
    if (lead?.pregeneratedPitch) return lead.pregeneratedPitch;
    if (lead?.customPitch) return lead.customPitch;
    try {
      return generateBuiltInAIPitch(lead, { ...aiSettings, tone: 'friendly' });
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (lead?.pregeneratedPitch) {
      setAiPitchText(lead.pregeneratedPitch);
    }
  }, [lead?.pregeneratedPitch]);

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiProviderBadge, setAiProviderBadge] = useState(getBadgeLabel);
  const [aiError, setAiError] = useState(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState(null);
  const [variantIndex, setVariantIndex] = useState(0);

  // Web Auditor state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);

  const phoneValue = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone;
  const phoneType = getPhoneType(phoneValue);

  const handleCopyPhone = (e) => {
    e.stopPropagation();
    if (phoneValue) {
      navigator.clipboard.writeText(phoneValue);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  // Get active template text (fallback mode)
  const activeTemplateObj = waTemplates?.[selectedTemplateId] || WHATSAPP_TEMPLATES[selectedTemplateId] || WHATSAPP_TEMPLATES.no_web;
  const personalizedPitchText = personalizeMessage(activeTemplateObj.text, lead);
  
  // Active pitch message
  const effectiveMessage = activePitchMode === 'ai' 
    ? (aiPitchText || generateBuiltInAIPitch(lead, { ...aiSettings, tone: aiTone }))
    : personalizedPitchText;
  const cleanPhone = formatPhoneForWhatsApp(phoneValue);
  const waUrl = cleanPhone ? generateWhatsAppLink(cleanPhone, null, lead, effectiveMessage) : null;

  // Generate or regenerate AI pitch with custom instruction
  const handleGenerateAi = async (toneOverride, isPolish = false, customInstructionOverride = null) => {
    const toneToUse = toneOverride || aiTone;
    const instructionToUse = customInstructionOverride !== null ? customInstructionOverride : customPrompt;

    setIsGeneratingAi(true);
    setAiError(null);
    setAiSuccessMsg(null);
    setActivePitchMode('ai');

    const nextVar = (variantIndex + 1) % 3;
    setVariantIndex(nextVar);

    try {
      const result = await generateAIPitch(lead, {
        ...aiSettings,
        tone: toneToUse,
        currentPitch: isPolish && aiPitchText ? aiPitchText : '',
        customInstruction: instructionToUse || '',
        variant: nextVar
      });

      if (result.success) {
        setAiPitchText(result.pitch);
        setAiProviderBadge(
          result.isFallback
            ? '⚡ Motor IA Smart'
            : (result.provider === 'groq'
                ? '⚡ Groq (Llama 3)'
                : result.provider === 'deepseek'
                  ? '🐳 DeepSeek Oficial'
                  : result.provider === 'gemini' 
                    ? '✨ Google Gemini' 
                    : result.provider === 'openai' 
                      ? '🤖 GPT-4o mini' 
                      : '⚡ Motor IA Smart')
        );
        const provLabel = result.isFallback
          ? 'Motor Smart IA'
          : (result.provider === 'groq' ? 'Groq (Llama 3)'
              : result.provider === 'deepseek' ? 'DeepSeek'
              : result.provider === 'gemini' ? 'Google Gemini'
              : result.provider === 'openai' ? 'OpenAI'
              : 'Motor Smart IA');
        setAiSuccessMsg(instructionToUse ? '¡Mensaje adaptado con tu indicación!' : `¡Mensaje actualizado con ${provLabel}!`);
        setTimeout(() => setAiSuccessMsg(null), 3000);
      } else {
        setAiError(result.error || 'No se pudo generar el mensaje con la IA externa.');
      }
    } catch (err) {
      console.error('Error generating AI pitch:', err);
      setAiError(err.message || 'Error inesperado al conectar con el servicio de IA.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyCustomPrompt = (suggestedText = null) => {
    const textToApply = suggestedText !== null ? suggestedText : customPrompt;
    if (suggestedText !== null) {
      setCustomPrompt(suggestedText);
    }
    handleGenerateAi(aiTone, true, textToApply);
  };

  const handleCopyPitch = (e) => {
    e.stopPropagation();
    if (effectiveMessage) {
      navigator.clipboard.writeText(effectiveMessage);
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2000);
    }
  };

  // Live website audit trigger
  const handleRunAudit = async (e) => {
    e.stopPropagation();
    if (!lead.websiteUri || isAuditing) return;
    setIsAuditing(true);
    setShowAuditDrawer(true);
    const result = await auditWebsite(lead.websiteUri);
    setAuditResult(result);
    setIsAuditing(false);
  };

  return (
    <div className={`group relative bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-300 flex flex-col justify-between ${
      isSaved 
        ? 'border-blue-600 shadow-md bg-blue-50/10 ring-1 ring-blue-600/20' 
        : 'border-slate-200 hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5'
    }`}>
      
      {/* 1. Header: Name, Status Badge, Quick Bookmark */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 mb-1">
              {typeof index === 'number' && (
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  #{String(index + 1).padStart(2, '0')}
                </span>
              )}
              <h3 
                className="text-base font-bold text-slate-900 group-hover:text-blue-900 transition-colors truncate font-sans tracking-tight"
                title={lead.displayName}
              >
                {lead.displayName}
              </h3>
            </div>

            {/* Rubro, City & Rating line */}
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                {lead.primaryTypeDisplayName || lead.rubro || 'Comercio'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="truncate max-w-[130px]">{lead.city || 'Local'}</span>
              
              {lead.rating && (
                <>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1 text-amber-600 font-semibold text-[11px]" title={`${lead.rating} estrellas en Google`}>
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>{Number(lead.rating).toFixed(1)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Web Status Pill & Contacted Indicator */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {isAlreadyContacted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs" title={`Contactado el ${contactedRecord?.formattedDate || ''}`}>
                <Check className="w-3 h-3 text-emerald-700" />
                <span>Contactado</span>
              </span>
            )}
            {classification?.type === 'NO_WEB' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Sin Web</span>
              </span>
            ) : classification?.type === 'SOCIAL_ONLY' ? (
              <a
                href={lead.websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                title="Abre perfil de red social"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Solo Redes</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            ) : (
              <div className="flex items-center gap-1">
                <a
                  href={lead.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition"
                  title={`Abrir sitio: ${lead.websiteUri}`}
                >
                  <Globe className="w-3 h-3 text-sky-600" />
                  <span>Con Web</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>
                <button
                  type="button"
                  onClick={handleRunAudit}
                  className="p-1 rounded-full text-slate-400 hover:text-blue-900 hover:bg-blue-50 transition"
                  title="Auditar velocidad y móvil"
                >
                  <SearchCode className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. Contact & Address Row */}
        <div className="flex items-center justify-between text-xs text-slate-600 py-1.5 px-2.5 bg-slate-50 rounded-xl border border-slate-100 mb-3">
          <div className="flex items-center gap-1.5 truncate pr-2">
            <Phone className={`w-3.5 h-3.5 shrink-0 ${phoneType.isMobile ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span className="font-mono text-slate-800 font-medium truncate">
              {phoneValue || 'Sin teléfono visible'}
            </span>
            {phoneValue && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                phoneType.isMobile ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {phoneType.isMobile ? 'Móvil' : 'Fijo'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {phoneValue && (
              <button
                type="button"
                onClick={handleCopyPhone}
                className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Copiar teléfono"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}

            {lead.googleMapsUri && (
              <a
                href={lead.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-white rounded text-slate-500 hover:text-blue-900 transition"
                title={`Ver en Google Maps: ${lead.formattedAddress}`}
              >
                <MapPin className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Audit Drawer (Collapsed by default, only shown if triggered) */}
        {showAuditDrawer && (
          <div className="mb-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-2 animate-fade-in">
            <div className="flex items-center justify-between border-b border-blue-200 pb-1">
              <span className="font-bold text-blue-900 flex items-center gap-1">
                <SearchCode className="w-3.5 h-3.5" /> Auditoría Web
              </span>
              <button onClick={() => setShowAuditDrawer(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            {isAuditing ? (
              <p className="text-[11px] text-blue-800 animate-pulse">Inspeccionando velocidad y optimización móvil...</p>
            ) : auditResult ? (
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="bg-white p-1.5 rounded border border-blue-100">
                  <span className="text-slate-400 block text-[10px]">Carga:</span>
                  <span className="font-bold font-mono">{auditResult.responseTimeMs} ms</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-blue-100">
                  <span className="text-slate-400 block text-[10px]">Móvil:</span>
                  <span className="font-semibold">{auditResult.hasViewport ? 'Adaptable' : 'No adaptado'}</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 3. Unified AI Message Section */}
        <div className="mb-3 rounded-xl bg-slate-50/90 border border-slate-200 p-3 space-y-2.5">
          {/* Header of message box */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Mensaje WhatsApp</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-medium">
                {aiProviderBadge}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Copy Pitch Button */}
              <button
                type="button"
                onClick={handleCopyPitch}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white transition cursor-pointer"
                title="Copiar texto del mensaje"
              >
                {copiedPitch ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPitch ? 'Copiado' : 'Copiar'}</span>
              </button>

              {/* Toggle Options (Tones & Templates) */}
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className={`p-1 rounded transition cursor-pointer text-slate-500 hover:text-slate-800 ${
                  showAdvancedOptions ? 'bg-white shadow-2xs text-blue-900' : 'hover:bg-white'
                }`}
                title="Ajustar tono o plantilla"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Feedback alerts */}
          {aiError && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start justify-between gap-1">
              <span className="leading-tight">{aiError}</span>
              <button onClick={() => setAiError(null)} className="text-rose-500 font-bold ml-1">✕</button>
            </div>
          )}

          {aiSuccessMsg && (
            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{aiSuccessMsg}</span>
            </div>
          )}

          {/* Collapsible Advanced Options: Tones & Template switcher */}
          {showAdvancedOptions && (
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2 animate-fade-in text-xs">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                <span>ENFOQUE O TONO:</span>
                <button
                  type="button"
                  onClick={() => setActivePitchMode(activePitchMode === 'ai' ? 'template' : 'ai')}
                  className="text-blue-900 hover:underline"
                >
                  {activePitchMode === 'ai' ? 'Usar Plantilla Fija' : 'Usar Modo IA'}
                </button>
              </div>

              {activePitchMode === 'ai' ? (
                <div className="grid grid-cols-2 gap-1">
                  {AI_TONES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setAiTone(t.id);
                        handleGenerateAi(t.id, false);
                      }}
                      className={`px-2 py-1 rounded text-left text-[11px] transition flex items-center gap-1 border ${
                        aiTone === t.id 
                          ? 'bg-blue-50 text-blue-900 border-blue-300 font-semibold' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{t.emoji}</span>
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full text-xs p-1.5 rounded border border-slate-200 bg-slate-50 text-slate-800 font-medium"
                >
                  {Object.keys(WHATSAPP_TEMPLATES).map(key => (
                    <option key={key} value={key}>{WHATSAPP_TEMPLATES[key].title}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Quick Strategy Pills (1-click style switch) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase">ESTILO:</span>
            {[
              { id: 'friendly', label: '🤝 Cercano', tone: 'friendly' },
              { id: 'direct', label: '⚡ Directo', tone: 'direct' },
              { id: 'consultant', label: '🔍 Auditoría', tone: 'consultant' }
            ].map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setAiTone(pill.tone);
                  handleGenerateAi(pill.tone, false);
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer border ${
                  aiTone === pill.tone
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title={`Cambiar a estilo ${pill.label}`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Direct Editable Message Textarea */}
          <div className="relative">
            {isGeneratingAi ? (
              <div className="h-28 rounded-lg bg-white border border-blue-200 flex flex-col items-center justify-center gap-1.5 text-blue-900">
                <Sparkles className="w-5 h-5 text-amber-500 animate-spin" />
                <span className="text-xs font-medium animate-pulse">Redactando con IA...</span>
              </div>
            ) : (
              <textarea
                rows={4}
                value={effectiveMessage}
                onChange={(e) => {
                  setActivePitchMode('ai');
                  setAiPitchText(e.target.value);
                }}
                placeholder="El mensaje aparecerá acá..."
                className="w-full text-[11px] text-slate-800 leading-relaxed p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 resize-none font-sans"
              />
            )}
          </div>

          {/* AI Custom Instruction Prompt Input */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition">
              <Wand2 className="w-3.5 h-3.5 text-blue-600 ml-2 shrink-0" />
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyCustomPrompt();
                  }
                }}
                placeholder="Indicación a la IA (ej: más corto, enfatizá delivery...)"
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 px-2 py-0.5 focus:outline-none"
              />
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={() => handleApplyCustomPrompt()}
                className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition disabled:opacity-50 cursor-pointer shadow-xs"
                title="Adaptar el mensaje con la indicación ingresada"
              >
                <Sparkles className={`w-3 h-3 ${isGeneratingAi ? 'animate-spin text-amber-300' : 'text-amber-400'}`} />
                <span>{isGeneratingAi ? '...' : 'Cambiar'}</span>
              </button>
            </div>

            {/* Quick Prompt Suggestion Chips */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Sugerencias:</span>
              <button
                type="button"
                onClick={() => handleApplyCustomPrompt('Hacelo más corto y directo')}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
              >
                + Corto
              </button>
              <button
                type="button"
                onClick={() => handleApplyCustomPrompt('Enfatizá pedidos directos y delivery')}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
              >
                Delivery
              </button>
              <button
                type="button"
                onClick={() => handleApplyCustomPrompt('Hacelo en un tono más formal y corporativo')}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
              >
                Formal
              </button>
              <button
                type="button"
                onClick={() => handleGenerateAi(null, false)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-blue-900 border border-blue-200 font-medium transition cursor-pointer ml-auto flex items-center gap-1"
                title="Generar nueva versión desde cero"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Nueva versión</span>
              </button>
            </div>
          </div>
        {/* CRM Follow-up Bar if saved in CRM */}
        {isSaved && onUpdateLead && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-xs">
            <div className="flex items-center gap-1.5 text-blue-950 font-medium text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-blue-700" />
              <span>Seguimiento:</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={lead.followUpDate || ''}
                onChange={(e) => onUpdateLead(lead.id, { followUpDate: e.target.value })}
                className="bg-white border border-blue-200 rounded px-1.5 py-0.5 text-[11px] text-slate-800 font-mono focus:outline-none focus:border-blue-700 cursor-pointer"
                title="Fecha de próximo contacto"
              />
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 3);
                  onUpdateLead(lead.id, { followUpDate: d.toISOString().slice(0, 10) });
                }}
                className="px-1.5 py-0.5 rounded bg-white hover:bg-blue-100 text-[10px] text-blue-900 border border-blue-200 font-semibold cursor-pointer"
                title="Programar contacto en 3 días"
              >
                +3d
              </button>
            </div>
          </div>
        )}

      </div>
      </div>

      {/* 4. Action Footer: WhatsApp & Save to CRM */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (typeof onMarkContacted === 'function') {
                onMarkContacted(lead, effectiveMessage, 'manual_whatsapp');
              }
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 ${
              isAlreadyContacted
                ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title={isAlreadyContacted ? `Ya se contactó el ${contactedRecord?.formattedDate || ''}. Clic para volver a abrir WhatsApp` : "Abrir WhatsApp con este mensaje listo para enviar"}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{isAlreadyContacted ? 'Reenviar WhatsApp' : 'Enviar por WhatsApp'}</span>
          </a>
        ) : (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Sin WhatsApp</span>
          </button>
        )}

        {/* CRM Save / Remove Button */}
        <button
          onClick={() => isSaved ? onRemoveLead(lead.id) : onSaveLead(lead)}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer ${
            isSaved
              ? 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
          title={isSaved ? "Quitar del CRM" : "Guardar en el CRM"}
        >
          {isSaved ? (
            <>
              <BookmarkCheck className="w-4 h-4 text-blue-900" />
              <span className="font-bold text-[11px]">En CRM</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="w-4 h-4 text-slate-500" />
              <span className="text-[11px]">Guardar</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
