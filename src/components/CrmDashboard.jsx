import React, { useState, useRef, useMemo } from 'react';
import { 
  Users, 
  Search, 
  MessageCircle, 
  Trash2, 
  ExternalLink, 
  Phone, 
  MapPin, 
  FileSpreadsheet, 
  Sparkles, 
  Edit3, 
  Download, 
  Upload, 
  Clock,
  Flame,
  BadgeDollarSign,
  LayoutGrid,
  ListFilter,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  X,
  Send,
  AlertTriangle,
  Calendar,
  Bell,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { 
  formatPhoneForWhatsApp, 
  generateWhatsAppLink, 
  getPhoneType
} from '../utils/whatsappHelper';
import { CRM_STATUSES } from '../data/crmConstants';
import { generateAIPitch, generateBuiltInAIPitch, AI_TONES } from '../services/aiPitchService';

export default function CrmDashboard({
  leads = [],
  contactedHistory = [],
  onUpdateLead,
  onRemoveLead,
  onImportLeads,
  aiSettings = {},
  onSwitchToExplorer,
  onOpenSettings
}) {
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [contactedSearchTerm, setContactedSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list' | 'contacted'
  const [selectedLeadForAi, setSelectedLeadForAi] = useState(null);
  const [aiTone, setAiTone] = useState('friendly');
  const [aiPitchText, setAiPitchText] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const fileInputRef = useRef(null);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  // Today's date string for follow-up reminders
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isDueTodayOrOverdue = (dateStr) => Boolean(dateStr && dateStr <= todayStr);

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
    setCopiedAi(false);
    setAiError(null);
    setAiSuccessMsg(null);
    // Pre-populate with pregenerated pitch or smart AI pitch immediately
    try {
      setAiPitchText(lead.pregeneratedPitch || lead.customPitch || generateBuiltInAIPitch(lead, { ...aiSettings, tone: aiTone }));
    } catch {
      setAiPitchText('');
    }
  };

  const handleGenerateForLead = async (lead, tone, isPolish = false) => {
    if (!lead) return;
    setIsGeneratingAi(true);
    setAiError(null);
    setAiSuccessMsg(null);

    const nextVar = (variantIndex + 1) % 3;
    setVariantIndex(nextVar);

    try {
      const generated = await generateAIPitch(lead, {
        tone: tone || aiTone,
        ...aiSettings,
        currentPitch: isPolish && aiPitchText ? aiPitchText : '',
        variant: nextVar
      });

      if (generated?.success) {
        setAiPitchText(generated.pitch);
        const provLabel = generated.isFallback
          ? 'Motor Smart IA (Groq en pausa temporal)'
          : (generated.provider === 'groq' ? 'Groq (Llama 3)'
              : generated.provider === 'deepseek' ? 'DeepSeek Oficial'
              : generated.provider === 'gemini' ? 'Google Gemini'
              : generated.provider === 'openai' ? 'OpenAI'
              : 'Motor Smart IA');
        setAiSuccessMsg(`¡Mensaje ${isPolish ? 'pulido' : 'actualizado'} con ${provLabel}!`);
        setTimeout(() => setAiSuccessMsg(null), 3500);
      } else {
        setAiError(generated?.error || 'No se pudo conectar con el servicio de IA externa.');
      }
    } catch (err) {
      console.error('Error generating AI pitch in CRM:', err);
      setAiError(err.message || 'Error inesperado al conectar con el servicio de IA.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyAiPitch = () => {
    if (!aiPitchText) return;
    navigator.clipboard.writeText(aiPitchText);
    setCopiedAi(true);
    setTimeout(() => setCopiedAi(false), 2000);
  };

  // Filtered leads
  const filteredLeads = leads.filter(lead => {
    let matchesStatus = false;
    if (filterStatus === 'Todos') {
      matchesStatus = true;
    } else if (filterStatus === 'follow_ups_due') {
      matchesStatus = Boolean(lead.followUpDate && lead.followUpDate <= todayStr && lead.status !== 'Cliente cerrado 💸' && lead.status !== 'Descartado');
    } else {
      matchesStatus = (lead.status || 'Pendiente') === filterStatus;
    }

    const matchesSearch = searchTerm.trim() === '' || 
      lead.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.formattedAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.rubro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleNoteChange = (leadId, noteText) => {
    onUpdateLead(leadId, { notes: noteText });
  };

  const handleFollowUpDateChange = (leadId, newDate) => {
    onUpdateLead(leadId, { followUpDate: newDate });
  };

  const handleSetQuickFollowUp = (leadId, days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().slice(0, 10);
    onUpdateLead(leadId, { followUpDate: dateStr });
  };

  const handleStatusChange = (leadId, newStatus) => {
    onUpdateLead(leadId, { 
      status: newStatus,
      lastContactAt: new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    });
  };

  // Move lead to the next logical stage in pipeline
  const handleAdvanceStage = (lead) => {
    const current = lead.status || 'Pendiente';
    const sequence = ['Pendiente', 'Contactado', 'En charla', 'Propuesta enviada', 'Cliente cerrado 💸'];
    const idx = sequence.indexOf(current);
    if (idx !== -1 && idx < sequence.length - 1) {
      handleStatusChange(lead.id, sequence[idx + 1]);
    }
  };

  // Metrics calculation
  const totalCount = leads.length;
  const pendientesCount = leads.filter(l => (l.status || 'Pendiente') === 'Pendiente').length;
  const enNegociacionCount = leads.filter(l => l.status === 'En charla' || l.status === 'Propuesta enviada').length;
  const cerradosCount = leads.filter(l => l.status === 'Cliente cerrado 💸').length;
  const followUpsDueCount = leads.filter(l => isDueTodayOrOverdue(l.followUpDate) && l.status !== 'Cliente cerrado 💸' && l.status !== 'Descartado').length;
  const conversionRate = totalCount > 0 ? ((cerradosCount / totalCount) * 100).toFixed(1) : 0;

  // Financial Pipeline Projections (Feature 3)
  const avgTicket = Number(aiSettings?.avgTicket) || 250000;
  const pipelineTotal = totalCount * avgTicket;
  const pipelineNegociacion = enNegociacionCount * avgTicket;
  const pipelineCerrado = cerradosCount * avgTicket;

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Google Sheets / Webhook Sync (Feature 6)
  const handleSyncGoogleSheets = async () => {
    const webhookUrl = aiSettings?.webhookUrl;
    if (!webhookUrl || !webhookUrl.trim()) {
      if (onOpenSettings) onOpenSettings();
      alert('Configurá la URL de tu Webhook o Google Apps Script en Ajustes (SECCIÓN 04: CRM & Google Sheets).');
      return;
    }

    if (leads.length === 0) {
      alert('No hay prospectos en el CRM para sincronizar.');
      return;
    }

    setIsSyncingSheets(true);
    setSyncFeedback(null);

    try {
      const payload = {
        app: "GETweb",
        timestamp: new Date().toISOString(),
        leadsCount: leads.length,
        financials: {
          avgTicket,
          pipelineTotal,
          pipelineNegociacion,
          pipelineCerrado
        },
        leads: leads.map(l => ({
          id: l.id,
          displayName: l.displayName,
          rubro: l.rubro,
          city: l.city,
          address: l.formattedAddress,
          phone: l.nationalPhoneNumber || l.internationalPhoneNumber || l.phone || '',
          whatsapp: formatPhoneForWhatsApp(l.nationalPhoneNumber || l.internationalPhoneNumber || l.phone) || '',
          status: l.status || 'Pendiente',
          followUpDate: l.followUpDate || '',
          notes: l.notes || '',
          rating: l.rating || '',
          reviewsCount: l.userRatingCount || 0,
          website: l.websiteUri || l.website || '',
          classification: l.classification?.label || '',
          mapsUrl: l.googleMapsUri || l.maps_url || '',
          lastContactAt: l.lastContactAt || ''
        }))
      };

      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setSyncFeedback('¡Sincronizado con Google Sheets exitosamente!');
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.error('Error al sincronizar con Google Sheets:', err);
      alert('Error al conectar con el Webhook: ' + (err.message || 'Error de red'));
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (leads.length === 0) return;

    const headers = [
      "ID",
      "Nombre del Negocio",
      "Rubro",
      "Ciudad",
      "Direccion",
      "Telefono",
      "WhatsApp Formateado",
      "Estado Web",
      "Sitio Web Actual",
      "Calificacion",
      "Cant Reseñas",
      "Fecha Seguimiento",
      "Estado CRM",
      "Notas",
      "Ultimo Contacto",
      "Enlace Google Maps"
    ];

    const rows = leads.map(l => [
      `"${l.id || ''}"`,
      `"${(l.displayName || '').replace(/"/g, '""')}"`,
      `"${(l.rubro || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${(l.formattedAddress || '').replace(/"/g, '""')}"`,
      `"${l.nationalPhoneNumber || l.internationalPhoneNumber || l.phone || ''}"`,
      `"${formatPhoneForWhatsApp(l.nationalPhoneNumber || l.internationalPhoneNumber || l.phone) || ''}"`,
      `"${l.classification?.label || ''}"`,
      `"${l.websiteUri || l.website || 'Sin Web'}"`,
      `"${l.rating || ''}"`,
      `"${l.userRatingCount || 0}"`,
      `"${l.followUpDate || ''}"`,
      `"${l.status || 'Pendiente'}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
      `"${l.lastContactAt || ''}"`,
      `"${l.googleMapsUri || l.maps_url || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `getweb_crm_pipeline_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export full JSON Backup
  const exportToJSON = () => {
    if (leads.length === 0) return;
    const backupData = {
      app: "GETweb",
      version: "2.5",
      exportedAt: new Date().toISOString(),
      count: leads.length,
      leads
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `getweb_backup_crm_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered permanent contacted history
  const filteredContacted = useMemo(() => {
    if (!contactedSearchTerm.trim()) return contactedHistory;
    const q = contactedSearchTerm.toLowerCase();
    return contactedHistory.filter(item => {
      const name = (item.displayName || '').toLowerCase();
      const phone = (item.cleanPhone || item.originalPhone || '').toLowerCase();
      const rubro = (item.rubro || '').toLowerCase();
      const city = (item.city || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || rubro.includes(q) || city.includes(q);
    });
  }, [contactedHistory, contactedSearchTerm]);

  // Export permanent contacted history to CSV
  const exportContactedToCSV = () => {
    if (!contactedHistory || contactedHistory.length === 0) return;
    const headers = [
      "ID",
      "Nombre del Negocio",
      "Rubro",
      "Ciudad",
      "Direccion",
      "Telefono Original",
      "Telefono Limpio",
      "Fecha Contactado",
      "Canal",
      "Veces Contactado",
      "Resumen Mensaje"
    ];
    const rows = contactedHistory.map(c => [
      `"${c.id || ''}"`,
      `"${(c.displayName || '').replace(/"/g, '""')}"`,
      `"${(c.rubro || '').replace(/"/g, '""')}"`,
      `"${(c.city || '').replace(/"/g, '""')}"`,
      `"${(c.formattedAddress || '').replace(/"/g, '""')}"`,
      `"${c.originalPhone || ''}"`,
      `"${c.cleanPhone || ''}"`,
      `"${c.formattedDate || (c.contactedAt ? new Date(c.contactedAt).toLocaleString('es-AR') : '')}"`,
      `"${c.contactMethod || ''}"`,
      `"${c.contactCount || 1}"`,
      `"${(c.messageSnippet || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `getweb_contactados_permanente_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restore JSON Backup
  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const importedLeads = Array.isArray(parsed) ? parsed : (parsed.leads || []);
        if (importedLeads.length > 0 && onImportLeads) {
          onImportLeads(importedLeads);
        }
      } catch (err) {
        console.error("Error al importar JSON:", err);
        alert("El archivo seleccionado no es un JSON de backup válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 5 KPI Metrics Bento Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Metric 1: Total Leads */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              TOTAL CARTERA
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#EFF6FF] text-[#1E3A8A] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F172A] font-sans">
            {totalCount}
          </div>
          <span className="text-[11px] text-[#64748B] mt-1 block">
            Prospectos en pipeline
          </span>
        </div>

        {/* Metric 2: Pendientes */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-bold text-[#D97706] uppercase tracking-wider">
              POR CONTACTAR
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F172A] font-sans">
            {pendientesCount}
          </div>
          <span className="text-[11px] text-[#64748B] mt-1 block">
            Primer mensaje pendiente
          </span>
        </div>

        {/* Metric 3: En Negociación */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-bold text-[#2563EB] uppercase tracking-wider">
              EN NEGOCIACIÓN
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0F172A] font-sans">
            {enNegociacionCount}
          </div>
          <span className="text-[11px] text-[#64748B] mt-1 block">
            En charla o propuesta
          </span>
        </div>

        {/* Metric 4: Clientes Cerrados */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#A7F3D0] shadow-xs relative overflow-hidden bg-gradient-to-br from-white to-[#ECFDF5]/50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-bold text-[#059669] uppercase tracking-wider">
              CERRADOS 💸
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
              <BadgeDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="text-xl sm:text-2xl font-extrabold text-[#059669] font-sans">
              {cerradosCount}
            </div>
            <span className="text-[10px] font-mono font-bold text-[#059669]">
              ({conversionRate}%)
            </span>
          </div>
          <span className="text-[11px] text-[#047857] mt-1 block font-medium">
            Desarrollos cerrados
          </span>
        </div>

        {/* Metric 5: Contactados Histórico Permanente */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-300 shadow-xs relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/60">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              CONTACTADOS HISTÓRICO
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 font-sans">
            {contactedHistory.length}
          </div>
          <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
            Guardados para siempre
          </span>
        </div>

      </div>

      {/* Financial Pipeline Projections Banner (Feature 3) */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#1E3A8A] text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-[#334155] relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 tracking-wider uppercase">
                VALOR ESTIMADO PIPELINE
              </span>
              <span className="text-[11px] text-slate-300">
                Ticket prom: <span className="font-bold text-white font-mono">{formatMoney(avgTicket)}</span>
              </span>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[10px] text-sky-400 hover:text-sky-300 underline font-mono cursor-pointer"
              >
                Editar Ticket
              </button>
            </div>
            <div className="flex flex-wrap items-baseline gap-4 sm:gap-6 pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">POTENCIAL TOTAL CARTERA</span>
                <span className="text-lg sm:text-2xl font-black text-white font-sans">{formatMoney(pipelineTotal)}</span>
              </div>
              <div className="h-8 w-px bg-slate-700 hidden sm:block" />
              <div>
                <span className="text-[10px] text-amber-300 block font-mono">EN NEGOCIACIÓN / CHARLA</span>
                <span className="text-base sm:text-xl font-bold text-amber-400 font-sans">{formatMoney(pipelineNegociacion)}</span>
              </div>
              <div className="h-8 w-px bg-slate-700 hidden sm:block" />
              <div>
                <span className="text-[10px] text-emerald-300 block font-mono">FACTURACIÓN CERRADA 💸</span>
                <span className="text-base sm:text-xl font-bold text-emerald-400 font-sans">{formatMoney(pipelineCerrado)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <button
              type="button"
              onClick={handleSyncGoogleSheets}
              disabled={isSyncingSheets || leads.length === 0}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-sm active:scale-95"
              title="Sincronizar cartera comercial directamente con Google Sheets o Webhook"
            >
              {isSyncingSheets ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              )}
              <span>{isSyncingSheets ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className="mt-3 py-1.5 px-3 rounded-lg bg-emerald-900/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </div>

      {/* Main Filter & Action Header Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] relative">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] font-bold text-[#1E3A8A] bg-[#EFF6FF] px-2.5 py-0.5 rounded border border-[#BFDBFE]">
                PIPELINE COMERCIAL
              </span>
              <h2 className="text-xl font-bold text-[#0F172A] tracking-tight font-sans">
                Gestión de Prospectos & Cierres
              </h2>
            </div>
            <p className="text-xs text-[#64748B]">
              Organizá tus contactos por etapas de venta, enviá propuestas personalizadas y respaldá tu base de datos.
            </p>
          </div>

          {/* View Toggle + Backup Actions */}
          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-between lg:justify-end">
            
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-white text-[#1E3A8A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
                title="Vista Tablero Kanban por Etapas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tablero Kanban</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-[#1E3A8A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
                title="Vista Lista Detallada con Notas"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Lista con Notas</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('contacted')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'contacted'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
                title="Registro permanente de negocios que recibieron mensajes (nunca se borran)"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Contactados ({contactedHistory.length})</span>
              </button>
            </div>

            {/* Export & Import Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={exportToCSV}
                disabled={leads.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 shadow-xs"
                title="Descargar archivo CSV compatible con Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                <span>CSV</span>
              </button>

              <button
                onClick={exportToJSON}
                disabled={leads.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] disabled:opacity-40 text-[#0F172A] text-xs font-semibold rounded-xl transition cursor-pointer"
                title="Descargar copia de seguridad JSON"
              >
                <Download className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span className="hidden sm:inline">Backup</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] text-xs font-semibold rounded-xl transition cursor-pointer"
                title="Restaurar prospectos desde un archivo JSON de respaldo"
              >
                <Upload className="w-3.5 h-3.5 text-[#059669]" />
                <span className="hidden sm:inline">Restaurar</span>
              </button>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileImport} 
                accept=".json" 
                className="hidden" 
              />
            </div>

          </div>

        </div>

        {/* Filter and Search Bar within CRM */}
        <div className="mt-5 pt-4 border-t border-[#F1F5F9] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFilterStatus('Todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                filterStatus === 'Todos'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
              }`}
            >
              Todos ({leads.length})
            </button>

            {/* Follow-up / Reminders Filter Pill */}
            <button
              onClick={() => setFilterStatus(filterStatus === 'follow_ups_due' ? 'Todos' : 'follow_ups_due')}
              className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                filterStatus === 'follow_ups_due'
                  ? 'bg-[#E11D48] text-white font-bold shadow-xs'
                  : followUpsDueCount > 0
                    ? 'bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] font-semibold hover:bg-[#FFE4E6]'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
              }`}
              title="Filtrar prospectos con fecha de seguimiento para hoy o vencida"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Recordatorios</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-bold">
                ({followUpsDueCount})
              </span>
            </button>

            {CRM_STATUSES.map(st => {
              const count = leads.filter(l => (l.status || 'Pendiente') === st.id).length;
              const isSelected = filterStatus === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setFilterStatus(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#1E3A8A] text-white font-bold shadow-xs'
                      : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dotColor}`} />
                  <span>{st.shortLabel}</span>
                  <span className="font-mono text-[10px] opacity-80 font-bold">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search inside CRM */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por negocio o nota..."
              className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]/20 transition"
            />
          </div>

        </div>

      </div>

      {/* View Content */}
      {viewMode === 'contacted' ? (
        /* VISTA 3: HISTORIAL PERMANENTE E INMUTABLE */
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm space-y-5 animate-fade-in">
          {/* Explanatory Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-teal-50 border border-emerald-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950 font-sans flex items-center gap-2 flex-wrap">
                  <span>Registro Histórico Permanente de Negocios Contactados</span>
                  <span className="text-[10px] font-mono bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                    PROTECCIÓN TOTAL
                  </span>
                </h3>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed max-w-2xl">
                  Estos comercios ya recibieron una propuesta por WhatsApp (sea mediante el <strong>Bot de Envío Automático</strong> o por contacto manual).
                  Están guardados de forma permanente en el servidor (<code>server/data/contacted_history.json</code>).
                  <strong> Nunca se borran</strong> y el sistema bloquea automáticamente que se les vuelva a mandar un segundo mensaje repetido.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
              <button
                type="button"
                onClick={exportContactedToCSV}
                disabled={contactedHistory.length === 0}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                title="Descargar historial completo de negocios contactados en formato CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Exportar CSV ({contactedHistory.length})</span>
              </button>
            </div>
          </div>

          {/* Search filter within Contacted History */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={contactedSearchTerm}
                onChange={(e) => setContactedSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, teléfono, rubro o localidad..."
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 transition"
              />
            </div>
            <span className="text-xs font-mono text-slate-500 self-center">
              Mostrando {filteredContacted.length} de {contactedHistory.length} comercios contactados
            </span>
          </div>

          {/* Contacted List Table */}
          {contactedHistory.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-emerald-200 rounded-xl bg-emerald-50/20">
              <Shield className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">Todavía no enviaste mensajes a ningún negocio</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Cuando envíes propuestas usando el <strong>Bot de Envío Automático</strong> o abras <strong>WhatsApp</strong> desde cualquier tarjeta, los negocios se guardarán acá de por vida para no repetirles nunca.
              </p>
            </div>
          ) : filteredContacted.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No se encontraron comercios en el historial que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3.5 font-bold">#</th>
                    <th className="py-3 px-3.5 font-bold">Comercio</th>
                    <th className="py-3 px-3.5 font-bold">Ubicación</th>
                    <th className="py-3 px-3.5 font-bold">Teléfono</th>
                    <th className="py-3 px-3.5 font-bold">Fecha Contactado</th>
                    <th className="py-3 px-3.5 font-bold">Canal</th>
                    <th className="py-3 px-3.5 font-bold">Resumen Mensaje</th>
                    <th className="py-3 px-3.5 font-bold text-right">Protección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContacted.map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-400">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-slate-900">{c.displayName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.rubro || 'Comercio'}</div>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 text-[11px] max-w-[160px] truncate" title={c.formattedAddress}>
                        {c.city || c.formattedAddress || '—'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {c.cleanPhone ? `+${c.cleanPhone}` : (c.originalPhone || 'Sin teléfono')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                        <div className="text-xs font-medium">
                          {c.formattedDate || (c.contactedAt ? new Date(c.contactedAt).toLocaleDateString('es-AR') : '—')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {c.contactedAt ? new Date(c.contactedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {c.contactMethod === 'bot_puppeteer' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <span>🤖 Bot Automático</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span>📱 WhatsApp</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 text-[11px] max-w-[200px] truncate" title={c.messageSnippet}>
                        {c.messageSnippet || 'Propuesta de diseño web'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>No repetir</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EFF6FF] flex items-center justify-center text-[#1E3A8A] mb-4 border border-[#BFDBFE]">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A] mb-2 font-sans">
            Aún no tenés prospectos guardados en tu CRM
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6 leading-relaxed">
            Andá al Explorador de Oportunidades para rastrear comercios en cualquier ciudad y agregalos a tu pipeline con un solo clic.
          </p>
          <button
            onClick={onSwitchToExplorer}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white font-bold text-xs transition shadow-md hover:shadow-lg cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>Explorar Oportunidades Ahora</span>
          </button>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center text-xs text-[#64748B]">
          No hay prospectos que coincidan con el filtro o término de búsqueda.
        </div>
      ) : viewMode === 'kanban' ? (
        /* VISTA 1: TABLERO KANBAN POR ETAPAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {CRM_STATUSES.filter(s => s.id !== 'Descartado').map(statusCol => {
            const colLeads = filteredLeads.filter(l => (l.status || 'Pendiente') === statusCol.id);

            return (
              <div 
                key={statusCol.id}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 space-y-3 min-h-[300px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusCol.dotColor}`} />
                    <span className="font-bold text-xs text-[#0F172A]">{statusCol.shortLabel}</span>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[#64748B] font-bold">
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards in Column */}
                <div className="space-y-2.5">
                  {colLeads.map((lead) => {
                    const rawPhone = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone;
                    const cleanPhone = formatPhoneForWhatsApp(rawPhone);
                    const aiPitch = generateBuiltInAIPitch(lead, aiSettings);
                    const waUrl = cleanPhone ? generateWhatsAppLink(cleanPhone, null, lead, aiPitch) : null;

                    return (
                      <div 
                        key={lead.id}
                        className="bg-white border border-[#E2E8F0] hover:border-[#1E3A8A] rounded-xl p-3 shadow-xs space-y-2 transition-all hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-bold text-xs text-[#0F172A] line-clamp-1 font-sans">
                            {lead.displayName}
                          </h4>
                          <button
                            type="button"
                            onClick={() => onRemoveLead(lead.id)}
                            className="text-[#94A3B8] hover:text-[#E11D48] p-0.5 rounded"
                            title="Eliminar de CRM"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-[11px] text-[#64748B] flex items-center justify-between font-mono">
                          <span className="truncate max-w-[120px]">{lead.rubro}</span>
                          <span className="text-[#0F172A] font-semibold">{lead.city}</span>
                        </div>

                        {/* Phone / WhatsApp & AI Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9] gap-1">
                          <span className="font-mono text-[11px] font-semibold text-[#0F172A] truncate">
                            {rawPhone || 'Sin tel.'}
                          </span>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenAiModal(lead)}
                              className="px-1.5 py-1 rounded-md bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E3A8A] text-[10px] font-bold flex items-center gap-0.5 border border-[#BFDBFE] transition cursor-pointer"
                              title="Generar Pitch personalizado con IA"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                              <span>IA</span>
                            </button>

                            {waUrl ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  if ((lead.status || 'Pendiente') === 'Pendiente') {
                                    handleStatusChange(lead.id, 'Contactado');
                                  }
                                }}
                                className="px-2 py-1 rounded-md bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-bold flex items-center gap-1 shadow-xs transition"
                                title="Contactar por WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WA</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-[#94A3B8]">Sin WA</span>
                            )}
                          </div>
                        </div>

                        {/* Notes preview if present */}
                        {lead.notes && (
                          <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] text-[#475569] line-clamp-2 italic">
                            "{lead.notes}"
                          </div>
                        )}

                        {/* Follow-up Reminder row (Feature 4) */}
                        <div className="pt-1.5 border-t border-[#F1F5F9] space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-[#64748B] flex items-center gap-1 font-mono">
                              <Calendar className="w-2.5 h-2.5 text-[#1E3A8A]" />
                              <span>Seguimiento:</span>
                            </span>
                            {lead.followUpDate ? (
                              <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                                lead.followUpDate < todayStr
                                  ? 'bg-[#FFE4E6] text-[#E11D48]'
                                  : lead.followUpDate === todayStr
                                    ? 'bg-[#FEF3C7] text-[#D97706]'
                                    : 'bg-[#EFF6FF] text-[#1E3A8A]'
                              }`}>
                                {lead.followUpDate < todayStr ? '⚠️ Vencido' : lead.followUpDate === todayStr ? '🔔 Hoy' : lead.followUpDate}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={lead.followUpDate || ''}
                              onChange={(e) => handleFollowUpDateChange(lead.id, e.target.value)}
                              className="text-[10px] font-mono p-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded w-full text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                              title="Fecha para próximo contacto o seguimiento"
                            />
                            <button
                              type="button"
                              onClick={() => handleSetQuickFollowUp(lead.id, 3)}
                              className="px-1.5 py-1 text-[9px] font-mono font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded text-[#475569] shrink-0 cursor-pointer"
                              title="Agendar seguimiento en +3 días"
                            >
                              +3d
                            </button>
                          </div>
                        </div>

                        {/* Stage Progression Button */}
                        {statusCol.id !== 'Cliente cerrado 💸' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStage(lead)}
                            className="w-full py-1 px-2 rounded-lg bg-[#F1F5F9] hover:bg-[#EFF6FF] text-[#1E3A8A] text-[10px] font-bold transition flex items-center justify-center gap-1 border border-[#E2E8F0] cursor-pointer"
                            title="Avanzar a la siguiente etapa de venta"
                          >
                            <span>Avanzar etapa</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                      </div>
                    );
                  })}

                  {colLeads.length === 0 && (
                    <div className="text-center py-6 text-[11px] text-[#94A3B8] italic">
                      Sin prospectos
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: LISTA DETALLADA CON NOTAS */
        <div className="space-y-3">
          {filteredLeads.map((lead, idx) => {
            const rawPhone = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone;
            const cleanPhone = formatPhoneForWhatsApp(rawPhone);
            const phoneInfo = getPhoneType(rawPhone);

            const aiPitch = generateBuiltInAIPitch(lead, aiSettings);
            const waUrl = cleanPhone ? generateWhatsAppLink(cleanPhone, null, lead, aiPitch) : null;
            const currentStatus = lead.status || 'Pendiente';
            const statusMeta = CRM_STATUSES.find(s => s.id === currentStatus) || CRM_STATUSES[0];

            return (
              <div 
                key={lead.id}
                className="bg-white border border-[#E2E8F0] hover:border-[#1E3A8A] rounded-2xl p-5 transition-all shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5"
              >
                {/* Left: Lead Identity */}
                <div className="lg:w-2/5 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded border border-[#E2E8F0] font-bold">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                      {lead.rubro || 'Comercio'}
                    </span>
                    <span className="text-xs text-[#64748B] font-medium">• {lead.city || 'Comercial'}</span>
                    
                    {lead.classification?.type === 'NO_WEB' ? (
                      <span className="font-mono text-[10px] text-[#E11D48] bg-[#FFF1F2] px-2 py-0.5 rounded border border-[#FECDD3] font-bold">
                        SIN WEB
                      </span>
                    ) : lead.classification?.type === 'SOCIAL_ONLY' ? (
                      <span className="font-mono text-[10px] text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded border border-[#FDE68A] font-bold">
                        SOLO REDES
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[#0284C7] bg-[#F0F9FF] px-2 py-0.5 rounded border border-[#BAE6FD] font-bold">
                        CON WEB
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-[#0F172A] leading-tight font-sans">
                    {lead.displayName}
                  </h4>

                  <div className="flex items-center gap-3 text-xs text-[#64748B]">
                    <span className="flex items-center gap-1 truncate max-w-[240px]">
                      <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      <span className="truncate">{lead.formattedAddress}</span>
                    </span>
                    {lead.googleMapsUri && (
                      <a
                        href={lead.googleMapsUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1E3A8A] hover:underline inline-flex items-center gap-0.5 shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2 text-xs text-[#0F172A]">
                    <Phone className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="font-mono font-semibold">{rawPhone || 'Sin teléfono'}</span>
                    {rawPhone && (
                      <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                        phoneInfo.isMobile 
                          ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' 
                          : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                      }`}>
                        {phoneInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Center: Quick Notes */}
                <div className="lg:w-2/5 flex flex-col justify-center">
                  <div className="text-[11px] font-semibold text-[#64748B] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3 h-3 text-[#1E3A8A]" />
                      <span>Notas de seguimiento / Acuerdo comercial:</span>
                    </span>
                    {lead.lastContactAt && (
                      <span className="font-mono text-[10px] text-[#94A3B8]">
                        Contacto: {lead.lastContactAt}
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={lead.notes || ''}
                    onChange={(e) => handleNoteChange(lead.id, e.target.value)}
                    placeholder="Ej: Le interesó una web de 3 secciones. Coordinar llamada el jueves..."
                    className="w-full text-xs p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]/20 resize-none transition"
                  />

                  {/* Follow-up Reminder row (Feature 4) */}
                  <div className="mt-2 pt-2 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#64748B]">
                      <Calendar className="w-3.5 h-3.5 text-[#1E3A8A]" />
                      <span>Recordatorio:</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {lead.followUpDate && (
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          lead.followUpDate < todayStr
                            ? 'bg-[#FFE4E6] text-[#E11D48] border border-[#FECDD3]'
                            : lead.followUpDate === todayStr
                              ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                              : 'bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]'
                        }`}>
                          {lead.followUpDate < todayStr ? '⚠️ Vencido' : lead.followUpDate === todayStr ? '🔔 Hoy' : lead.followUpDate}
                        </span>
                      )}

                      <input
                        type="date"
                        value={lead.followUpDate || ''}
                        onChange={(e) => handleFollowUpDateChange(lead.id, e.target.value)}
                        className="text-xs font-mono p-1 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                        title="Fecha para próximo contacto o seguimiento"
                      />

                      <button
                        type="button"
                        onClick={() => handleSetQuickFollowUp(lead.id, 3)}
                        className="px-2 py-1 text-[10px] font-mono font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] rounded-lg text-[#475569] cursor-pointer"
                        title="Agendar seguimiento en +3 días"
                      >
                        +3d
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetQuickFollowUp(lead.id, 7)}
                        className="px-2 py-1 text-[10px] font-mono font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] rounded-lg text-[#475569] cursor-pointer"
                        title="Agendar seguimiento en +7 días"
                      >
                        +7d
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Status Dropdown & WhatsApp Action */}
                <div className="lg:w-1/5 flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end justify-center gap-2.5">
                  
                  {/* Status Dropdown */}
                  <div className="w-full">
                    <label className="font-mono text-[10px] uppercase font-bold text-[#94A3B8] mb-1 block text-left lg:text-right">
                      ESTADO PIPELINE:
                    </label>
                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`w-full text-xs font-semibold px-3 py-2 rounded-xl border focus:outline-none cursor-pointer transition ${statusMeta.color}`}
                    >
                      {CRM_STATUSES.map(s => (
                        <option key={s.id} value={s.id} className="bg-white text-[#0F172A]">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions: Pitch IA, WhatsApp (Emerald) + Delete */}
                  <div className="flex items-center gap-2 w-full pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenAiModal(lead)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E3A8A] border border-[#BFDBFE] transition shadow-2xs cursor-pointer active:scale-95"
                      title="Generar propuesta personalizada con IA"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pitch IA</span>
                    </button>

                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (currentStatus === 'Pendiente') {
                            handleStatusChange(lead.id, 'Contactado');
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-[#059669] hover:bg-[#047857] text-white transition shadow-xs active:scale-95"
                        title="Enviar propuesta personalizada por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    ) : (
                      <button
                        disabled
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed text-center"
                      >
                        Sin WhatsApp
                      </button>
                    )}

                    <button
                      onClick={() => onRemoveLead(lead.id)}
                      className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#FFF1F2] text-[#94A3B8] hover:text-[#E11D48] border border-[#CBD5E1] hover:border-[#FECDD3] transition cursor-pointer"
                      title="Eliminar del CRM"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Propuesta con IA para CRM */}
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
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition cursor-pointer"
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
                    rows={7}
                    value={aiPitchText}
                    onChange={(e) => setAiPitchText(e.target.value)}
                    className="w-full text-xs text-[#0F172A] leading-relaxed p-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] resize-none font-sans"
                    placeholder="El mensaje generado por IA aparecerá acá..."
                  />
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#F1F5F9] bg-[#F8FAFC]">
              <button
                type="button"
                onClick={handleCopyAiPitch}
                className="px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedAi ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                <span>{copiedAi ? 'Copiado' : 'Copiar Texto'}</span>
              </button>

              {(() => {
                const aiRaw = selectedLeadForAi.nationalPhoneNumber || selectedLeadForAi.internationalPhoneNumber || selectedLeadForAi.phone;
                const aiClean = formatPhoneForWhatsApp(aiRaw);
                const aiWa = aiClean && aiPitchText ? generateWhatsAppLink(aiClean, null, selectedLeadForAi, aiPitchText) : null;

                return aiWa ? (
                  <a
                    href={aiWa}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if ((selectedLeadForAi.status || 'Pendiente') === 'Pendiente') {
                        handleStatusChange(selectedLeadForAi.id, 'Contactado');
                      }
                      setSelectedLeadForAi(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar por WhatsApp</span>
                  </a>
                ) : (
                  <span className="text-xs text-[#94A3B8] italic">Sin número WhatsApp</span>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
