import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  X, 
  QrCode, 
  AlertCircle, 
  Clock, 
  Send, 
  Square, 
  RefreshCw, 
  ShieldCheck, 
  Smartphone,
  Filter
} from 'lucide-react';
import { 
  fetchWhatsAppStatus, 
  connectWhatsAppBot, 
  disconnectWhatsAppBot, 
  startWhatsAppBotCampaign, 
  stopWhatsAppBotCampaign 
} from '../services/placesApi';
import { checkIsContacted } from '../utils/contactedHelper';

export default function WhatsAppAutomationModal({
  isOpen,
  onClose,
  leads = [],
  contactedHistory = [],
  _onUpdateLead,
  onRefreshContacted
}) {
  const [waState, setWaState] = useState({
    status: 'disconnected',
    qr: null,
    error: null,
    sessionExists: false,
    campaign: {
      running: false,
      total: 0,
      sent: 0,
      failed: 0,
      currentLead: null,
      countdown: 0,
      logs: []
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(14);
  const [localError, setLocalError] = useState(null);
  const [showOmittedList, setShowOmittedList] = useState(false);

  // Filter ONLY leads without web or only social with phone
  const qualifiedLeads = (leads || []).filter(lead => {
    const type = lead?.classification?.type;
    const isTarget = type === 'NO_WEB' || type === 'SOCIAL_ONLY';
    const phone = lead?.nationalPhoneNumber || lead?.internationalPhoneNumber || lead?.phone;
    return isTarget && Boolean(phone);
  });

  // Anti-duplication check: Segregate uncontacted leads from previously contacted ones
  const { uncontactedLeads, alreadyContactedLeads } = React.useMemo(() => {
    const uncontacted = [];
    const already = [];
    for (const lead of qualifiedLeads) {
      const { isContacted, record } = checkIsContacted(lead, contactedHistory);
      if (isContacted) {
        already.push({ lead, record });
      } else {
        uncontacted.push(lead);
      }
    }
    return { uncontactedLeads: uncontacted, alreadyContactedLeads: already };
  }, [qualifiedLeads, contactedHistory]);

  // Polling WhatsApp status when modal is open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const pollStatus = async () => {
      const data = await fetchWhatsAppStatus();
      if (isMounted && data) {
        setWaState(data);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsLoading(true);
    setLocalError(null);
    try {
      const data = await connectWhatsAppBot();
      setWaState(prev => ({ ...prev, ...data }));
    } catch (err) {
      setLocalError(err.message || 'Error al conectar con WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await disconnectWhatsAppBot();
      setWaState(prev => ({
        ...prev,
        status: 'disconnected',
        qr: null,
        campaign: { ...prev.campaign, running: false }
      }));
    } catch {
      setLocalError('Error al desconectar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCampaign = async () => {
    setLocalError(null);
    if (uncontactedLeads.length === 0) {
      if (alreadyContactedLeads.length > 0) {
        setLocalError(`Todos los ${alreadyContactedLeads.length} comercios calificados ya fueron contactados anteriormente. Se omitieron todos para proteger contra mensajes duplicados.`);
      } else {
        setLocalError('No hay negocios calificados (Sin Web o Solo Redes) con teléfono.');
      }
      return;
    }

    try {
      const res = await startWhatsAppBotCampaign(uncontactedLeads, delaySeconds);
      if (!res.success) {
        setLocalError(res.error || 'No se pudo iniciar el envío');
      } else {
        // Immediate optimistic update
        setWaState(prev => ({
          ...prev,
          status: 'sending',
          campaign: {
            ...prev.campaign,
            running: true,
            total: uncontactedLeads.length,
            sent: 0,
            failed: 0
          }
        }));
        if (typeof onRefreshContacted === 'function') {
          onRefreshContacted();
        }
      }
    } catch (err) {
      setLocalError(err.message || 'Error al iniciar campaña');
    }
  };

  const handleStopCampaign = async () => {
    await stopWhatsAppBotCampaign();
    if (typeof onRefreshContacted === 'function') {
      onRefreshContacted();
    }
  };

  const { status, qr, campaign } = waState;
  const isRunning = campaign?.running;
  const progressPercent = campaign?.total > 0 
    ? Math.min(Math.round(((campaign.sent + campaign.failed) / campaign.total) * 100), 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-sans tracking-tight">
                  Bot de Envío Automático WhatsApp
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  PUPPETEER HEADLESS
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-sans">
                Envía en segundo plano a comercios sin web o solo redes con mensajes personalizados y cero emojis.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Target Filter & Anti-Duplicate Protection Banner */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center shrink-0">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Filtro inteligente aplicado automáticamente:
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Solo comercios <span className="font-semibold text-rose-600">Sin Sitio Web</span> o <span className="font-semibold text-amber-600">Solo Redes</span> con WhatsApp activo.
                  </p>
                </div>
              </div>

              <div className="text-right flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-mono text-xs font-bold shadow-xs">
                  {uncontactedLeads.length} listos para enviar
                </span>
              </div>
            </div>

            {/* Anti-Duplicate Protection Shield */}
            {alreadyContactedLeads.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Protección anti-duplicados activa: {alreadyContactedLeads.length} {alreadyContactedLeads.length === 1 ? 'comercio ya fue contactado' : 'comercios ya fueron contactados'} previamente.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOmittedList(!showOmittedList)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer shrink-0 ml-2"
                  >
                    {showOmittedList ? 'Ocultar' : 'Ver cuáles se omiten'}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Se omiten de forma permanente para garantizar que ningún negocio reciba un segundo mensaje.
                </p>

                {showOmittedList && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {alreadyContactedLeads.map(({ lead: l, record: r }, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-700 bg-white/70 px-2 py-1 rounded">
                        <span className="font-sans font-medium text-slate-800 truncate max-w-[280px]">
                          {l.displayName || l.name}
                        </span>
                        <span className="text-emerald-700 font-semibold text-[10px] shrink-0">
                          {r?.formattedDate || 'Contactado'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Connection Status & QR Code Panel */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Estado de sesión:</span>
                {status === 'ready' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    🟢 Conectado y listo
                  </span>
                )}
                {status === 'sending' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                    <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                    Enviando campaña...
                  </span>
                )}
                {status === 'qr_ready' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                    <QrCode className="w-3 h-3 text-amber-600" />
                    Esperando escaneo de QR
                  </span>
                )}
                {status === 'starting' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
                    <div className="w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Iniciando Chromium...
                  </span>
                )}
                {status === 'disconnected' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                    ⚪ Desconectado
                  </span>
                )}
              </div>

              {/* Action Button: Connect / Disconnect */}
              <div>
                {status === 'disconnected' && (
                  <button
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Conectar WhatsApp Web</span>
                  </button>
                )}

                {(status === 'ready' || status === 'qr_ready') && !isRunning && (
                  <button
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    Desconectar sesión
                  </button>
                )}
              </div>
            </div>

            {/* QR Code Container if awaiting scan */}
            {status === 'qr_ready' && qr && (
              <div className="p-4 rounded-xl bg-slate-50 border border-amber-200 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left animate-fade-in">
                <div className="p-2 bg-white rounded-2xl shadow-md border border-slate-200 shrink-0">
                  <img src={qr} alt="Código QR de WhatsApp" className="w-48 h-48 rounded-lg object-contain" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 justify-center sm:justify-start">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Escaneá con tu teléfono</span>
                  </h4>
                  <ol className="text-xs text-slate-600 space-y-1.5 text-left list-decimal list-inside leading-relaxed">
                    <li>Abrí <strong>WhatsApp</strong> en tu celular.</li>
                    <li>Tocá <strong>Ajustes</strong> (o menú ⋮ en Android) &gt; <strong>Dispositivos vinculados</strong>.</li>
                    <li>Tocá <strong>Vincular un dispositivo</strong> y apuntá la cámara hacia este código.</li>
                  </ol>
                  <p className="text-[11px] text-slate-400">
                    La sesión se guarda localmente en tu equipo para que no tengas que escanear cada vez.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Safety Interval & Delay Configuration */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-900">
                  Pausa de seguridad anti-bloqueo entre mensajes:
                </h4>
              </div>
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                {delaySeconds} segundos
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="8"
                max="30"
                step="2"
                value={delaySeconds}
                disabled={isRunning}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-900 disabled:opacity-50"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Recomendamos entre 12 y 16 segundos para simular el comportamiento de una persona real y proteger tu línea telefónica de filtros de spam.
            </p>
          </div>

          {/* Error Banner if any */}
          {(localError || waState.error) && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{localError || waState.error}</span>
            </div>
          )}

          {/* Campaign Live HUD if running or completed */}
          {(isRunning || campaign?.sent > 0 || campaign?.failed > 0) && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 text-white space-y-3 shadow-md animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">Progreso de la Campaña:</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-300">
                  {campaign?.sent} / {campaign?.total} enviados ({progressPercent}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Currently processing lead card */}
              {campaign?.currentLead && (
                <div className="p-3 rounded-xl bg-white/10 border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-white font-bold">{campaign.currentLead.name}</p>
                    <p className="text-slate-300 text-[11px] font-mono">
                      {campaign.currentLead.rubro} • {campaign.currentLead.phone}
                    </p>
                  </div>
                  {campaign?.countdown > 0 ? (
                    <span className="px-2.5 py-1 rounded bg-amber-400/20 text-amber-300 font-mono text-[11px] font-bold">
                      Pausa: {campaign.countdown}s
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded bg-emerald-400/20 text-emerald-300 font-mono text-[11px] font-bold">
                      Despachando...
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity Log Stream */}
          {campaign?.logs && campaign.logs.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Registro en vivo:
              </span>
              <div className="p-3 rounded-xl bg-slate-900 text-slate-300 font-mono text-[11px] max-h-36 overflow-y-auto space-y-1">
                {campaign.logs.map((log, idx) => (
                  <div key={idx} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                onClick={handleStopCampaign}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Detener Campaña</span>
              </button>
            ) : (
              <button
                onClick={handleStartCampaign}
                disabled={status !== 'ready' || qualifiedLeads.length === 0}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md active:scale-95"
                title={status !== 'ready' ? 'Primero debés conectar WhatsApp Web' : ''}
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  Lanzar Envío Automático a {qualifiedLeads.length} Negocios
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
