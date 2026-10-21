import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from './components/Navbar';
import SearchPanel from './components/SearchPanel';
import LeadCard from './components/LeadCard';
import LeadTableView from './components/LeadTableView';
import CrmDashboard from './components/CrmDashboard';
import SettingsModal from './components/SettingsModal';
import WhatsAppAutomationModal from './components/WhatsAppAutomationModal';
import ScraperLoadingIndicator from './components/ScraperLoadingIndicator';
import { useLocalStorage } from './hooks/useLocalStorage';
import { generateBatchPitches } from './services/aiPitchService';
import { 
  searchPlaces, 
  loadMorePlaces,
  checkScraperServerStatus,
  fetchBackendCrmLeads,
  saveBackendCrmLead,
  saveBackendCrmLeadsBulk,
  deleteBackendCrmLead,
  fetchContactedHistory,
  recordContactedLead
} from './services/placesApi';
import { checkIsContacted, createContactedRecord } from './utils/contactedHelper';
import { 
  WHATSAPP_TEMPLATES, 
  formatPhoneForWhatsApp,
  getPhoneType
} from './utils/whatsappHelper';
import { 
  Search, 
  CheckCircle, 
  AlertCircle, 
  BookmarkCheck,
  FileSpreadsheet,
  LayoutGrid,
  List,
  ArrowUpDown,
  Phone,
  Sparkles,
  ArrowRight,
  Bot,
  Loader2,
  ShieldCheck
} from 'lucide-react';

export default function App() {
  // Navigation & Modal state
  const [currentTab, setCurrentTab] = useState('explorer'); // 'explorer' | 'crm'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persistent user configuration
  const [apiKey, setApiKey] = useLocalStorage('leadradar_api_key', '');
  const [searchMode, setSearchMode] = useLocalStorage('leadradar_search_mode', 'scraper'); // 'scraper' | 'api'
  const [crmLeads, setCrmLeads] = useLocalStorage('leadradar_crm_leads', []);
  const [contactedHistory, setContactedHistory] = useLocalStorage('leadradar_contacted_history', []);
  const [hideAlreadyContacted, setHideAlreadyContacted] = useState(false);
  const [waTemplates, setWaTemplates] = useLocalStorage('leadradar_wa_templates', WHATSAPP_TEMPLATES);
  const [aiSettings, setAiSettings] = useLocalStorage('leadradar_ai_settings', {
    provider: 'builtin', // 'builtin' | 'groq' | 'gemini' | 'deepseek' | 'openai'
    groqApiKey: '',
    groqModel: 'llama-3.1-8b-instant',
    deepseekApiKey: '',
    geminiApiKey: '',
    openaiApiKey: '',
    senderName: '',
    agencyName: '',
    customOffer: 'Sitios web modernos, ultra rápidos y con botón directo a WhatsApp'
  });

  // Auto-migrate decommissioned or restricted Groq models from user's localStorage
  useEffect(() => {
    if (aiSettings?.groqModel === 'deepseek-r1-distill-llama-70b' || aiSettings?.groqModel?.includes('deepseek-r1-distill') || aiSettings?.groqModel === 'llama-3.3-70b-versatile') {
      setAiSettings(prev => ({
        ...prev,
        groqModel: 'llama-3.1-8b-instant'
      }));
    }
  }, [aiSettings?.groqModel, setAiSettings]);

  // Server health state
  const [serverOnline, setServerOnline] = useState(true);

  // Search Explorer state
  const [selectedProvince, setSelectedProvince] = useState('Buenos Aires');
  const [selectedCity, setSelectedCity] = useState('La Plata');
  const [selectedRubro, setSelectedRubro] = useState('Ferreterías y Corralones');
  const [freeQuery, setFreeQuery] = useState('');

  // Real-time Filters
  const [onlyNoWebOrSocial, setOnlyNoWebOrSocial] = useState(true);
  const [minReviews, setMinReviews] = useState(0);
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState('all'); // 'all' | 'whatsapp' | 'landline' | 'has_phone'

  // Results display controls
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const [resultsSortBy, setResultsSortBy] = useState('opportunities_first'); // 'opportunities_first' | 'reviews_desc' | 'rating_desc' | 'name_asc'
  const [resultsViewMode, setResultsViewMode] = useState('grid'); // 'grid' | 'table'

  // Search execution state
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [recentSearches, setRecentSearches] = useLocalStorage('getweb_recent_searches', []);
  const [isWhatsAppAutoOpen, setIsWhatsAppAutoOpen] = useState(false);
  const [isBatchPitchGenerating, setIsBatchPitchGenerating] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Perform search
  const performSearch = useCallback(async (overrideMode) => {
    setIsSearching(true);
    setSearchError(null);

    const activeMode = overrideMode || searchMode;

    const res = await searchPlaces({
      provincia: selectedProvince,
      ciudad: selectedCity,
      rubro: selectedRubro,
      freeQuery: freeQuery.trim(),
      apiKey,
      searchMode: activeMode
    });

    setIsSearching(false);

    if (res.success) {
      setSearchResults(res.data);
      if (res.data.length === 0) {
        setSearchError('No se encontraron negocios con esos criterios en la zona seleccionada.');
      } else {
        // Record into recent searches history (Feature 5)
        const label = freeQuery.trim() ? freeQuery.trim() : `${selectedRubro} en ${selectedCity}`;
        const newEntry = {
          type: freeQuery.trim() ? 'free' : 'guided',
          label,
          prov: selectedProvince,
          city: selectedCity,
          rubro: selectedRubro,
          query: freeQuery.trim(),
          timestamp: Date.now()
        };
        setRecentSearches(prev => {
          const list = (prev || []).filter(item => item.label !== label);
          return [newEntry, ...list].slice(0, 6);
        });

        // Automatically pre-generate personalized outreach pitch messages in batch
        // Zero emojis, professional human tone, avoids "En [Nombre]"
        setIsBatchPitchGenerating(true);
        generateBatchPitches(res.data, aiSettings, ({ lead }) => {
          setSearchResults(prev => prev.map(l => l.id === lead.id ? { ...l, ...lead } : l));
        }).then(updated => {
          setSearchResults(updated);
          setIsBatchPitchGenerating(false);
        }).catch(err => {
          console.error('Error generando pitches en lote:', err);
          setIsBatchPitchGenerating(false);
        });
      }
    } else {
      setSearchError(res.error || 'Error al realizar la búsqueda.');
      setSearchResults([]);
    }
  }, [selectedProvince, selectedCity, selectedRubro, freeQuery, apiKey, searchMode, setRecentSearches, aiSettings]);

  // Restore parameters from recent search chip
  const handleApplyRecentSearch = (item) => {
    if (item.type === 'free') {
      setFreeQuery(item.query || item.label);
    } else {
      if (item.prov) setSelectedProvince(item.prov);
      if (item.city) setSelectedCity(item.city);
      if (item.rubro) setSelectedRubro(item.rubro);
      setFreeQuery('');
    }
    showToast(`Búsqueda restaurada: ${item.label}`, 'info');
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    showToast('Historial de búsquedas recientes borrado.', 'info');
  };

  // Load More Places in current area (Feature 1)
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const res = await loadMorePlaces({
        provincia: selectedProvince,
        ciudad: selectedCity,
        rubro: selectedRubro,
        freeQuery: freeQuery.trim(),
        currentCount: searchResults.length,
        searchMode
      });

      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        // Deduplicate against existing searchResults
        const existingNames = new Set(searchResults.map(l => (l.displayName || '').toLowerCase().trim()));
        const newLeads = res.data.filter(l => !existingNames.has((l.displayName || '').toLowerCase().trim()));

        if (newLeads.length > 0) {
          setSearchResults(prev => [...prev, ...newLeads]);
          showToast(`¡Se cargaron ${newLeads.length} nuevos prospectos en esta zona!`, 'success');
          // Auto generate pitches for newly loaded leads in background
          generateBatchPitches(newLeads, aiSettings, ({ lead }) => {
            setSearchResults(prev => prev.map(l => l.id === lead.id ? { ...l, ...lead } : l));
          });
        } else {
          showToast('Todos los prospectos encontrados ya están en pantalla.', 'info');
        }
      } else {
        showToast(res.error || 'No se encontraron más prospectos adicionales.', 'info');
      }
    } catch (err) {
      console.error('Error cargando más prospectos:', err);
      showToast('Error al escanear más comercios.', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Initial check on mount: check server status, sync backend CRM leads, and run initial search
  useEffect(() => {
    let isMounted = true;

    checkScraperServerStatus().then(online => {
      if (!isMounted) return;
      setServerOnline(online);
      
      if (online) {
        // Fetch backend CRM leads once cleanly on mount
        fetchBackendCrmLeads().then(backendLeads => {
          if (!isMounted) return;
          if (Array.isArray(backendLeads) && backendLeads.length > 0) {
            setCrmLeads(prev => {
              const map = new Map(backendLeads.map(l => [l.id, l]));
              for (const l of prev) {
                if (!map.has(l.id)) map.set(l.id, l);
              }
              return Array.from(map.values());
            });
          }
        });

        // Fetch permanent contacted history on mount
        fetchContactedHistory().then(backendContacted => {
          if (!isMounted) return;
          if (Array.isArray(backendContacted) && backendContacted.length > 0) {
            setContactedHistory(prev => {
              const map = new Map(backendContacted.map(item => [item.id, item]));
              for (const item of (prev || [])) {
                if (!map.has(item.id)) map.set(item.id, item);
              }
              return Array.from(map.values());
            });
          }
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [setCrmLeads, setContactedHistory]); // Run on initial mount

  // Filtered and sorted search results
  const filteredResults = useMemo(() => {
    let list = searchResults.filter(lead => {
      if (onlyNoWebOrSocial) {
        if (lead.classification?.type === 'HAS_WEB') return false;
      }
      if (minReviews > 0) {
        if ((lead.userRatingCount || 0) < minReviews) return false;
      }

      // Hide already contacted businesses if toggle active
      if (hideAlreadyContacted) {
        const check = checkIsContacted(lead, contactedHistory);
        if (check.isContacted) return false;
      }

      // Filter by phone type / WhatsApp / Landline
      const phoneVal = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone;
      if (phoneFilter === 'whatsapp') {
        if (!phoneVal) return false;
        const phoneInfo = getPhoneType(phoneVal);
        if (!phoneInfo.isMobile) return false;
      } else if (phoneFilter === 'landline') {
        if (!phoneVal) return false;
        const phoneInfo = getPhoneType(phoneVal);
        if (phoneInfo.isMobile) return false;
      } else if (phoneFilter === 'has_phone' || onlyWithPhone) {
        if (!phoneVal) return false;
      }

      if (resultsSearchQuery.trim()) {
        const q = resultsSearchQuery.toLowerCase();
        const matchesName = lead.displayName?.toLowerCase().includes(q);
        const matchesAddress = lead.formattedAddress?.toLowerCase().includes(q);
        const matchesRubro = lead.rubro?.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesRubro) return false;
      }
      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      if (resultsSortBy === 'opportunities_first') {
        const priorityOrder = { 'NO_WEB': 1, 'SOCIAL_ONLY': 2, 'HAS_WEB': 3 };
        const orderA = priorityOrder[a.classification?.type] || 4;
        const orderB = priorityOrder[b.classification?.type] || 4;
        return orderA - orderB;
      }
      if (resultsSortBy === 'reviews_desc') {
        return (b.userRatingCount || 0) - (a.userRatingCount || 0);
      }
      if (resultsSortBy === 'rating_desc') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (resultsSortBy === 'name_asc') {
        return (a.displayName || '').localeCompare(b.displayName || '');
      }
      return 0;
    });

    return list;
  }, [searchResults, onlyNoWebOrSocial, minReviews, onlyWithPhone, phoneFilter, hideAlreadyContacted, contactedHistory, resultsSearchQuery, resultsSortBy]);

  // Count of previously contacted businesses found in current search results
  const contactedInResultsCount = useMemo(() => {
    return searchResults.filter(l => checkIsContacted(l, contactedHistory).isContacted).length;
  }, [searchResults, contactedHistory]);

  // Lead CRM Operations with dual persistence (localStorage + backend JSON)
  const handleSaveLead = (lead) => {
    const exists = crmLeads.some(item => item.id === lead.id);
    if (!exists) {
      const newLead = {
        ...lead,
        status: 'Pendiente',
        notes: '',
        savedAt: new Date().toLocaleDateString('es-AR')
      };
      setCrmLeads([newLead, ...crmLeads]);
      saveBackendCrmLead(newLead);
      showToast(`¡"${lead.displayName}" guardado en tu CRM!`, 'success');
    }
  };

  // Bulk save all filtered leads to CRM
  const handleSaveAllLeads = () => {
    if (filteredResults.length === 0) return;
    const existingIds = new Set(crmLeads.map(l => l.id));
    const toAdd = filteredResults
      .filter(l => !existingIds.has(l.id))
      .map(lead => ({
        ...lead,
        status: 'Pendiente',
        notes: '',
        savedAt: new Date().toLocaleDateString('es-AR')
      }));

    if (toAdd.length === 0) {
      showToast('Todos los prospectos visibles ya están en tu CRM.', 'info');
      return;
    }

    const updated = [...toAdd, ...crmLeads];
    setCrmLeads(updated);
    saveBackendCrmLeadsBulk(toAdd);
    showToast(`¡${toAdd.length} nuevos prospectos guardados en el CRM!`, 'success');
  };

  // Export search results directly to CSV
  const exportSearchResultsToCSV = () => {
    if (filteredResults.length === 0) return;

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
      "Enlace Google Maps"
    ];

    const rows = filteredResults.map(l => [
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
      `"${l.googleMapsUri || l.maps_url || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `getweb_prospectos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemoveLead = useCallback((leadId) => {
    setCrmLeads(prev => prev.filter(item => item.id !== leadId));
    deleteBackendCrmLead(leadId);
    showToast(`Prospecto removido del CRM.`, 'info');
  }, [setCrmLeads]);

  const handleUpdateLead = useCallback((leadId, updates) => {
    // Update in searchResults if present
    setSearchResults(prev => prev.map(item => item.id === leadId ? { ...item, ...updates } : item));

    // Update in crmLeads or add if not already in crmLeads
    setCrmLeads(prev => {
      const exists = prev.some(item => item.id === leadId);
      if (exists) {
        return prev.map(item => {
          if (item.id === leadId) {
            const updated = { ...item, ...updates };
            saveBackendCrmLead(updated);
            return updated;
          }
          return item;
        });
      } else {
        const leadFromSearch = searchResults.find(l => l.id === leadId);
        if (leadFromSearch) {
          const newLead = {
            ...leadFromSearch,
            ...updates,
            savedAt: new Date().toLocaleDateString('es-AR')
          };
          saveBackendCrmLead(newLead);
          return [newLead, ...prev];
        }
        return prev;
      }
    });
  }, [searchResults, setCrmLeads]);

  // Permanent contacted registration handler (survives CRM resets, saved forever on server disk)
  const handleMarkAsContacted = useCallback((lead, pitch = '', method = 'manual_whatsapp') => {
    if (!lead) return;
    const record = createContactedRecord(lead, {
      contactMethod: method,
      messageSnippet: pitch ? pitch.slice(0, 160) : ''
    });

    setContactedHistory(prev => {
      const existingIdx = (prev || []).findIndex(item => item.id === record.id || (item.cleanPhone && item.cleanPhone === record.cleanPhone));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], ...record, contactCount: (copy[existingIdx].contactCount || 1) + 1 };
        return copy;
      }
      return [record, ...(prev || [])];
    });

    // Persist permanently on server disk
    recordContactedLead(lead, {
      contactMethod: method,
      messageSnippet: pitch ? pitch.slice(0, 160) : ''
    }).catch(err => console.error('Error saving contacted lead on server:', err));

    // Also update lead status in CRM if present
    handleUpdateLead(lead.id, {
      status: 'Contactado',
      lastContactAt: new Date().toISOString()
    });
  }, [setContactedHistory, handleUpdateLead]);

  const handleImportLeads = (incomingLeads) => {
    if (!Array.isArray(incomingLeads) || incomingLeads.length === 0) return;
    const currentMap = new Map(crmLeads.map(l => [l.id, l]));
    let countAdded = 0;
    for (const lead of incomingLeads) {
      if (lead && lead.id) {
        if (!currentMap.has(lead.id)) countAdded++;
        currentMap.set(lead.id, { ...(currentMap.get(lead.id) || {}), ...lead });
      }
    }
    const merged = Array.from(currentMap.values());
    setCrmLeads(merged);
    saveBackendCrmLeadsBulk(merged);
    showToast(`¡Copia de seguridad restaurada! (${countAdded} nuevos prospectos)`, 'success');
  };

  // Stats calculation
  const sinWebCount = searchResults.filter(l => l.classification?.type === 'NO_WEB').length;
  const soloRedesCount = searchResults.filter(l => l.classification?.type === 'SOCIAL_ONLY').length;
  const conWebCount = searchResults.filter(l => l.classification?.type === 'HAS_WEB').length;

  // Qualified leads for automated WhatsApp dispatch: NO_WEB or SOCIAL_ONLY with phone
  const qualifiedAutoCount = useMemo(() => {
    return filteredResults.filter(l => {
      const type = l.classification?.type;
      const hasPhone = Boolean(l.nationalPhoneNumber || l.internationalPhoneNumber || l.phone);
      return (type === 'NO_WEB' || type === 'SOCIAL_ONLY') && hasPhone;
    }).length;
  }, [filteredResults]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#1E3A8A] selection:text-white">
      
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-[#E2E8F0] shadow-xl text-xs font-semibold text-[#0F172A]">
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-[#059669]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#1E3A8A]" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Primary Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        crmLeads={crmLeads}
        onOpenSettings={() => setIsSettingsOpen(true)}
        searchMode={searchMode}
        serverOnline={serverOnline}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        
        {/* TAB 1: RADAR EXPLORER */}
        {currentTab === 'explorer' && (
          <div className="space-y-6">
            
            {/* Hero & Onboarding 3-Step Pipeline Guide */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white via-white to-[#EFF6FF] border border-[#E2E8F0] shadow-sm relative overflow-hidden">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-mono font-bold text-[#1E3A8A] mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#1E3A8A] animate-pulse" />
                  <span>MOTOR DE PROSPECCIÓN B2B INTELIGENTE</span>
                </div>
                
                <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight font-sans leading-tight">
                  Encontrá comercios y empresas <br className="hidden sm:inline" />
                  <span className="text-[#1E3A8A] underline decoration-[#10B981] decoration-wavy decoration-2">
                    sin página web oficial o solo con redes.
                  </span>
                </h1>
                
                <p className="mt-3 text-xs sm:text-sm text-[#64748B] leading-relaxed max-w-2xl">
                  Rastreá Google Maps en tiempo real con Chromium Puppeteer. Detectá qué comercios no tienen presencia web propia, dispará propuestas de desarrollo web directas a WhatsApp y gestioná tus ventas en el CRM.
                </p>
              </div>

              {/* 3 Step Visual Workflow Stepper */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-6 border-t border-[#E2E8F0]/70">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-[#E2E8F0]">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1E3A8A] flex items-center justify-center font-bold text-xs shrink-0">
                    01
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-[#0F172A]">Elegí Zona y Rubro</h2>
                    <p className="text-[11px] text-[#64748B]">Búsqueda guiada en Argentina o libre</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-[#E2E8F0]">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] text-[#E11D48] flex items-center justify-center font-bold text-xs shrink-0">
                    02
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-[#0F172A]">Filtrá Oportunidades</h2>
                    <p className="text-[11px] text-[#64748B]">Negocios sin web o que usan Instagram</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-[#E2E8F0]">
                  <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-bold text-xs shrink-0">
                    03
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-[#0F172A]">Contactá por WhatsApp</h2>
                    <p className="text-[11px] text-[#64748B]">Pitch automático y guardado en CRM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Configuration Panel */}
            <SearchPanel
              selectedProvince={selectedProvince}
              setSelectedProvince={setSelectedProvince}
              selectedCity={selectedCity}
              setSelectedCity={setSelectedCity}
              selectedRubro={selectedRubro}
              setSelectedRubro={setSelectedRubro}
              freeQuery={freeQuery}
              setFreeQuery={setFreeQuery}
              onlyNoWebOrSocial={onlyNoWebOrSocial}
              setOnlyNoWebOrSocial={setOnlyNoWebOrSocial}
              minReviews={minReviews}
              setMinReviews={setMinReviews}
              onlyWithPhone={onlyWithPhone}
              setOnlyWithPhone={setOnlyWithPhone}
              phoneFilter={phoneFilter}
              setPhoneFilter={setPhoneFilter}
              recentSearches={recentSearches}
              onApplyRecentSearch={handleApplyRecentSearch}
              onClearRecentSearches={handleClearRecentSearches}
              onSearch={performSearch}
              isSearching={isSearching}
              searchMode={searchMode}
              setSearchMode={setSearchMode}
              serverOnline={serverOnline}
            />

            {/* Scraper Progress Indicator HUD */}
            <ScraperLoadingIndicator
              isSearching={isSearching}
              searchMode={searchMode}
              targetQuery={freeQuery.trim() || `${selectedRubro} en ${selectedCity}, ${selectedProvince}`}
            />

            {/* Error Message if search fails */}
            {searchError && (
              <div className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-xs text-[#E11D48] flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              </div>
            )}

            {/* Empty State / Initial Hero when no search performed yet */}
            {searchResults.length === 0 && !isSearching ? (
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-8 sm:p-12 shadow-sm text-center">
                <div className="max-w-2xl mx-auto space-y-6">
                  
                  {/* Radar Pulse Icon */}
                  <div className="relative inline-flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#1E3A8A]">
                      <Search className="w-8 h-8" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-[#10B981]"></span>
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                      Radar Listo para Escanear Comercios Reales
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                      Configurá la provincia, ciudad y rubro en el panel superior y hacé clic en <strong>"ESCANEAR GOOGLE MAPS"</strong> para rastrear negocios reales, detectar quiénes no tienen sitio web propio y redactar propuestas comerciales personalizadas.
                    </p>
                  </div>

                  {/* Backend Status Card */}
                  <div className={`p-4 rounded-2xl border text-left flex items-start gap-3 ${
                    serverOnline 
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]' 
                      : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                  }`}>
                    {serverOnline ? (
                      <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs space-y-1">
                      <p className="font-bold">
                        {serverOnline ? 'Servidor Scraper Puppeteer Conectado (Puerto 3001)' : 'Servidor Scraper No Detectado'}
                      </p>
                      <p className="text-[11px] opacity-90">
                        {serverOnline 
                          ? 'El motor Chromium en segundo plano está listo para navegar Google Maps en tiempo real y extraer números de teléfono directos.'
                          : 'Para escanear comercios reales con Puppeteer, abrí una terminal y ejecutá: node server/server.js. También podés configurar una clave oficial de Google Places API en Configuración.'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <p className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">
                      O probá un escaneo rápido sugerido:
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {[
                        { prov: 'Buenos Aires', city: 'La Plata', rubro: 'Ferreterías y Corralones' },
                        { prov: 'Córdoba', city: 'Córdoba', rubro: 'Odontólogos y Clínicas Dentales' },
                        { prov: 'Santa Fe', city: 'Rosario', rubro: 'Restaurantes y Bares' },
                        { prov: 'Buenos Aires', city: 'Mar del Plata', rubro: 'Inmobiliarias' }
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            setSelectedProvince(preset.prov);
                            setSelectedCity(preset.city);
                            setSelectedRubro(preset.rubro);
                            setFreeQuery('');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#CBD5E1] hover:border-[#93C5FD] text-[#1E3A8A] text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>{preset.rubro.split(' ')[0]} en {preset.city}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Link to CRM if already has leads */}
                  {crmLeads.length > 0 && (
                    <div className="pt-4 border-t border-[#E2E8F0]">
                      <button
                        type="button"
                        onClick={() => setCurrentTab('crm')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-[#1E3A8A] hover:underline cursor-pointer"
                      >
                        <BookmarkCheck className="w-4 h-4" />
                        <span>Ya tenés {crmLeads.length} prospectos en tu CRM. Ir al Pipeline de Ventas</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <>
                {/* Live Results Controls & Header Toolbar */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                  
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Left: Results Title & Counts */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight font-sans">
                          Oportunidades Detectadas
                        </h2>
                        <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE] font-bold">
                          [{String(filteredResults.length).padStart(2, '0')}]
                        </span>
                      </div>

                      {/* Summary Badges */}
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                        <span className="px-2 py-0.5 rounded-full bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
                          <span>{sinWebCount} SIN WEB</span>
                        </span>
                        
                        <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                          <span>{soloRedesCount} SOLO REDES</span>
                        </span>

                        <span className="px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
                          <span>{conWebCount} CON WEB</span>
                        </span>

                        {/* Hide Already Contacted Toggle Badge */}
                        {contactedHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setHideAlreadyContacted(prev => !prev)}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                              hideAlreadyContacted
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold shadow-2xs'
                                : 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1] hover:bg-[#E2E8F0]'
                            }`}
                            title={hideAlreadyContacted ? "Mostrando solo negocios NUNCA contactados. Clic para ver todos." : "Ocultar negocios que ya recibieron mensaje"}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {hideAlreadyContacted ? 'Ocultando ya contactados' : `Ocultar contactados (${contactedInResultsCount})`}
                            </span>
                          </button>
                        )}

                        {/* Batch pitch generation progress badge */}
                        {isBatchPitchGenerating && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                            <span>Redactando mensajes (0 emojis)...</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Bulk Actions */}
                    {filteredResults.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Bot WhatsApp Automático button */}
                        <button
                          onClick={() => setIsWhatsAppAutoOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition text-xs cursor-pointer shadow-xs active:scale-95"
                          title="Lanzar bot autónomo con Puppeteer para enviar mensajes a prospectos sin web o solo redes con teléfono"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Envío Automático ({qualifiedAutoCount})</span>
                        </button>

                        <button
                          onClick={handleSaveAllLeads}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E3A8A] border border-[#BFDBFE] font-bold transition text-xs cursor-pointer shadow-xs"
                          title="Guardar todos los resultados visibles en el CRM"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          <span>Guardar Todos en CRM</span>
                        </button>

                        <button
                          onClick={exportSearchResultsToCSV}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] font-bold transition text-xs cursor-pointer shadow-xs"
                          title="Descargar lista de prospectos en formato CSV / Excel"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#059669]" />
                          <span>Exportar CSV</span>
                        </button>
                      </div>
                    )}

                  </div>

                  {/* Sub-toolbar: In-results Search, Sorter and View Toggle */}
                  <div className="pt-3 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    
                    {/* Search within extracted leads */}
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      <input
                        type="text"
                        value={resultsSearchQuery}
                        onChange={(e) => setResultsSearchQuery(e.target.value)}
                        placeholder="Filtrar por nombre o dirección en estos resultados..."
                        className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] transition"
                      />
                    </div>

                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      
                      {/* Phone Type Filter Dropdown */}
                      <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-2.5 py-1.5 text-xs">
                        <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                        <select
                          value={phoneFilter}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPhoneFilter(val);
                            setOnlyWithPhone(val !== 'all');
                          }}
                          className="bg-transparent text-[#0F172A] focus:outline-none text-xs font-semibold cursor-pointer"
                          aria-label="Filtrar por tipo de teléfono"
                        >
                          <option value="all">📞 Teléfono: Todos</option>
                          <option value="whatsapp">📱 Solo Celular / WhatsApp</option>
                          <option value="landline">☎️ Solo Teléfono Fijo</option>
                          <option value="has_phone">✔️ Con Teléfono</option>
                        </select>
                      </div>

                      {/* Sorter Dropdown */}
                      <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-2.5 py-1.5 text-xs">
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#64748B]" />
                        <select
                          value={resultsSortBy}
                          onChange={(e) => setResultsSortBy(e.target.value)}
                          className="bg-transparent text-[#0F172A] focus:outline-none text-xs font-semibold cursor-pointer"
                        >
                          <option value="opportunities_first">Oportunidades primero (Sin Web)</option>
                          <option value="reviews_desc">Más reseñas (+ a -)</option>
                          <option value="rating_desc">Mejor calificación</option>
                          <option value="name_asc">Nombre (A - Z)</option>
                        </select>
                      </div>

                      {/* View Switch: Grid vs Table */}
                      <div className="flex items-center p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
                        <button
                          type="button"
                          onClick={() => setResultsViewMode('grid')}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            resultsViewMode === 'grid' 
                              ? 'bg-white text-[#1E3A8A] shadow-xs' 
                              : 'text-[#64748B] hover:text-[#0F172A]'
                          }`}
                          title="Vista Cuadrícula de Tarjetas"
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultsViewMode('table')}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            resultsViewMode === 'table' 
                              ? 'bg-white text-[#1E3A8A] shadow-xs' 
                              : 'text-[#64748B] hover:text-[#0F172A]'
                          }`}
                          title="Vista Tabla Compacta"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>

                  </div>

                </div>

                {/* Results Display Area */}
                {filteredResults.length === 0 ? (
                  <div className="text-center py-16 px-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mx-auto text-[#1E3A8A] mb-3">
                      <Search className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-[#0F172A] mb-1 font-sans">
                      No hay resultados con los filtros actuales
                    </h3>
                    <p className="text-xs text-[#64748B] max-w-sm mx-auto mb-4 leading-relaxed">
                      Probá desactivando "Solo Oportunidades", reduciendo el mínimo de reseñas o buscando en otra localidad.
                    </p>
                    <button
                      onClick={() => {
                        setOnlyNoWebOrSocial(false);
                        setMinReviews(0);
                        setOnlyWithPhone(false);
                        setPhoneFilter('all');
                        setResultsSearchQuery('');
                      }}
                      className="px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold border border-[#CBD5E1] transition cursor-pointer shadow-xs"
                    >
                      Desactivar filtros restrictivos
                    </button>
                  </div>
                ) : resultsViewMode === 'table' ? (
                  <LeadTableView
                    leads={filteredResults}
                    crmLeads={crmLeads}
                    contactedHistory={contactedHistory}
                    onMarkContacted={handleMarkAsContacted}
                    onSaveLead={handleSaveLead}
                    onRemoveLead={handleRemoveLead}
                    waTemplates={waTemplates}
                    aiSettings={aiSettings}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredResults.map((lead, idx) => {
                      const isSaved = crmLeads.some(item => item.id === lead.id);
                      const contactInfo = checkIsContacted(lead, contactedHistory);
                      return (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          index={idx}
                          isSaved={isSaved}
                          isAlreadyContacted={contactInfo.isContacted}
                          contactedRecord={contactInfo.record}
                          onMarkContacted={handleMarkAsContacted}
                          onSaveLead={handleSaveLead}
                          onRemoveLead={handleRemoveLead}
                          onUpdateLead={handleUpdateLead}
                          waTemplates={waTemplates}
                          aiSettings={aiSettings}
                          onOpenSettings={() => setIsSettingsOpen(true)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Load More Places Button (Feature 1) */}
            {searchResults.length > 0 && (
              <div className="pt-6 pb-2 text-center animate-fade-in">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-[#F8FAFC] border-2 border-[#1E3A8A] text-[#1E3A8A] hover:border-[#172554] hover:text-[#172554] text-xs font-bold transition shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 active:scale-98 font-sans uppercase tracking-wider"
                  title="Buscar más comercios en Google Maps para esta ubicación"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#1E3A8A]/30 border-t-[#1E3A8A] rounded-full animate-spin" />
                      <span>Escaneando más comercios...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Escanear Más Prospectos en esta Zona (+15 / +30)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-[#64748B] mt-2 font-mono">
                  Mostrando {searchResults.length} prospectos escaneados en esta sesión
                </p>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: CRM DASHBOARD */}
        {currentTab === 'crm' && (
          <CrmDashboard
            leads={crmLeads}
            contactedHistory={contactedHistory}
            onUpdateLead={handleUpdateLead}
            onRemoveLead={handleRemoveLead}
            onImportLeads={handleImportLeads}
            waTemplates={waTemplates}
            aiSettings={aiSettings}
            onSwitchToExplorer={() => setCurrentTab('explorer')}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6 text-xs text-[#94A3B8] text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[11px]">
            GETWEB // ENGINE &copy; 2026 — SISTEMA DE PROSPECCIÓN COMERCIAL B2B & MINI CRM
          </p>
          <div className="flex items-center gap-3 font-mono text-[11px] text-[#64748B]">
            <span>ARGENTINA & GLOBAL</span>
            <span>•</span>
            <span>PUPPETEER ENGINE</span>
            <span>•</span>
            <span>GOOGLE MAPS DATA</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        apiKey={apiKey}
        setApiKey={setApiKey}
        waTemplates={waTemplates}
        setWaTemplates={setWaTemplates}
        aiSettings={aiSettings}
        setAiSettings={setAiSettings}
      />

      {/* WhatsApp Automation Modal (Puppeteer Auto Dispatch) */}
      <WhatsAppAutomationModal
        isOpen={isWhatsAppAutoOpen}
        onClose={() => setIsWhatsAppAutoOpen(false)}
        leads={filteredResults}
        contactedHistory={contactedHistory}
        onRefreshContacted={() => {
          fetchContactedHistory().then(list => {
            if (Array.isArray(list)) setContactedHistory(list);
          });
        }}
        onUpdateLead={handleUpdateLead}
      />

    </div>
  );
}
