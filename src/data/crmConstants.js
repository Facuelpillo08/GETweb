/**
 * CRM Statuses and Pipeline Constants
 */

export const CRM_STATUSES = [
  { 
    id: 'Pendiente', 
    label: 'Pendiente', 
    shortLabel: 'Pendiente',
    description: 'Nuevo lead guardado, aún no contactado',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    dotColor: 'bg-slate-400'
  },
  { 
    id: 'Contactado', 
    label: 'Contactado', 
    shortLabel: 'Contactado',
    description: 'Primer mensaje de WhatsApp enviado',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-300',
    dotColor: 'bg-blue-500'
  },
  { 
    id: 'En charla', 
    label: 'En charla', 
    shortLabel: 'En charla',
    description: 'Respondió el mensaje y está conversando',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    dotColor: 'bg-amber-500'
  },
  { 
    id: 'Propuesta enviada', 
    label: 'Propuesta enviada', 
    shortLabel: 'Propuesta',
    description: 'Recibió presupuesto o maqueta visual',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-300',
    dotColor: 'bg-indigo-500'
  },
  { 
    id: 'Cliente cerrado 💸', 
    label: 'Cliente cerrado 💸', 
    shortLabel: 'Cerrado 💸',
    description: 'Aceptó el desarrollo web y abonó seña/total',
    color: 'bg-emerald-600 text-white border-emerald-600 font-bold',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-300',
    dotColor: 'bg-emerald-600'
  },
  { 
    id: 'Descartado', 
    label: 'Descartado', 
    shortLabel: 'Descartado',
    description: 'No interesado o número inválido',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-300',
    dotColor: 'bg-rose-400'
  }
];
