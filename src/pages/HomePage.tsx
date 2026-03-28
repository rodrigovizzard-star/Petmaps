import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  AlertTriangle, 
  Home as HomeIcon, 
  Plus, 
  Eye, 
  MapPin, 
  Clock, 
  ChevronRight,
  Filter,
  MessageCircle,
  Bell,
  Navigation,
  PawPrint,
  Syringe,
  Calendar,
  Clipboard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { petService } from '../services/petService';
import { Pet, PetStatus } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PartnersSection } from '../components/PartnersSection';
import { CityAutocomplete } from '../components/CityAutocomplete';

const FILTER_CHIPS: { label: string; value: PetStatus | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Perdidos', value: 'lost' },
  { label: 'Vistos', value: 'sighted' },
  { label: 'Adotados', value: 'adopted' },
  { label: 'Para Doar', value: 'adoption' },
  { label: 'Encontrados', value: 'found' },
];

export const HomePage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PetStatus | 'all'>('all');
  const [isFabModalOpen, setIsFabModalOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(profile?.cidade || '');
  const [activityCity, setActivityCity] = useState(profile?.cidade || '');
  const [counts, setCounts] = useState({ new: 0, lost: 0, sighted: 0, found: 0, forAdoption: 0, adopted: 0 });
  const [isCityFilterOpen, setIsCityFilterOpen] = useState(false);
  const [isActivityCityFilterOpen, setIsActivityCityFilterOpen] = useState(false);
  const [petStats, setPetStats] = useState({
    nextVaccine: null as { date: Date, petName: string } | null,
    nextConsultation: null as { date: Date, petName: string } | null,
    totalRecords: 0
  });

  const GRID_ACTIONS = [
    { 
      id: 'vaccine',
      label: 'Carteira de Vacinação', 
      icon: Syringe, 
      color: 'bg-emerald-600', 
      path: '/vaccination-cards',
      description: 'Ver e baixar carteira'
    },
    { 
      id: 'consultation',
      label: 'Histórico Veterinário', 
      icon: Calendar, 
      color: 'bg-blue-600', 
      path: '/veterinary-history',
      description: 'Ver histórico clínico'
    },
    { 
      id: 'history',
      label: 'ID do Pet', 
      icon: Clipboard, 
      color: 'bg-purple-500', 
      path: '/pet-ids',
      description: 'Ver foto, nome e ID'
    },
    { 
      id: 'my-pets',
      label: 'Meus Pets', 
      icon: PawPrint, 
      color: 'bg-emerald-500', 
      path: '/my-pets',
      description: 'Ver todos os meus pets'
    },
    { 
      id: 'sighted',
      label: 'Vi Um Pet', 
      icon: Eye, 
      color: 'bg-blue-500', 
      path: '/register/sighted',
      description: 'Relatar pet avistado'
    },
    { 
      id: 'lost',
      label: 'Perdi Meu Pet', 
      icon: AlertTriangle, 
      color: 'bg-red-500', 
      path: '/register/lost',
      description: 'Relatar pet perdido'
    },
    ...(profile?.companyType === 'canil' ? [
      { 
        id: 'adoption',
        label: 'Pet para Doação', 
        icon: HomeIcon, 
        color: 'bg-emerald-500', 
        path: '/register/adoption',
        description: 'Cadastrar para adoção'
      }
    ] : [])
  ];

  const FAB_ACTIONS = [
    { 
      id: 'sighted',
      label: 'Vi Um Pet', 
      icon: Eye, 
      color: 'bg-blue-500', 
      path: '/register/sighted',
      description: 'Relatar pet avistado'
    },
    { 
      id: 'lost',
      label: 'Perdi Meu Pet', 
      icon: AlertTriangle, 
      color: 'bg-red-500', 
      path: '/register/lost',
      description: 'Relatar pet perdido'
    },
    ...(profile?.companyType === 'canil' ? [
      { 
        id: 'adoption',
        label: 'Pet para Doação', 
        icon: HomeIcon, 
        color: 'bg-emerald-500', 
        path: '/register/adoption',
        description: 'Cadastrar para adoção'
      }
    ] : [])
  ];

  useEffect(() => {
    if (profile?.cidade) {
      if (!selectedCity) setSelectedCity(profile.cidade);
      if (!activityCity) setActivityCity(profile.cidade);
    }
  }, [profile?.cidade]);

  useEffect(() => {
    const fetchPets = async () => {
      setLoading(true);
      try {
        // Fetch pets for the selected activity city
        const data = await petService.getActivePets(undefined, activityCity);
        
        // If no pets in city, fetch all active pets as fallback
        if (data.length === 0 && activityCity) {
          const allData = await petService.getActivePets();
          setPets(allData);
        } else {
          setPets(data);
        }
      } catch (error) {
        console.error('Error fetching pets for home:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPets();
  }, [activityCity]);

  useEffect(() => {
    const fetchCounts = async () => {
      if (selectedCity) {
        const data = await petService.getPetCountsByCity(selectedCity);
        setCounts(data);
      }
    };
    fetchCounts();
  }, [selectedCity]);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      if (!profile?.userId) return;
      try {
        const userPets = await petService.getUserPets(profile.userId);
        
        let nextVac: { date: Date, petName: string } | null = null;
        let nextCons: { date: Date, petName: string } | null = null;
        let totalRecords = 0;

        const now = new Date();

        // Process all pets in parallel to be faster
        await Promise.all(userPets.map(async (pet) => {
          // 1. Check nextVaccineDate on pet object (as a quick reference)
          if (pet.nextVaccineDate) {
            const vacDate = pet.nextVaccineDate.toDate ? pet.nextVaccineDate.toDate() : new Date(pet.nextVaccineDate);
            if (vacDate > now) {
              if (!nextVac || vacDate < nextVac.date) {
                nextVac = { date: vacDate, petName: pet.name || 'Pet' };
              }
            }
          }

          // 2. Fetch vaccines subcollection for more accuracy
          const vaccines = await petService.getVaccines(pet.id);
          for (const vac of vaccines) {
            if (vac.nextDose) {
              const nextDoseDate = vac.nextDose.toDate ? vac.nextDose.toDate() : new Date(vac.nextDose);
              if (nextDoseDate > now) {
                if (!nextVac || nextDoseDate < nextVac.date) {
                  nextVac = { date: nextDoseDate, petName: pet.name || 'Pet' };
                }
              }
            }
          }

          // 3. Fetch medical records
          const records = await petService.getMedicalRecords(pet.id);
          totalRecords += records.length;

          const futureRecords = records.filter(r => {
            const d = r.date.toDate ? r.date.toDate() : new Date(r.date);
            return d > now;
          });
          
          if (futureRecords.length > 0) {
            const soonest = futureRecords.reduce((prev, curr) => {
              const prevD = prev.date.toDate ? prev.date.toDate() : new Date(prev.date);
              const currD = curr.date.toDate ? curr.date.toDate() : new Date(curr.date);
              return currD < prevD ? curr : prev;
            });
            const consDate = soonest.date.toDate ? soonest.date.toDate() : new Date(soonest.date);
            if (!nextCons || consDate < nextCons.date) {
              nextCons = { date: consDate, petName: pet.name || 'Pet' };
            }
          }
        }));

        setPetStats({ 
          nextVaccine: nextVac, 
          nextConsultation: nextCons,
          totalRecords
        });
      } catch (error) {
        console.error('Error fetching upcoming events:', error);
      }
    };

    if (profile) {
      fetchUpcomingEvents();
    }
  }, [profile]);

  const filteredPets = pets.filter(pet => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'lost') return pet.status === 'lost' || pet.status === 'perdido';
    if (activeFilter === 'sighted') return pet.status === 'sighted' || pet.status === 'avistado';
    if (activeFilter === 'found') return pet.status === 'found' || pet.status === 'foundOwner' || pet.status === 'seguro' || pet.status === 'encontrado';
    if (activeFilter === 'adopted') return pet.status === 'adopted' || pet.status === 'doado';
    if (activeFilter === 'adoption') return pet.status === 'adoption' || pet.status === 'adocao';
    return pet.status === activeFilter;
  });

  const latestAlert = pets.length > 0 ? pets[0] : null;

  const stats = {
    lost: pets.filter(p => p.status === 'lost' || p.status === 'perdido').length,
    sighted: pets.filter(p => p.status === 'sighted' || p.status === 'avistado').length,
    adoption: pets.filter(p => p.status === 'adoption').length,
  };

  const getStatusLabel = (status: PetStatus) => {
    switch (status) {
      case 'lost':
      case 'perdido':
        return { text: 'Perdido', color: 'text-red-600', bg: 'bg-red-50' };
      case 'sighted':
      case 'avistado':
        return { text: 'Avistado', color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'found':
      case 'foundOwner':
      case 'seguro':
      case 'encontrado':
        return { text: 'Encontrado', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'adoption':
      case 'adocao':
        return { text: 'Adoção', color: 'text-purple-600', bg: 'bg-purple-50' };
      case 'adopted':
      case 'doado':
        return { text: 'Adotado', color: 'text-gray-600', bg: 'bg-gray-50' };
      default:
        return { text: status, color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  return (
    <Layout title="" headerType="default">
      <div className="flex-1 overflow-y-auto pb-24 bg-gray-50 scroll-smooth">
        <div className="max-w-md mx-auto px-4 py-6 space-y-8">
          
          {/* Welcome Section */}
          <section className="px-1">
            <h1 className="text-2xl font-black text-gray-900 leading-tight">
              Olá, {profile?.nome?.split(' ')[0] || 'Tutor'}! 👋
            </h1>
            <p className="text-sm text-gray-500 font-medium">O que vamos fazer hoje?</p>
          </section>

          {/* Alert Banner */}
          {latestAlert && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-600 rounded-[2.5rem] p-5 shadow-xl shadow-red-100 text-white flex items-center gap-4 relative overflow-hidden group cursor-pointer"
              onClick={() => navigate(`/pet/${latestAlert.id}`)}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <AlertTriangle size={100} />
              </div>
              <div className="w-20 h-20 rounded-3xl overflow-hidden bg-white/20 shrink-0 border-2 border-white/30 shadow-inner">
                <img 
                  src={latestAlert.imageUrl} 
                  alt="" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-white text-red-600 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    🚨 Urgente
                  </span>
                  <span className="text-[10px] font-bold opacity-80 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDistanceToNow(latestAlert.createdAt instanceof Date ? latestAlert.createdAt : latestAlert.createdAt.toDate(), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-base font-black leading-tight mb-1">
                  {latestAlert.type === 'dog' ? 'Cachorro' : 'Gato'} {latestAlert.status === 'lost' || latestAlert.status === 'perdido' ? 'perdido' : 'avistado'}
                </p>
                <div className="flex items-center gap-1 text-xs font-bold opacity-90">
                  <MapPin size={12} />
                  {latestAlert.city} • Ver detalhes <ChevronRight size={14} />
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Action Buttons */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ações Rápidas</h2>
              <Navigation size={14} className="text-gray-300" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {GRID_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-3 p-4 bg-white rounded-[2rem] shadow-sm border border-gray-100 hover:border-emerald-500 hover:shadow-md transition-all group"
                >
                  <div className={`${action.color} p-3 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <action.icon size={24} />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-gray-700 text-center leading-tight uppercase tracking-tighter">
                      {action.label}
                    </span>
                    {action.description && (
                      <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5 opacity-60">
                        {action.description}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Local Summary */}
          <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <Navigation size={120} />
            </div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Resumo Local</h2>
              <button 
                onClick={() => setIsCityFilterOpen(!isCityFilterOpen)}
                className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-wider hover:bg-emerald-100 transition-colors"
              >
                <MapPin size={10} />
                {selectedCity || 'Sua Região'}
                <ChevronRight size={10} className={isCityFilterOpen ? 'rotate-90' : ''} />
              </button>
            </div>

            <AnimatePresence>
              {isCityFilterOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <CityAutocomplete 
                    defaultValue={selectedCity}
                    onCitySelect={(city) => {
                      setSelectedCity(city);
                      setIsCityFilterOpen(false);
                    }}
                    placeholder="Filtrar por cidade..."
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-3 gap-y-6 gap-x-4">
              <div className="text-center space-y-1">
                <p className="text-2xl font-black text-gray-900">{counts.new}</p>
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Novo Cadastro</p>
              </div>
              <div className="text-center border-x border-gray-100 space-y-1">
                <p className="text-2xl font-black text-gray-900">{counts.lost}</p>
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">Perdidos</p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-2xl font-black text-gray-900">{counts.sighted}</p>
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none">Avistados</p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-2xl font-black text-gray-900">{counts.found}</p>
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">Encontrado</p>
              </div>
              <div className="text-center border-x border-gray-100 space-y-1">
                <p className="text-2xl font-black text-gray-900">{counts.forAdoption}</p>
                <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest leading-none">Para Doar</p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-2xl font-black text-gray-900">{counts.adopted}</p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">Doado</p>
              </div>
            </div>
          </section>

          {/* Activity Feed */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Atividade Recente</h2>
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              </div>
              <button 
                onClick={() => setIsActivityCityFilterOpen(!isActivityCityFilterOpen)}
                className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-wider hover:bg-emerald-100 transition-colors"
              >
                <MapPin size={10} />
                {activityCity || 'Sua Região'}
                <ChevronRight size={10} className={isActivityCityFilterOpen ? 'rotate-90' : ''} />
              </button>
            </div>

            <AnimatePresence>
              {isActivityCityFilterOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-2 overflow-hidden"
                >
                  <CityAutocomplete 
                    defaultValue={activityCity}
                    onCitySelect={(city) => {
                      setActivityCity(city);
                      setIsActivityCityFilterOpen(false);
                    }}
                    placeholder="Filtrar por cidade..."
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setActiveFilter(chip.value)}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                    activeFilter === chip.value
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                      : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Feed Cards */}
            <div className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-[2.5rem] p-4 h-48 animate-pulse border border-gray-100" />
                ))
              ) : filteredPets.length > 0 ? (
                filteredPets.map((pet) => {
                  const status = getStatusLabel(pet.status);
                  return (
                    <motion.div
                      key={pet.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-[2.5rem] p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex gap-5">
                        <div className="w-28 h-28 rounded-3xl overflow-hidden bg-gray-100 shrink-0 border border-gray-50 shadow-inner">
                          <img 
                            src={pet.imageUrl} 
                            alt={pet.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`${status.bg} ${status.color} px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest`}>
                                {status.text}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                                <Clock size={10} />
                                {formatDistanceToNow(pet.createdAt instanceof Date ? pet.createdAt : pet.createdAt.toDate(), { addSuffix: true, locale: ptBR })}
                              </div>
                            </div>
                            <h3 className="font-black text-gray-900 truncate text-lg">
                              {pet.name || (pet.type === 'dog' ? 'Cachorro' : 'Gato')}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-gray-500 font-bold">
                              <MapPin size={12} className="text-emerald-500" />
                              <span className="truncate">{pet.city}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed font-medium">
                            {pet.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-5">
                        <button 
                          onClick={() => navigate(`/pet/${pet.id}`)}
                          className="flex-1 bg-gray-50 text-gray-700 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
                        >
                          Ver Detalhes
                        </button>
                        {(pet.status === 'lost' || pet.status === 'perdido' || pet.status === 'sighted' || pet.status === 'avistado') && (
                          <button 
                            onClick={() => navigate(`/pet/${pet.id}`)}
                            className="flex-1 bg-emerald-600 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                          >
                            <MessageCircle size={14} />
                            Tenho Info
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-16 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="text-gray-200" size={40} />
                  </div>
                  <p className="text-base font-black text-gray-400 uppercase tracking-widest">Nenhum pet encontrado</p>
                  <p className="text-xs text-gray-400 font-medium">Tente mudar o filtro ou região</p>
                </div>
              )}
            </div>
          </section>

          {/* Partners Section */}
          <PartnersSection />
        </div>
      </div>

      {/* FAB */}
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsFabModalOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 text-white rounded-[1.5rem] shadow-2xl shadow-emerald-200 flex items-center justify-center z-50 group"
      >
        <Plus size={36} className="group-hover:rotate-90 transition-transform duration-300" />
      </motion.button>

      {/* FAB Modal */}
      <AnimatePresence>
        {isFabModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFabModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-28 right-8 w-72 bg-white rounded-[2.5rem] p-5 shadow-2xl z-[70] border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Novo Registro</h3>
                <button onClick={() => setIsFabModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
              <div className="space-y-2">
                {FAB_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      setIsFabModalOpen(false);
                      navigate(action.path);
                    }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-3xl transition-all group"
                  >
                    <div className={`${action.color} p-2.5 rounded-xl text-white group-hover:scale-110 transition-transform shadow-md`}>
                      <action.icon size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{action.label}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter opacity-60">{action.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Layout>
  );
};
