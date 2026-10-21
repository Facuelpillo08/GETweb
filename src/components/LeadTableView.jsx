import React, { useState } from 'react';
import { 
  ExternalLink, 
  Star, 
  Globe, 
  Check, 
  BookmarkPlus, 
  BookmarkCheck, 
  MessageCircle, 
  Copy,
  Sparkles,
  RefreshCw,
  X,
  AlertTriangle,
  Wand2
} from 'lucide-react';
import { 
  generateWhatsAppLink, 
  formatPhoneForWhatsApp,
  getPhoneType,
  WHATSAPP_TEMPLATES
} from '../utils/whatsappHelper';
import { generateAIPitch, generateBuiltInAIPitch, AI_TONES } from '../services/aiPitchService';
import { checkIsContacted } from '../utils/contactedHelper';

export default function LeadTableView({
  leads = [],
  crmLeads = [],
  contactedHistory = [],
  onMarkContacted,
  onSaveLead,
  onRemoveLead,
  _waTemplates = WHATSAPP_TEMPLATES,
  aiSettings = {},
  onOpenSettings
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [selectedLeadForAi, setSelectedLeadForAi] = useState(null);
  const [aiPitchText, setAiPitchText] = useState('');
  const [aiTone, setAiTone] = useState('friendly');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedModalPitch, setCopiedModalPitch] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState(null);
  const [variantIndex, setVariantIndex] = useState(0);

  const getProviderKey = () => {
    if (aiSettings?.provider === 'groq') return aiSettings?.groqApiKey;
    if (aiSettings?.provider === 'deepseek') return aiSettings?.deepseekApiKey;
    if (aiSettings?.provider === 'gemini') return aiSettings?.geminiApiKey;
    if (aiSettings?.provider === 'openai') return aiSettings?.openaiApiKey;
    return null;
  };
  const activeKey = getProviderKey();
  const isMissingKey = Boolean(aiSettings?.provider && aiSettings.provider !== 'builtin' && (!activeKey || !activeKey.trim()));

  const handleOpenAiModal = (lead) => {
    setSelectedLeadForAi(lead);
    setAiTone('friendly');
    setAiError(null);
    setAiSuccessMsg(null);
    // Pre-populate with pregenerated pitch or smart AI pitch immediately
    try {
      setAiPitchText(lead.pregeneratedPitch || lead.customPitch || generateBuiltInAIPitch(lead, { ...aiSettings, tone: 'friendly' }));
    } catch {
      setAiPitchText('');
    }
  };

  const handleGenerateForLead = async (lead, toneToUse, isPolish = false, customInstructionOverride = null) => {
    if (!lead) return;
    setIsGeneratingAi(true);
    setAiError(null);
    setAiSuccessMsg(null);

    const nextVar = (variantIndex + 1) % 3;
    setVariantIndex(nextVar);

    const instructionToUse = customInstructionOverride !== null ? customInstructionOverride : customPrompt;

    try {
      const result = await generateAIPitch(lead, {
        ...aiSettings,
        tone: toneToUse || aiTone,
        currentPitch: isPolish && aiPitchText ? aiPitchText : '',
        customInstruction: instructionToUse || '',
        variant: nextVar
      });
      if (result.success) {
        setAiPitchText(result.pitch);
        const provLabel = result.isFallback
          ? 'Motor Smart IA'
          : (result.provider === 'groq' ? 'Groq (Llama 3)'
              : result.provider === 'deepseek' ? 'DeepSeek Oficial'
              : result.provider === 'gemini' ? 'Google Gemini'
              : result.provider === 'openai' ? 'OpenAI'
              : 'Motor Smart IA');
        setAiSuccessMsg(instructionToUse ? '¡Mensaje adaptado con tu indicación!' : `¡Mensaje ${isPolish ? 'pulido' : 'actualizado'} con ${provLabel}!`);
        setTimeout(() => setAiSuccessMsg(null), 3500);
      } else {
        setAiError(result.error || 'No se pudo conectar con el servicio de IA externa.');
      }
    } catch (err) {
      console.error('Error generating AI pitch in table:', err);
      setAiError(err.message || 'Error inesperado al conectar con el servicio de IA.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyPhone = (leadId, phoneVal) => {
    if (!phoneVal) return;
    navigator.clipboard.writeText(phoneVal);
    setCopiedId(leadId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3.5 px-4 font-bold">#</th>
              <th className="py-3.5 px-4 font-bold">Negocio & Rubro</th>
              <th className="py-3.5 px-4 font-bold">Ubicación</th>
              <th className="py-3.5 px-4 font-bold">Estado Web</th>
              <th className="py-3.5 px-4 font-bold">Teléfono</th>
              <th className="py-3.5 px-4 font-bold">Reseñas</th>
              <th className="py-3.5 px-4 font-bold text-right">Acción Rápida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {leads.map((lead, idx) => {
              const isSaved = crmLeads.some(item => item.id === lead.id);
              const contactInfo = checkIsContacted(lead, contactedHistory);
              const isAlreadyContacted = contactInfo.isContacted;
              const contactedRecord = contactInfo.record;

              const phoneVal = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone;
              const phoneInfo = getPhoneType(phoneVal);
              const cleanPhone = formatPhoneForWhatsApp(phoneVal);
              const aiPitch = generateBuiltInAIPitch(lead, aiSettings);
              const waUrl = cleanPhone ? generateWhatsAppLink(cleanPhone, null, lead, aiPitch) : null;

              return (
                <tr 
                  key={lead.id}
                  className={`hover:bg-[#F8FAFC] transition-colors ${isSaved ? 'bg-[#EFF6FF]/30' : ''}`}
                >
                  {/* Index */}
                  <td className="py-3 px-4 font-mono text-[11px] text-[#94A3B8]">
                    {String(idx + 1).padStart(2, '0')}
                  </td>

                  {/* Business Name & Rubro */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[#0F172A] font-sans text-xs">
                        {lead.displayName}
                      </span>
                      {isAlreadyContacted && (
                        <span 
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
                          title={`Ya contactado el ${contactedRecord?.formattedDate || 'anteriormente'}`}
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>Contactado</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#64748B] font-mono mt-0.5">
                      {lead.primaryTypeDisplayName || lead.rubro || 'Comercio'}
                    </div>
                  </td>

                  {/* Location & Maps */}
                  <td className="py-3 px-4 max-w-[200px]">
                    <div className="truncate text-[#475569] text-xs" title={lead.formattedAddress}>
                      {lead.city || lead.formattedAddress}
                    </div>
                    {lead.googleMapsUri && (
                      <a 
                        href={lead.googleMapsUri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#1E3A8A] hover:underline inline-flex items-center gap-0.5 mt-0.5"
                      >
                        <span>Maps</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </td>

                  {/* Web Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {lead.classification?.type === 'NO_WEB' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
                        <span>Sin Web</span>
                      </span>
                    ) : lead.classification?.type === 'SOCIAL_ONLY' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                        <span>{lead.classification.label}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]">
                        <Globe className="w-2.5 h-2.5 text-[#0284C7]" />
                        <span>Con Web</span>
                      </span>
                    )}
                  </td>

                  {/* Phone */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {phoneVal ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-[#0F172A]">{phoneVal}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(lead.id, phoneVal)}
                          className="p-1 hover:bg-[#E2E8F0] rounded text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                          title="Copiar teléfono"
                        >
                          {copiedId === lead.id ? (
                            <Check className="w-3 h-3 text-[#059669]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded border font-bold ${
                          phoneInfo.isMobile 
                            ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' 
                            : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                        }`}>
                          {phoneInfo.label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#94A3B8] italic text-[11px]">No disponible</span>
                    )}
                  </td>

                  {/* Reviews */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {lead.rating ? (
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span className="font-bold text-[#0F172A]">{lead.rating.toFixed(1)}</span>
                        <span className="text-[#94A3B8] font-mono text-[10px]">({lead.userRatingCount || 0})</span>
                      </div>
                    ) : (
                      <span className="text-[#94A3B8] text-[10px]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* AI Pitch Trigger Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenAiModal(lead)}
                        className="px-2 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E3A8A] font-bold text-[11px] inline-flex items-center gap-1 border border-[#BFDBFE] transition cursor-pointer shadow-2xs"
                        title="Generar mensaje personalizado con IA para este negocio"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Pitch IA</span>
                      </button>

                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (typeof onMarkContacted === 'function') {
                              onMarkContacted(lead, aiPitch, 'manual_table_whatsapp');
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 shadow-xs transition ${
                            isAlreadyContacted
                              ? 'bg-[#065F46] hover:bg-[#047857] text-white'
                              : 'bg-[#059669] hover:bg-[#047857] text-white'
                          }`}
                          title={isAlreadyContacted ? `Ya contactado el ${contactedRecord?.formattedDate || ''}. Clic para volver a abrir WhatsApp` : "Contactar con mensaje personalizado de IA por WhatsApp"}
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>{isAlreadyContacted ? 'Reenviar WA' : 'WhatsApp (IA)'}</span>
                        </a>
                      ) : (
                        <span className="text-[#94A3B8] text-[10px] italic px-2">Sin WhatsApp</span>
                      )}

                      <button
                        type="button"
                        onClick={() => isSaved ? onRemoveLead(lead.id) : onSaveLead(lead)}
                        className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                          isSaved 
                            ? 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE] hover:bg-[#FFF1F2] hover:text-[#E11D48]' 
                            : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#1E3A8A] hover:text-[#1E3A8A]'
                        }`}
                        title={isSaved ? "Quitar de mi CRM" : "Guardar en mi CRM"}
                      >
                        {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A]" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* AI Pitch Modal for Table View */}
      {selectedLeadForAi && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedLeadForAi(null)}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#BFDBFE] overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] font-sans">
                    Mensaje con IA para {selectedLeadForAi.displayName}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    {selectedLeadForAi.rubro} • {selectedLeadForAi.city}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLeadForAi(null)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5">
              {/* Missing key alert */}
              {isMissingKey && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-950 font-sans">
                        Falta API Key para {aiSettings.provider?.toUpperCase()}
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Ingresá tu API Key en Configuración para activar respuestas en vivo del modelo.
                      </p>
                    </div>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadForAi(null);
                        onOpenSettings();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 cursor-pointer transition shadow-2xs"
                    >
                      Configurar
                    </button>
                  )}
                </div>
              )}

              {/* Error Alert */}
              {aiError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-950 font-sans">Aviso de IA</p>
                      <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">{aiError}</p>
                    </div>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadForAi(null);
                        onOpenSettings();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shrink-0 cursor-pointer transition shadow-2xs"
                    >
                      Ver Ajustes
                    </button>
                  )}
                </div>
              )}

              {/* Success Alert */}
              {aiSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{aiSuccessMsg}</span>
                </div>
              )}

              {/* Tone Selection */}
              <div>
                <span className="text-[10px] font-mono uppercase text-[#64748B] block mb-1.5 font-bold">
                  ENFOQUE / TONO DE VENTA:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {AI_TONES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setAiTone(t.id);
                        handleGenerateForLead(selectedLeadForAi, t.id, false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-xs border transition cursor-pointer flex items-center gap-1.5 ${
                        aiTone === t.id
                          ? 'bg-[#EFF6FF] text-[#1E3A8A] border-[#1E3A8A] font-bold shadow-xs'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <span>{t.emoji}</span>
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea & Controls */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                  <span className="text-[#64748B] font-mono text-[10px]">
                    PROPUESTA EDITABLE PARA WHATSAPP:
                  </span>
                  <div className="flex items-center gap-2">
                    {aiSettings?.provider && aiSettings.provider !== 'builtin' ? (
                      <>
                        <button
                          type="button"
                          disabled={isGeneratingAi}
                          onClick={() => handleGenerateForLead(selectedLeadForAi, aiTone, true)}
                          className="px-2 py-1 rounded-md bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E3A8A] text-[11px] font-bold inline-flex items-center gap-1 border border-[#BFDBFE] cursor-pointer transition"
                          title="Pulir el borrador actual con el modelo LLM activo"
                        >
                          <Sparkles className={`w-3 h-3 text-amber-500 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                          <span>Pulir con LLM</span>
                        </button>
                        <button
                          type="button"
                          disabled={isGeneratingAi}
                          onClick={() => handleGenerateForLead(selectedLeadForAi, aiTone, false)}
                          className="text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                          <span>Nuevo</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isGeneratingAi}
                        onClick={() => handleGenerateForLead(selectedLeadForAi, aiTone, false)}
                        className="px-2 py-1 rounded-md bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E3A8A] text-[11px] font-bold inline-flex items-center gap-1 border border-[#BFDBFE] cursor-pointer transition"
                      >
                        <RefreshCw className={`w-3 h-3 text-amber-500 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                        <span>Nueva versión</span>
                      </button>
                    )}
                  </div>
                </div>

                {isGeneratingAi ? (
                  <div className="h-44 rounded-xl bg-[#F8FAFC] border border-[#BFDBFE] flex flex-col items-center justify-center gap-2 text-[#1E3A8A]">
                    <Sparkles className="w-5 h-5 animate-spin text-[#1E3A8A]" />
                    <span className="text-xs font-mono font-bold animate-pulse">Redactando propuesta con IA...</span>
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={aiPitchText}
                    onChange={(e) => setAiPitchText(e.target.value)}
                    className="w-full text-xs text-[#0F172A] leading-relaxed p-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] resize-none font-sans"
                    placeholder="El mensaje generado por IA aparecerá acá..."
                  />
                )}

                {/* AI Custom Instruction Prompt Input */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-xl p-1 shadow-2xs focus-within:border-[#1E3A8A] focus-within:ring-1 focus-within:ring-[#1E3A8A] transition">
                    <Wand2 className="w-3.5 h-3.5 text-[#1E3A8A] ml-2 shrink-0" />
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGenerateForLead(selectedLeadForAi, aiTone, true);
                        }
                      }}
                      placeholder="Indicación a la IA (ej: más corto, enfatizá delivery...)"
                      className="w-full bg-transparent text-xs text-[#0F172A] placeholder-[#94A3B8] px-2 py-0.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isGeneratingAi}
                      onClick={() => handleGenerateForLead(selectedLeadForAi, aiTone, true)}
                      className="px-3 py-1 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition disabled:opacity-50 cursor-pointer shadow-xs"
                      title="Adaptar el mensaje con la indicación ingresada"
                    >
                      <Sparkles className={`w-3 h-3 ${isGeneratingAi ? 'animate-spin text-amber-300' : 'text-amber-400'}`} />
                      <span>{isGeneratingAi ? '...' : 'Cambiar'}</span>
                    </button>
                  </div>

                  {/* Quick Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[#64748B] font-medium">Sugerencias:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPrompt('Hacelo más corto y directo');
                        handleGenerateForLead(selectedLeadForAi, aiTone, true, 'Hacelo más corto y directo');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] transition cursor-pointer"
                    >
                      + Corto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPrompt('Enfatizá pedidos directos y delivery');
                        handleGenerateForLead(selectedLeadForAi, aiTone, true, 'Enfatizá pedidos directos y delivery');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] transition cursor-pointer"
                    >
                      Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPrompt('Hacelo en un tono formal y corporativo');
                        handleGenerateForLead(selectedLeadForAi, aiTone, true, 'Hacelo en un tono formal y corporativo');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] transition cursor-pointer"
                    >
                      Formal
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#F1F5F9] bg-[#F8FAFC]">
              <button
                type="button"
                onClick={() => {
                  if (aiPitchText) {
                    navigator.clipboard.writeText(aiPitchText);
                    setCopiedModalPitch(true);
                    setTimeout(() => setCopiedModalPitch(false), 2000);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedModalPitch ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedModalPitch ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeadForAi(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                >
                  Cerrar
                </button>

                {(() => {
                  const phoneVal = selectedLeadForAi.nationalPhoneNumber || selectedLeadForAi.internationalPhoneNumber || selectedLeadForAi.phone;
                  const cleanPhone = formatPhoneForWhatsApp(phoneVal);
                  const modalWaUrl = cleanPhone 
                    ? generateWhatsAppLink(cleanPhone, null, selectedLeadForAi, aiPitchText)
                    : null;

                  return modalWaUrl ? (
                    <a
                      href={modalWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (typeof onMarkContacted === 'function') {
                          onMarkContacted(selectedLeadForAi, aiPitchText, 'manual_modal_whatsapp');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Enviar por WhatsApp</span>
                    </a>
                  ) : (
                    <span className="text-xs text-[#94A3B8] italic">Sin WhatsApp</span>
                  );
                })()}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
