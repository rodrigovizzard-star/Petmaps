import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Users, ExternalLink, MessageCircle, MapPin, Search, Loader2, Percent, ArrowLeft, X, Map as MapIcon, List, ShoppingBag, Stethoscope, Tractor, ShieldCheck, HeartPulse, Home } from 'lucide-react';
import { partnerService } from '../services/partnerService';
import { userService } from '../services/userService';
import { Partner, UserProfile } from '../types';
import { formatWhatsAppLink } from '../utils';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PartnerMap } from '../components/PartnerMap';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

import { Logo } from '../components/Logo';

export const PartnersPage = () => {
  const navigate = useNavigate();
  const { segment } = useParams<{ segment: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);

  const getSegmentTitle = () => {
    switch (segment) {
      case 'petshop': return 'Petshops';
      case 'clinica': return 'Clínicas Veterinárias';
      case 'agro': return 'Agropecuárias';
      case 'seguro': return 'Seguros';
      case 'plano': return 'Planos de Saúde';
      case 'criador': return 'Criadores';
      case 'canil': return 'Canis';
      default: return 'Parceiros';
    }
  };

  const title = getSegmentTitle();

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const data = await userService.getUserProfile(user.uid);
        setProfile(data);
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const fetchPartners = async () => {
      setLoading(true);
      try {
        const data = await partnerService.getPartners(selectedCity || undefined, segment);
        setPartners(data);
      } catch (error) {
        console.error('Error fetching partners:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPartners();
  }, [selectedCity, segment]);

  const filteredPartners = partners.filter(p => {
    const search = searchTerm.toLowerCase();
    return (
      (p.nomeEmpresa?.toLowerCase() || '').includes(search) ||
      (p.segmento?.toLowerCase() || '').includes(search)
    );
  });

  const handleCitySelect = (city: string, location: { lat: number; lng: number }) => {
    setSelectedCity(city);
    setMapCenter(location);
  };

  return (
    <Layout title={title}>
      <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="p-6 bg-white border-b border-gray-100 shadow-sm z-10">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowLeft size={24} className="text-gray-600" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                  </div>
                  <p className="text-sm text-gray-500">
                    {segment ? `Encontre ${title.toLowerCase()} parceiros na sua região.` : 'Empresas que apoiam a causa animal.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center bg-gray-100 p-1 rounded-2xl">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <List size={18} />
                  Lista
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'map' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <MapIcon size={18} />
                  Mapa
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="relative group">
                <CityAutocomplete 
                  onCitySelect={handleCitySelect}
                  defaultValue={selectedCity}
                />
                {selectedCity && (
                  <button 
                    onClick={() => {
                      setSelectedCity('');
                      setMapCenter(undefined);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
          {viewMode === 'map' ? (
            <div className="h-full w-full">
              <PartnerMap partners={filteredPartners} center={mapCenter} />
            </div>
          ) : (
            <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
              {loading ? (
                <div className="text-center py-12 flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                  <p className="text-gray-500 font-medium">Buscando parceiros...</p>
                </div>
              ) : filteredPartners.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
                  <p className="text-gray-500">Nenhum parceiro encontrado para sua busca.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {filteredPartners.map((partner) => (
                    <div 
                      key={partner.id}
                      className="bg-white p-6 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col gap-6"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                            {partner.segmento}
                          </span>
                          <h3 className="text-xl font-black text-gray-900">{partner.nomeEmpresa}</h3>
                          <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                            <MapPin size={14} />
                            {partner.cidade}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">
                        <p className="font-medium text-gray-900 mb-1">Endereço:</p>
                        <p>{partner.endereço}</p>
                      </div>

                      <div className="flex gap-3">
                        <a 
                          href={formatWhatsAppLink(partner.whatsapp, `Olá! Vi o parceiro ${partner.nomeEmpresa} e gostaria de mais informações.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                        >
                          <MessageCircle size={20} />
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
