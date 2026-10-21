/**
 * Helper utilities for permanent contact history and duplicate prevention
 */

/**
 * Normalizes phone numbers to standard searchable core digits.
 * Strips formatting, non-digits, Argentine mobile prefixes (15, 0, 54, 549)
 * so that any representation of the same phone number resolves identically.
 *
 * Examples:
 * "+54 9 221 555-1234" -> "2215551234"
 * "0221 15-555-1234"    -> "2215551234"
 * "2215551234"          -> "2215551234"
 * "5492215551234"       -> "2215551234"
 * "11-4444-5555"        -> "1144445555"
 */
export function normalizePhoneCore(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits || digits.length < 6) return '';

  // Remove Argentina international prefix 549 or 54
  if (digits.startsWith('549')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  // Remove trunk prefix 0
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Remove Argentine mobile carrier '15' between area code (2 to 4 digits) and local number
  // E.g., 221 15 5551234 (11 digits) -> 221 5551234 (9 digits)
  // E.g., 11 15 44445555 (10 digits) -> 11 44445555 (8 digits)
  if (digits.length >= 10 && digits.includes('15')) {
    digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  }

  return digits;
}

/**
 * Normalize business name for fuzzy comparison (lowercase, strip accents, symbols, whitespace)
 */
export function normalizeBusinessName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]/g, '') // keep only alphanumeric
    .trim();
}

/**
 * Check if a lead has already been contacted according to the permanent history
 * Matches by:
 * 1. Normalized Core Phone
 * 2. Place ID / lead ID
 * 3. Exact Normalized Name + City
 *
 * @param {object} lead - The lead to check
 * @param {Array<object>} contactedHistory - Array of permanently contacted records
 * @returns {{ isContacted: boolean, record: object | null }}
 */
export function checkIsContacted(lead, contactedHistory = []) {
  if (!lead || !Array.isArray(contactedHistory) || contactedHistory.length === 0) {
    return { isContacted: false, record: null };
  }

  const rawPhone = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone || '';
  const leadCorePhone = normalizePhoneCore(rawPhone);
  const leadId = lead.id || lead.placeId;
  const leadNormName = normalizeBusinessName(lead.displayName || lead.name || '');
  const leadCity = (lead.city || lead.zona || '').toLowerCase().trim();

  for (const record of contactedHistory) {
    if (!record) continue;

    // 1. Check Phone Match (Primary & most definitive)
    if (leadCorePhone) {
      const recordCorePhone = record.corePhone || normalizePhoneCore(record.phone || record.nationalPhoneNumber || '');
      if (recordCorePhone && recordCorePhone === leadCorePhone) {
        return { isContacted: true, record };
      }
    }

    // 2. Check Place ID / ID Match
    const recordId = record.id || record.placeId;
    if (leadId && recordId && leadId === recordId) {
      return { isContacted: true, record };
    }

    // 3. Check Name + City Match (Secondary)
    if (leadNormName && leadNormName.length >= 4) {
      const recordNormName = record.normName || normalizeBusinessName(record.displayName || record.name || '');
      const recordCity = (record.city || record.zona || '').toLowerCase().trim();

      if (recordNormName === leadNormName) {
        // If city matches or either has no city specified
        if (!leadCity || !recordCity || leadCity === recordCity) {
          return { isContacted: true, record };
        }
      }
    }
  }

  return { isContacted: false, record: null };
}

/**
 * Build a standard contacted record ready for permanent storage
 */
export function createContactedRecord(lead, metadata = {}) {
  const rawPhone = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone || '';
  const corePhone = normalizePhoneCore(rawPhone);
  const now = new Date();

  return {
    id: lead.id || lead.placeId || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    placeId: lead.placeId || lead.id || '',
    displayName: lead.displayName || lead.name || 'Comercio',
    normName: normalizeBusinessName(lead.displayName || lead.name || ''),
    phone: rawPhone,
    corePhone,
    rubro: lead.rubro || 'Comercio',
    city: lead.city || '',
    address: lead.formattedAddress || lead.address || '',
    mapsUrl: lead.googleMapsUri || lead.maps_url || '',
    firstContactedAt: metadata.firstContactedAt || now.toISOString(),
    lastContactedAt: now.toISOString(),
    formattedDate: now.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    contactMethod: metadata.contactMethod || 'bot_whatsapp', // 'bot_whatsapp' | 'manual_whatsapp'
    pitchSent: metadata.pitchSent || lead.pregeneratedPitch || lead.customPitch || '',
    notes: metadata.notes || 'Mensaje enviado'
  };
}
