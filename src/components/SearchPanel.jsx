import React, { useState } from 'react';
import { 
  MapPin, 
  Briefcase, 
  RotateCcw, 
  Sparkles, 
  PhoneCall, 
  Star, 
  ShieldAlert, 
  ChevronDown, 
  Compass, 
  Bot, 
  Search,
  SlidersHorizontal,
  X,
  ArrowRight,
  Check,
  History
} from 'lucide-react';
import { PROVINCIAS_ARGENTINAS } from '../data/argentinaGeoData';
import { RUBROS_CATEGORIAS } from '../data/rubrosData';

const REVIEW_OPTIONS = [
  { label: "Cualquier cant. de reseñas", value: 0 },
  { label: "Mínimo 5 reseñas (Activos)", value: 5 },
  { label: "Mínimo 15 reseñas (Consolidados)", value: 15 },
  { label: "Mínimo 30 reseñas (Alta demanda)", value: 30 }
];

const SUGGESTED_QUICK_SEARCHES = [
  { label: "Odontólogos en Córdoba", prov: "Córdoba", city: "Córdoba Capital", rubro: "Odontólogos y Clínicas Dentales" },
  { label: "Ferreterías en La Plata", prov: "Buenos Aires", city: "La Plata", rubro: "Ferreterías y Corralones" },
  { label: "Inmobiliarias en Mar del Plata", prov: "Buenos Aires", city: "Mar del Plata", rubro: "Inmobiliarias y Bienes Raíces" },
  { label: "Peluquerías en Rosario", prov: "Santa Fe", city: "Rosario", rubro: "Peluquerías y Barberías" },
  { label: "Talleres en Berisso", prov: "Buenos Aires", city: "Berisso", rubro: "Talleres Mecánicos y Chapa/Pintura" },
  { label: "Veterinarias en Mendoza", prov: "Mendoza", city: "Mendoza Capital", rubro: "Veterinarias y Pet Shops" }
];

export default function SearchPanel({
  selectedProvince,
  setSelectedProvince,
  selectedCity,
  setSelectedCity,
  selectedRubro,
  setSelectedRubro,
  freeQuery,
  setFreeQuery,
  onlyNoWebOrSocial,
  setOnlyNoWebOrSocial,
  minReviews,
  setMinReviews,
  _onlyWithPhone,
  setOnlyWithPhone,
  phoneFilter = 'all',
  setPhoneFilter,
  recentSearches = [],
  onApplyRecentSearch,
  onClearRecentSearches,
  onSearch,
  isSearching,
  searchMode = 'scraper',
  setSearchMode,
  serverOnline = true
}) {
  const [searchMethod, setSearchMethod] = useState(freeQuery ? 'free' : 'guided'); // 'guided' | 'free'

  const currentProvObj = PROVINCIAS_ARGENTINAS.find(p => p.nombre === selectedProvince) || PROVINCIAS_ARGENTINAS[0];
  const availableCities = currentProvObj.ciudades;

  const handleProvinceChange = (e) => {
    const newProvName = e.target.value;
    setSelectedProvince(newProvName);
    const newProvObj = PROVINCIAS_ARGENTINAS.find(p => p.nombre === newProvName);
    if (newProvObj && newProvObj.ciudades.length > 0) {
      setSelectedCity(newProvObj.ciudades[0]);
    }
  };

  const handleApplyPreset = (preset) => {
    setSearchMethod('guided');
    setSelectedProvince(preset.prov);
    setSelectedCity(preset.city);
    setSelectedRubro(preset.rubro);
    setFreeQuery('');
  };

  const handleReset = () => {
    setSelectedProvince("Buenos Aires");
    setSelectedCity("La Plata");
    setSelectedRubro("Ferreterías y Corralones");
    setFreeQuery("");
    setSearchMethod('guided');
    setOnlyNoWebOrSocial(true);
    setMinReviews(0);
    setOnlyWithPhone(false);
    if (setPhoneFilter) setPhoneFilter('all');
  };

  const activeTargetDescription = searchMethod === 'free' && freeQuery.trim()
    ? `"${freeQuery.trim()}"`
    : `${selectedRubro} en ${selectedCity}, ${selectedProvince}`;

  return (
    <section aria-label="Panel de Configuración de Búsqueda" className="bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.04)] relative overflow-hidden mb-8">
      {/* Top Hairline Accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#059669]" />

      {/* Main Header / Switcher Bar */}
      <div className="p-5 sm:p-6 pb-4 border-b border-[#F1F5F9] flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] font-bold text-[#1E3A8A] bg-[#EFF6FF] px-2.5 py-0.5 rounded border border-[#BFDBFE] tracking-wider uppercase">
              PASO 1 // CONFIGURACIÓN DEL RADAR
            </span>
            <span className="text-xs text-[#64748B] hidden sm:inline font-medium">
              Definí la ubicación y el tipo de negocio que querés prospectar
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight font-sans">
            ¿Dónde y qué rubro querés explorar hoy?
          </h2>
        </div>

        {/* Method Mode Selector + Engine Pill */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Guided vs Free Query Tabs */}
          <div className="flex items-center p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSearchMethod('guided');
                setFreeQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMethod === 'guided'
                  ? 'bg-white text-[#1E3A8A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros Guiados (Argentina)</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchMethod('free')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMethod === 'free'
                  ? 'bg-white text-[#1E3A8A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Búsqueda Libre Global</span>
            </button>
          </div>

          {/* Engine Selector Dropdown / Pill */}
          <div className="relative">
            <select
              value={searchMode}
              onChange={(e) => setSearchMode && setSearchMode(e.target.value)}
              aria-label="Seleccionar motor de búsqueda"
              className="pl-2.5 pr-7 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#1E3A8A] rounded-xl text-[11px] font-mono font-bold text-[#0F172A] cursor-pointer appearance-none transition focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
            >
              <option value="scraper">
                {serverOnline ? '🤖 Scraper Local (Gratis)' : '⚠️ Scraper Local (Offline)'}
              </option>
              <option value="api">✨ Google Places API</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

      </div>

      <div className="p-5 sm:p-6 space-y-6">

        {/* METHOD 1: Guided Selectors */}
        {searchMethod === 'guided' ? (
          <div>
            {/* 3 Step Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              
              {/* 1. Provincia */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors space-y-2">
                <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>1. Provincia / Región</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#94A3B8]">Argentina</span>
                </label>
                
                <div className="relative">
                  <select
                    value={selectedProvince}
                    onChange={handleProvinceChange}
                    aria-label="Seleccionar Provincia"
                    className="w-full pl-3 pr-8 py-2.5 bg-white border border-[#CBD5E1] hover:border-[#1E3A8A] focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 rounded-xl text-[#0F172A] text-xs font-semibold transition appearance-none cursor-pointer"
                  >
                    {PROVINCIAS_ARGENTINAS.map(prov => (
                      <option key={prov.id} value={prov.nombre} className="text-[#0F172A]">
                        {prov.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-[#64748B]">
                  {availableCities.length} localidades disponibles
                </p>
              </div>

              {/* 2. Ciudad */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors space-y-2">
                <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#059669]" />
                    <span>2. Ciudad o Municipio</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#059669] font-semibold">{selectedProvince}</span>
                </label>

                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    aria-label="Seleccionar Ciudad"
                    className="w-full pl-3 pr-8 py-2.5 bg-white border border-[#CBD5E1] hover:border-[#1E3A8A] focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 rounded-xl text-[#0F172A] text-xs font-semibold transition appearance-none cursor-pointer"
                  >
                    {availableCities.map(city => (
                      <option key={city} value={city} className="text-[#0F172A]">
                        {city}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Punto geográfico central de escaneo
                </p>
              </div>

              {/* 3. Rubro */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors space-y-2">
                <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>3. Rubro o Industria</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#1E3A8A] font-semibold">Alta Rentabilidad</span>
                </label>

                <div className="relative">
                  <select
                    value={selectedRubro}
                    onChange={(e) => setSelectedRubro(e.target.value)}
                    aria-label="Seleccionar Rubro"
                    className="w-full pl-3 pr-8 py-2.5 bg-white border border-[#CBD5E1] hover:border-[#1E3A8A] focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 rounded-xl text-[#0F172A] text-xs font-semibold transition appearance-none cursor-pointer"
                  >
                    {RUBROS_CATEGORIAS.map(cat => (
                      <optgroup key={cat.categoria} label={cat.categoria} className="font-bold text-[#1E3A8A]">
                        {cat.rubros.map(rubro => (
                          <option key={rubro} value={rubro} className="text-[#0F172A] font-normal">
                            {rubro}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Filtro por categoría de Google Maps
                </p>
              </div>

            </div>

            {/* Quick Presets / Popular Shortcuts */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-xs font-semibold text-[#475569] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Atajos rápidos de prospección con alta conversión:</span>
                </span>
                <span className="text-[11px] text-[#94A3B8] hidden sm:inline">1 clic para autocompletar</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {SUGGESTED_QUICK_SEARCHES.map((preset) => {
                  const isCurrent = selectedCity === preset.city && selectedRubro === preset.rubro;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-[#1E3A8A] text-white font-semibold shadow-xs'
                          : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:border-[#1E3A8A] hover:text-[#0F172A] hover:bg-white'
                      }`}
                    >
                      {isCurrent && <Check className="w-3 h-3 text-emerald-300" />}
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          /* METHOD 2: Free Query Global Input */
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#1E3A8A]" />
                  <span>Escribí tu búsqueda libre (Cualquier ciudad, rubro o país):</span>
                </span>
                <span className="font-mono text-[11px] text-[#64748B]">Google Maps Live Query</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={freeQuery}
                  onChange={(e) => setFreeQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                  placeholder="Ej: Inmobiliarias en Mar del Plata • Odontólogos en Asunción • Talleres mecánicos en Lanús..."
                  className="w-full pl-4 pr-12 py-3.5 bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#1E3A8A] focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 rounded-xl text-[#0F172A] text-sm font-medium transition"
                />
                {freeQuery && (
                  <button
                    type="button"
                    onClick={() => setFreeQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick suggestions for free search */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#64748B] text-xs font-medium">Ejemplos recomendados:</span>
              {[
                "Clínicas estéticas en CABA",
                "Ferreterías en Morón",
                "Concesionarias en Neuquén",
                "Restaurantes en Tandil"
              ].map(queryText => (
                <button
                  key={queryText}
                  type="button"
                  onClick={() => setFreeQuery(queryText)}
                  className="px-2.5 py-1 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] text-xs font-medium transition cursor-pointer"
                >
                  {queryText}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Historial de Búsquedas Recientes (Feature 5) */}
        {recentSearches && recentSearches.length > 0 && (
          <div className="pt-3 pb-1 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <History className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span className="font-bold text-[#0F172A]">Búsquedas Recientes:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 flex-1">
              {recentSearches.map((item, i) => (
                <button
                  key={`${item.label}-${i}`}
                  type="button"
                  onClick={() => onApplyRecentSearch && onApplyRecentSearch(item)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#CBD5E1] hover:border-[#BFDBFE] text-[#334155] hover:text-[#1E3A8A] transition-all cursor-pointer flex items-center gap-1 font-mono text-[11px] active:scale-95"
                  title="Restaurar parámetros de búsqueda con 1 clic"
                >
                  <span>{item.label}</span>
                </button>
              ))}

              {onClearRecentSearches && (
                <button
                  type="button"
                  onClick={onClearRecentSearches}
                  className="text-[10px] text-[#94A3B8] hover:text-[#E11D48] underline ml-auto font-mono cursor-pointer"
                  title="Borrar historial reciente"
                >
                  Limpiar historial
                </button>
              )}
            </div>
          </div>
        )}

        {/* Real-time Filter Bar (Filters applied live on extracted leads) */}
        <div className="pt-4 border-t border-[#F1F5F9] bg-[#F8FAFC] -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-6 rounded-b-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 mr-1">
              <ShieldAlert className="w-4 h-4 text-[#1E3A8A]" />
              <span>Filtros Automáticos:</span>
            </span>

            {/* Toggle: Solo Oportunidades (Sin Web / Solo Redes) */}
            <label className="flex items-center gap-2 cursor-pointer group bg-white px-3 py-1.5 rounded-xl border border-[#E2E8F0] hover:border-[#1E3A8A] transition shadow-xs">
              <input
                type="checkbox"
                checked={onlyNoWebOrSocial}
                onChange={(e) => setOnlyNoWebOrSocial(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-[#CBD5E1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#94A3B8] after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#E11D48] relative"></div>
              <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1">
                <span>Solo Oportunidades</span>
                <span className="text-[10px] text-[#E11D48] font-bold">(Sin Web / Redes)</span>
              </span>
            </label>

            {/* Dropdown: Filtro de Teléfono (Todos, Solo WhatsApp, Solo Fijo) */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-[#E2E8F0] hover:border-[#1E3A8A] transition shadow-xs">
              <PhoneCall className="w-3.5 h-3.5 text-[#059669]" />
              <select
                value={phoneFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  if (setPhoneFilter) setPhoneFilter(val);
                  if (setOnlyWithPhone) setOnlyWithPhone(val !== 'all');
                }}
                className="bg-transparent text-[#0F172A] focus:outline-none text-xs font-semibold cursor-pointer"
                aria-label="Filtrar por tipo de teléfono"
              >
                <option value="all">📞 Teléfono: Todos</option>
                <option value="whatsapp">📱 Solo Celular / WhatsApp</option>
                <option value="landline">☎️ Solo Teléfono Fijo</option>
                <option value="has_phone">✔️ Con Teléfono (Cualquiera)</option>
              </select>
            </div>

            {/* Min Reviews Select */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-[#E2E8F0] shadow-xs">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <select
                value={minReviews}
                onChange={(e) => setMinReviews(Number(e.target.value))}
                aria-label="Filtro de mínimo de reseñas"
                className="bg-transparent text-[#0F172A] focus:outline-none text-xs font-medium cursor-pointer"
              >
                {REVIEW_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-[#0F172A]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-[#94A3B8] hover:text-[#0F172A] text-xs py-1.5 px-2.5 rounded-lg hover:bg-white transition flex items-center gap-1 font-mono cursor-pointer"
              title="Restablecer filtros a valores por defecto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Action Search Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="text-left sm:text-right hidden sm:block">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#94A3B8] block font-bold">
                OBJETIVO:
              </span>
              <span className="text-xs font-bold text-[#0F172A] max-w-[200px] truncate block">
                {activeTargetDescription}
              </span>
            </div>

            <button
              onClick={() => onSearch()}
              disabled={isSearching}
              className="flex items-center justify-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer bg-gradient-to-r from-[#1E3A8A] to-[#1E40AF] hover:from-[#172554] hover:to-[#1E3A8A] text-white shadow-md shadow-[#1E3A8A]/25 hover:shadow-lg"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Escaneando...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 text-emerald-300" />
                  <span>Escanear Comercios</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

        </div>

      </div>

    </section>
  );
}
