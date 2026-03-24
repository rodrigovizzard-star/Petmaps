import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Search, MapPin, Calendar, ArrowRight, CheckCircle2, Sparkles, X, List, Map as MapIcon, ArrowLeft, ChevronDown, Trash2 } from 'lucide-react';
import { petService } from '../services/petService';
import { Pet, PetStatus } from '../types';
import { getTranslation } from '../utils/translations';
import { Layout } from '../components/Layout';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PetMap } from '../components/PetMap';
import { useAuth } from '../hooks/useAuth';

export const PetListPage = () => {
  const { user: currentUser, profile } = useAuth();
  const { status: urlStatus } = useParams<{ status: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [pets, setPets] = useState<any[]>([]);
  const [filteredPets, setFilteredPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);

  const getTitleAndStatus = (): { status: PetStatus; title: string } => {
    const effectiveStatus = urlStatus || (location.pathname.includes('lost') ? 'lost' : 
                            location.pathname.includes('sighted') ? 'sighted' : 
                            location.pathname.includes('found') ? 'found' : 
                            location.pathname.includes('adoption') ? 'adoption' : 
                            location.pathname.includes('adopted') ? 'adopted' : 'lost');
    
    if (effectiveStatus === 'lost') return { status: 'lost', title: 'Pets Perdidos' };
    if (effectiveStatus === 'sighted') return { status: 'sighted', title: 'Pets Avistados' };
    if (effectiveStatus === 'found') return { status: 'found', title: 'Pets Encontrados' };
    if (effectiveStatus === 'adoption') return { status: 'adoption', title: 'Pets Para Doação' };
    if (effectiveStatus === 'adopted') return { status: 'adopted', title: 'Pets Doados' };
    return { status: 'lost', title: 'Pets' };
  };

  const { status, title } = getTitleAndStatus();

  useEffect(() => {
    setLoading(true);
    const fetchPets = async () => {
      try {
        if (viewMode === 'map' && selectedCity) {
          // In map mode with a city, show both lost and found to give a full picture
          const data = await petService.getActivePets(undefined, selectedCity);
          setPets(data);
          setFilteredPets(data);
        } else if (status === 'found') {
          const data = await petService.getFoundHistory(selectedCity);
          setPets(data);
          setFilteredPets(data);
        } else if (status === 'adoption' || status === 'adopted') {
          const data = await petService.getActivePets(status, selectedCity, true);
          setPets(data);
          setFilteredPets(data);
        } else {
          const data = await petService.getActivePets(status, selectedCity);
          setPets(data);
          setFilteredPets(data);
        }
      } catch (err) {
        console.error('Error loading pets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPets();
  }, [status, selectedCity, viewMode]);

  const normalize = (str: string) => 
    str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

  useEffect(() => {
    const query = normalize(searchQuery);
    const cityQuery = normalize(selectedCity);

    const filtered = pets.filter(pet => {
      const petCity = pet.city || '';
      const petName = pet.name || pet.petName || '';
      const petDesc = pet.description || '';
      const petType = pet.species || pet.type || '';
      const petId = pet.petId || '';

      const matchesCity = !cityQuery || normalize(petCity).includes(cityQuery) || cityQuery.includes(normalize(petCity));
      const matchesSearch = !query || (
        normalize(petCity).includes(query) || 
        normalize(petName).includes(query) ||
        normalize(petDesc).includes(query) ||
        normalize(petType).includes(query) ||
        normalize(petId).includes(query)
      );
      return matchesCity && matchesSearch;
    });
    setFilteredPets(filtered);
  }, [searchQuery, selectedCity, pets]);

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      let d: Date;
      if (date.toDate) d = date.toDate();
      else if (date.seconds) d = new Date(date.seconds * 1000);
      else d = new Date(date);
      return format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch (e) {
      return '';
    }
  };

  const isCanil = profile?.companyType === 'canil';

  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  const handleDeleteSightedPet = (e: React.MouseEvent, petId: string) => {
    e.stopPropagation();
    setShowDeleteModal(petId);
  };

  const confirmDeleteSightedPet = async () => {
    if (!showDeleteModal) return;
    const petId = showDeleteModal;
    setShowDeleteModal(null);

    try {
      await petService.deletePet(petId);
      setPets(prev => prev.filter(p => p.id !== petId));
      setFilteredPets(prev => prev.filter(p => p.id !== petId));
    } catch (error) {
      console.error('Error deleting sighted pet:', error);
    }
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
                  <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                  <p className="text-sm text-gray-500">
                    {status === 'lost' ? (isCanil ? 'Gerencie os pets disponíveis para adoção.' : 'Ajude a encontrar pets perdidos na sua região.') : 
                     status === 'found' ? (isCanil ? 'Pets que já foram doados com sucesso.' : 'Pets que já voltaram para casa com segurança.') :
                     status === 'adoption' ? 'Encontre seu novo melhor amigo para adoção.' :
                     'Encontre seu novo melhor amigo.'}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <CityAutocomplete 
                  onCitySelect={(city, location) => {
                    setSelectedCity(city);
                    setMapCenter(location);
                  }}
                  defaultValue={selectedCity}
                />
                {selectedCity && (
                  <button 
                    onClick={() => {
                      setSelectedCity('');
                      setMapCenter(undefined);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors z-10"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => navigate(`/pets/${e.target.value}`)}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none cursor-pointer font-medium text-gray-700"
                >
                  <option value="lost">Pets Perdidos</option>
                  <option value="sighted">Pets Avistados</option>
                  <option value="found">Pets Encontrados</option>
                  <option value="adoption">Para Doação</option>
                  <option value="adopted">Doados</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
          {viewMode === 'map' ? (
            <div className="h-full w-full">
              <PetMap 
                pets={filteredPets} 
                center={mapCenter}
                onMarkerClick={(pet) => navigate(`/pet/${pet.petDocId || pet.id}`)}
                onDeletePet={(id) => {
                  setPets(prev => prev.filter(p => p.id !== id));
                  setFilteredPets(prev => prev.filter(p => p.id !== id));
                }}
                isCanil={isCanil}
              />
            </div>
          ) : (
            <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
              {loading ? (
                <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="font-medium">Buscando registros...</p>
                </div>
              ) : filteredPets.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
                  <p className="text-gray-500">
                    {searchQuery ? 'Nenhum resultado para sua busca.' : 'Nenhum pet encontrado.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {filteredPets.map(pet => (
                    <div 
                      key={pet.id}
                      className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col"
                    >
                      <div 
                        className="h-56 relative overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/pet/${pet.petDocId || pet.id}`)}
                      >
                        <img 
                          src={pet.petImageUrl || pet.imageUrl} 
                          alt={pet.petName || pet.name} 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-black text-gray-700 uppercase tracking-wider">
                          {pet.city}
                        </div>
                        {pet.petId && (
                          <div className="absolute bottom-4 right-4 px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
                            {pet.petId}
                          </div>
                        )}
                        {status === 'found' && (
                          <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            {getTranslation('foundEx', profile?.country, isCanil)}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-6 flex-1 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xl font-black text-gray-900">{pet.petName || pet.name || 'Pet sem nome'}</h3>
                            <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                              <Calendar size={14} />
                              {status === 'found' ? `${getTranslation('foundAt', profile?.country, isCanil)}: ${formatDate(pet.foundAt)}` : formatDate(pet.createdAt)}
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-500 text-sm line-clamp-2 flex-1">{pet.description || (isCanil ? 'Este pet foi doado com sucesso!' : 'Este pet foi encontrado e devolvido ao seu dono com sucesso!')}</p>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => navigate(`/pet/${pet.petDocId || pet.id}`)}
                            className="flex-1 bg-gray-900 text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                          >
                            Ver Detalhes
                            <ArrowRight size={16} />
                          </button>
                          {currentUser?.uid === (pet.ownerId || pet.userId) && (pet.status === 'sighted' || pet.status === 'avistado') && (
                            <button 
                              onClick={(e) => handleDeleteSightedPet(e, pet.id)}
                              className="px-4 bg-red-50 text-red-600 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                              title="Excluir Registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setViewMode('map');
                              setMapCenter(pet.location);
                            }}
                            className="px-4 bg-emerald-50 text-emerald-600 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
                          >
                            <MapPin size={16} />
                            No Mapa
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900">Excluir Registro</h3>
                  <p className="text-gray-500">
                    Deseja realmente excluir este registro de pet avistado? Esta ação não pode ser desfeita.
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={confirmDeleteSightedPet}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-red-700 transition-all active:scale-95"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(null)}
                    className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
