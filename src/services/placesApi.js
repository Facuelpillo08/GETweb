const BACKEND_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  || (typeof window !== 'undefined' && window.location.port !== '5173' ? window.location.origin : 'http://localhost:3001');

/**
 * Known social and aggregator domain keywords
 */
const SOCIAL_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'linktr.ee',
  'wa.me',
  'api.whatsapp.com',
  'pedix.app',
  'cafecito.app',
  'tiktok.com',
  'm.facebook.com'
];

/**
 * Classify a business website status based on websiteUri
 * @param {string|null} websiteUri
 * @returns {{ type: 'NO_WEB'|'SOCIAL_ONLY'|'HAS_WEB', label: string, color: string, badgeBg: string, badgeBorder: string, badgeText: string, priority: string, priorityLevel: number }}
 */
export function classifyWebsite(websiteUri) {
  if (!websiteUri || typeof websiteUri !== 'string' || websiteUri.trim() === '') {
    return {
      type: 'NO_WEB',
      label: 'Sin Sitio Web',
      color: 'red',
      badgeBg: 'bg-rose-500/10',
      badgeBorder: 'border-rose-500/30',
      badgeText: 'text-rose-400',
      dotColor: 'bg-rose-500',
      priority: 'Prioridad Alta',
      priorityLevel: 1,
      hint: 'Oportunidad de oro: no tienen presencia web propia.'
    };
  }

  const normalized = websiteUri.toLowerCase();
  const isSocial = SOCIAL_DOMAINS.some(domain => normalized.includes(domain));

  if (isSocial) {
    let platform = 'Redes Sociales';
    if (normalized.includes('instagram.com')) platform = 'Instagram';
    else if (normalized.includes('facebook.com') || normalized.includes('fb.com')) platform = 'Facebook';
    else if (normalized.includes('linktr.ee')) platform = 'Linktree';
    else if (normalized.includes('wa.me')) platform = 'WhatsApp';
    else if (normalized.includes('pedix.app')) platform = 'Pedix Menu';
    else if (normalized.includes('cafecito.app')) platform = 'Cafecito';

    return {
      type: 'SOCIAL_ONLY',
      label: `Solo ${platform}`,
      color: 'amber',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/30',
      badgeText: 'text-amber-400',
      dotColor: 'bg-amber-400',
      priority: 'Prioridad Media-Alta',
      priorityLevel: 2,
      platform,
      hint: `Usan ${platform} como web improvisada. Ideal para ofrecerles una web profesional.`
    };
  }

  return {
    type: 'HAS_WEB',
    label: 'Web Propia',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
    priority: 'Descartable / Baja',
    priorityLevel: 3,
    hint: 'Ya poseen dominio y desarrollo propio.'
  };
}

/**
 * Normalize raw Google Place object to standard Lead schema
 * @param {object} place
 * @param {string} fallbackCity
 * @param {string} fallbackRubro
 * @returns {object}
 */
export function normalizePlace(place, fallbackCity = 'La Plata', fallbackRubro = 'Comercio') {
  const displayName = typeof place.displayName === 'object' 
    ? (place.displayName?.text || 'Negocio sin nombre') 
    : (place.displayName || 'Negocio sin nombre');

  const primaryType = typeof place.primaryTypeDisplayName === 'object'
    ? (place.primaryTypeDisplayName?.text || fallbackRubro)
    : (place.primaryTypeDisplayName || fallbackRubro);

  const websiteUri = place.websiteUri || null;
  const classification = classifyWebsite(websiteUri);

  // Infer city from formatted address or place
  let city = place.city && place.city !== 'Local' ? place.city : null;
  const address = place.formattedAddress || '';
  if (!city && address) {
    // Try to extract city from comma-separated address parts
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // Often city is in the middle part (e.g. "Calle 10 123, La Plata, Buenos Aires")
      const candidate = parts[parts.length - 2].replace(/\b[A-Z0-9]{4,8}\b/g, '').replace(/provincia de/gi, '').trim();
      if (candidate.length > 2 && candidate.length < 35 && !/^\d+$/.test(candidate)) {
        city = candidate;
      }
    }
  }

  // Fallback to query city or generic fallback
  if (!city) {
    city = fallbackCity || 'Zona Comercial';
  }

  return {
    id: place.id || `lead-${Math.random().toString(36).substring(2, 9)}`,
    displayName,
    rubro: primaryType || fallbackRubro,
    primaryTypeDisplayName: primaryType,
    formattedAddress: place.formattedAddress || 'Dirección no disponible',
    city,
    provincia: place.provincia || '',
    nationalPhoneNumber: place.nationalPhoneNumber || null,
    internationalPhoneNumber: place.internationalPhoneNumber || null,
    websiteUri,
    rating: typeof place.rating === 'number' ? place.rating : null,
    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : 0,
    googleMapsUri: place.googleMapsUri || (place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : null),
    classification,
    source: place.source || 'google_places',
    createdAt: new Date().toISOString()
  };
}

/**
 * Check if local Puppeteer scraper Express server is running
 */
export async function checkScraperServerStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${BACKEND_BASE_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Scrape leads locally using Puppeteer backend
 */
export async function scrapeLocalPlaces({
  provincia = 'Buenos Aires',
  ciudad = 'La Plata',
  rubro = 'Ferreterías',
  freeQuery = '',
  limit = 35
}) {
  let targetCity = ciudad || 'La Plata';
  let targetRubro = rubro || 'Negocios';
  let targetProv = provincia || '';

  let combinedQuery = '';
  if (freeQuery.trim()) {
    combinedQuery = freeQuery.trim();
    // Try to extract city from free query if format is "Rubro en Ciudad, Provincia"
    const enMatch = combinedQuery.match(/(?:en|in)\s+([^,]+)(?:,\s*(.+))?/i);
    if (enMatch) {
      targetCity = enMatch[1].trim();
      if (enMatch[2]) targetProv = enMatch[2].trim();
    }
  } else {
    combinedQuery = targetProv 
      ? `${targetRubro} en ${targetCity}, ${targetProv}`
      : `${targetRubro} en ${targetCity}`;
  }

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/scrape?query=${encodeURIComponent(combinedQuery)}&limit=${limit}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error del servidor de scraping (${res.status})`);
    }

    const result = await res.json();
    const rawData = result.data || [];

    // Ensure all leads are normalized
    const normalized = rawData.map(lead => normalizePlace(lead, targetCity, targetRubro));

    return {
      success: true,
      data: normalized,
      count: normalized.length,
      source: 'scraper_local',
      query: combinedQuery
    };
  } catch (err) {
    console.error('Local scraper fetch error:', err);
    const isConnError = err.message.includes('Failed to fetch') || 
                        err.message.includes('NetworkError') || 
                        err.message.includes('ECONNREFUSED');
    return {
      success: false,
      error: isConnError 
        ? `El servidor backend (${BACKEND_BASE_URL}) no está respondiendo. Ejecutá "npm run server" o "npm run dev:all" en tu terminal para iniciarlo.` 
        : (err.message || 'Error al ejecutar scraping con Puppeteer.'),
      data: [],
      source: 'error',
      isServerOffline: isConnError,
      query: combinedQuery
    };
  }
}

/**
 * Execute search via either:
 * 1. 'scraper': Local Web Scraping with Puppeteer (100% Free, no API Key)
 * 2. 'api': Google Places API (New)
 */
export async function searchPlaces({ 
  provincia = 'Buenos Aires',
  ciudad = 'Berisso',
  zona = '', 
  rubro = 'Ferreterías', 
  freeQuery = '', 
  apiKey = '', 
  searchMode = 'scraper'
}) {
  const targetCity = ciudad || zona || 'Berisso';
  const targetRubro = rubro || 'Negocios';
  const targetProv = provincia || 'Buenos Aires';

  let effectiveMode = searchMode === 'api' ? 'api' : 'scraper';

  // Construct search query
  const combinedQuery = freeQuery.trim()
    ? freeQuery.trim()
    : `${targetRubro} en ${targetCity}, ${targetProv}`;

  // 1. LOCAL WEB SCRAPER WITH PUPPETEER (FREE, NO KEY)
  if (effectiveMode === 'scraper') {
    return await scrapeLocalPlaces({
      provincia: targetProv,
      ciudad: targetCity,
      rubro: targetRubro,
      freeQuery: freeQuery.trim()
    });
  }

  // 2. LIVE GOOGLE PLACES API (NEW)
  if (!apiKey.trim()) {
    return {
      success: false,
      error: 'Se requiere una clave de Google Places API para este modo. Configurala en Ajustes o seleccioná el Scraper Local Gratis.',
      data: [],
      source: 'error',
      query: combinedQuery
    };
  }

  const endpoint = 'https://places.googleapis.com/v1/places:searchText';
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.googleMapsUri',
    'places.primaryTypeDisplayName'
  ].join(',');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey.trim(),
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify({
        textQuery: combinedQuery,
        languageCode: 'es',
        maxResultCount: 20
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Error HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawPlaces = data.places || [];

    const normalized = rawPlaces.map(place => normalizePlace(place, targetCity, targetRubro));

    return {
      success: true,
      data: normalized,
      source: 'google_places',
      query: combinedQuery,
      total: normalized.length
    };
  } catch (error) {
    console.error('Google Places API Error:', error);
    return {
      success: false,
      error: error.message || 'Error al conectar con Google Places API. Verifique su API Key o use el Scraper Local.',
      data: [],
      source: 'error',
      query: combinedQuery
    };
  }
}

// ==========================================
// Backend CRM API Client Methods
// ==========================================

export async function fetchBackendCrmLeads() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/crm/leads`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || [];
  } catch (_) {
    return null;
  }
}

export async function saveBackendCrmLead(lead) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/crm/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function saveBackendCrmLeadsBulk(leads) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/crm/leads/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads })
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function deleteBackendCrmLead(id) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/crm/leads/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// ==========================================
// Website Auditor Client Method
// ==========================================

export async function auditWebsite(url) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/audit-web?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error('Error al auditar sitio web');
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err.message,
      issues: ['No se pudo contactar al servidor de auditoría']
    };
  }
}

// ==========================================
// Cache Stats / Clear Method
// ==========================================

export async function clearScraperCache() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/cache`, { method: 'DELETE' });
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Load more / deep scrape places for an ongoing search
 */
export async function loadMorePlaces({
  provincia = 'Buenos Aires',
  ciudad = 'La Plata',
  rubro = 'Ferreterías',
  freeQuery = '',
  searchMode = 'scraper',
  apiKey = '',
  currentCount = 0
}) {
  if (searchMode === 'scraper') {
    return await scrapeLocalPlaces({
      provincia,
      ciudad,
      rubro,
      freeQuery,
      limit: 60
    });
  }

  return await searchPlaces({
    provincia,
    ciudad,
    rubro,
    freeQuery,
    apiKey,
    searchMode
  });
}

// ==========================================
// WhatsApp Puppeteer Bot Client Methods
// ==========================================

export async function fetchWhatsAppStatus() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/whatsapp/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    return {
      status: 'disconnected',
      error: `No se pudo conectar con el servidor backend (${BACKEND_BASE_URL})`
    };
  }
}

export async function connectWhatsAppBot() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/whatsapp/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export async function disconnectWhatsAppBot() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/whatsapp/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function startWhatsAppBotCampaign(leads = [], delaySeconds = 12) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/whatsapp/campaign/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads, delaySeconds })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error HTTP ${res.status}`);
    }
    const data = await res.json();
    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function stopWhatsAppBotCampaign() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/whatsapp/campaign/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// ==========================================
// Permanent Contact History Methods
// (Persisten para siempre en server/data/contacted_history.json)
// ==========================================

export async function fetchContactedHistory() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/contacted`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (_) {
    return [];
  }
}

export async function recordContactedLead(lead, metadata = {}) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/contacted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, ...metadata })
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function recordContactedLeadsBulk(leads = []) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/contacted/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads })
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}


