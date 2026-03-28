import React from 'react';
import { ShoppingBag, Stethoscope, Tractor, ShieldCheck, HeartPulse, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const PARTNERS = [
  { id: 'petshop', label: 'Petshop', icon: ShoppingBag, path: '/partners/petshop', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'clinica', label: 'Clínica Vet', icon: Stethoscope, path: '/partners/clinica', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'agro', label: 'Agropecuária', icon: Tractor, path: '/partners/agro', color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'seguro', label: 'Seguro', icon: ShieldCheck, path: '/partners/seguro', color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'plano', label: 'Plano Saúde', icon: HeartPulse, path: '/partners/plano', color: 'text-pink-600', bg: 'bg-pink-50' },
  { id: 'criador', label: 'Criadores', icon: Users, path: '/partners/criador', color: 'text-indigo-600', bg: 'bg-indigo-50' },
];

export const PartnersSection = () => {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Parceiros Locais</h2>
      <div className="grid grid-cols-3 gap-3">
        {PARTNERS.map((partner) => (
          <Link
            key={partner.id}
            to={partner.path}
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-3xl shadow-sm border border-gray-100 hover:border-emerald-500 hover:shadow-md transition-all group"
          >
            <div className={`${partner.bg} ${partner.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
              <partner.icon size={24} />
            </div>
            <span className="text-[10px] font-bold text-gray-700 text-center leading-tight uppercase tracking-wider">
              {partner.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};
