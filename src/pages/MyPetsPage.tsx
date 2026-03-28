import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Edit2, Trash2, CheckCircle, AlertCircle, Loader2, Plus, ExternalLink, ArrowLeft, MapPin, List as ListIcon, Search, Clipboard, MessageCircle, Heart, CheckCircle2, Share2 } from 'lucide-react';
import { petService } from '../services/petService';
import { userService } from '../services/userService';
import { Pet, UserProfile, MedicalRecord, PetStatus } from '../types';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { getStatusLabel } from '../utils/translations';
import { PetMap } from '../components/PetMap';
import { motion, AnimatePresence } from 'motion/react';

export const MyPetsPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLostModal, setShowLostModal] = useState<Pet | null>(null);
  const [lostObservations, setLostObservations] = useState('');
  
  // Clinic specific states
  const isClinic = (profile?.role === 'parceiro' || profile?.role === 'empresa') && profile?.companyType !== 'canil';
  const isCanil = profile?.companyType === 'canil';
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [cityFilter, setCityFilter] = useState('');
  const [patientData, setPatientData] = useState<Record<string, { tutor: UserProfile | null, lastRecord: MedicalRecord | null }>>({});

  const fetchUserPets = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let data: Pet[] = [];
      if (isCanil) {
        data = await petService.getUserPets(user.uid);
      } else if (isClinic) {
        data = await petService.getClinicPatients(user.uid);
        
        // Fetch extra data for patients
        const extraData: Record<string, { tutor: UserProfile | null, lastRecord: MedicalRecord | null }> = {};
        await Promise.all(data.map(async (pet) => {
          try {
            const [tutor, records] = await Promise.all([
              userService.getUserProfile(pet.ownerId || pet.userId),
              petService.getMedicalRecords(pet.id)
            ]);
            extraData[pet.id] = {
              tutor,
              lastRecord: records[0] || null
            };
          } catch (e) {
            console.error(`Error fetching extra data for pet ${pet.id}:`, e);
          }
        }));
        setPatientData(extraData);
      } else {
        data = await petService.getUserPets(user.uid);
      }
      setPets(data);
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserPets();
    }
  }, [user, isClinic]);

  const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const filteredPets = pets.filter(pet => {
    if (!cityFilter) return true;
    const search = normalizeString(cityFilter);
    const petCity = normalizeString(pet.city || '');
    const petName = normalizeString(pet.name || '');
    const petId = normalizeString(pet.petId || '');
    
    return petCity.includes(search) || petName.includes(search) || petId.includes(search);
  });

  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setShowDeleteModal(id);
  };

  const confirmDelete = async () => {
    if (!showDeleteModal) return;
    const id = showDeleteModal;
    setShowDeleteModal(null);
    
    setActionLoading(id);
    try {
      if (isClinic) {
        await petService.hidePetFromClinic(id, user!.uid);
      } else {
        await petService.deletePet(id);
      }
      setPets(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting pet:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const [showAdoptionModal, setShowAdoptionModal] = useState<Pet | null>(null);
  const [showAdoptedModal, setShowAdoptedModal] = useState<Pet | null>(null);
  const [showFoundModal, setShowFoundModal] = useState<Pet | null>(null);

  const handleToggleStatus = async (pet: Pet) => {
    if (isCanil) {
      if (pet.status === 'adoption') {
        setShowAdoptedModal(pet);
      } else {
        setShowAdoptionModal(pet);
      }
      return;
    }

    const isCurrentlyLost = pet.status === 'perdido' || pet.status === 'lost' || pet.status === 'sighted' || pet.status === 'avistado';
    
    if (!isCurrentlyLost) {
      setLostObservations(pet.lostObservations || '');
      setShowLostModal(pet);
      return;
    }

    setShowFoundModal(pet);
  };

  const confirmStatusChange = async (pet: Pet, newStatus: PetStatus) => {
    setShowAdoptionModal(null);
    setShowAdoptedModal(null);
    setShowFoundModal(null);
    setActionLoading(pet.id);
    try {
      await petService.updatePetStatus(pet.id, newStatus, isCanil);
      const isActive = newStatus === 'adoption' || newStatus === 'perdido' || newStatus === 'lost';
      setPets(prev => prev.map(p => p.id === pet.id ? { ...p, status: newStatus, isActive } : p));
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleShare = async (pet: Pet) => {
    const shareData = {
      title: `Petmaps - ${pet.name || 'Pet'}`,
      text: `Conheça o ${pet.name || 'pet'} que está para doação! ID: ${pet.petId}`,
      url: `${window.location.origin}/pet/${pet.petId}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/pet/${pet.petId}`);
        alert('Link copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const confirmMarkAsLost = async () => {
    if (!showLostModal) return;
    if (!lostObservations.trim()) {
      alert('Por favor, preencha as Informações Adicionais para o cartaz.');
      return;
    }

    setActionLoading(showLostModal.id);
    const petToUpdate = showLostModal;
    setShowLostModal(null);

    try {
      await petService.updatePet(petToUpdate.id, {
        status: 'lost',
        lostObservations: lostObservations,
        isActive: true
      });
      
      setPets(prev => prev.map(p => p.id === petToUpdate.id ? { ...p, status: 'lost', lostObservations, isActive: true } : p));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    } finally {
      setActionLoading(null);
      setLostObservations('');
    }
  };

  const calculateAge = (birthDate: any) => {
    if (!birthDate) return 'Idade não informada';
    try {
      let date: Date;
      if (typeof birthDate.toDate === 'function') {
        date = birthDate.toDate();
      } else if (birthDate instanceof Date) {
        date = birthDate;
      } else {
        date = new Date(birthDate);
      }
      
      if (isNaN(date.getTime())) return 'Idade não informada';
      
      const age = new Date().getFullYear() - date.getFullYear();
      if (age < 0) return 'Recém-nascido';
      return `${age} ${age === 1 ? 'ano' : 'anos'}`;
    } catch (e) {
      return 'Idade não informada';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      let d: Date;
      if (date.toDate) d = date.toDate();
      else if (date.seconds) d = new Date(date.seconds * 1000);
      else d = new Date(date);
      return new Intl.DateTimeFormat('pt-BR').format(d);
    } catch (e) {
      return '';
    }
  };

  const pageTitle = isCanil ? 'Meus Pets' : isClinic ? 'Meus Pacientes' : 'Meus Pets';
  const pageDescription = isCanil ? 'Gerencie seus pets para doação.' : isClinic ? 'Gerencie os pacientes atendidos por sua clínica.' : 'Gerencie seus pets cadastrados.';

  return (
    <Layout title={pageTitle}>
      <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
        <div className="p-6 max-w-5xl mx-auto w-full flex flex-col h-full overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                <ArrowLeft size={24} className="text-gray-600" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{pageTitle}</h2>
                <p className="text-gray-500 text-sm">{pageDescription}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${viewMode === 'list' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <ListIcon size={18} />
                  <span>Lista</span>
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${viewMode === 'map' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <MapPin size={18} />
                  <span>Mapa</span>
                </button>
              </div>

              {(!isClinic || isCanil) && (
                <Link 
                  to="/register"
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-all transform hover:scale-105 active:scale-95"
                >
                  <Plus size={20} />
                  <span>Adicionar Pet</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {loading ? (
              <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                <p className="font-medium">Carregando...</p>
              </div>
            ) : filteredPets.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-[2rem] shadow-sm border-2 border-dashed border-gray-200">
                <p className="text-gray-500 mb-4">
                  {isCanil ? 'Nenhum pet encontrado para doação.' : isClinic ? 'Nenhum paciente encontrado.' : 'Você ainda não possui nenhum pet cadastrado.'}
                </p>
                {(!isClinic || isCanil) && (
                  <Link 
                    to="/register"
                    className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-600 transition-colors"
                  >
                    {isCanil ? 'Cadastrar pet para doação' : 'Cadastrar meu primeiro pet'}
                  </Link>
                )}
              </div>
            ) : viewMode === 'map' ? (
              <div className="h-full rounded-[2rem] overflow-hidden shadow-xl border border-gray-100">
                <PetMap 
                  pets={filteredPets}
                  onMarkerClick={(pet) => navigate(isCanil ? `/pet/${pet.petId}` : `/professional?search=${pet.petId}`)}
                  onDeletePet={(id) => setPets(prev => prev.filter(p => p.id !== id))}
                  isCanil={isCanil}
                />
              </div>
            ) : (
              <div className="h-full overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
                {filteredPets.map(pet => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={pet.id}
                    className="bg-white rounded-[2rem] p-5 shadow-sm flex flex-col md:flex-row gap-6 items-center border border-gray-100 hover:shadow-md transition-all"
                  >
                    <div className="w-full md:w-32 h-32 rounded-2xl overflow-hidden shrink-0 shadow-sm">
                      <img 
                        src={pet.imageUrl} 
                        alt={pet.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-1">
                      <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-2">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold tracking-wider">
                          {pet.petId}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold tracking-wider">
                          {pet.city}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white ${
                          pet.status === 'lost' || pet.status === 'perdido' ? 'bg-red-500' : 
                          pet.status === 'found' || pet.status === 'foundowner' ? 'bg-emerald-500' : 
                          pet.status === 'adoption' ? 'bg-purple-500' :
                          pet.status === 'adopted' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`}>
                          {getStatusLabel(pet.status, profile?.country, isCanil)}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-gray-900">{pet.name || 'Pet sem nome'}</h3>
                      <p className="text-gray-500 text-sm">
                        {(pet.status === 'sighted' || pet.status === 'avistado') ? (
                          <span className="flex flex-col gap-1">
                            <span className="font-bold text-emerald-600">Registrado em: {formatDate(pet.createdAt)}</span>
                            <span className="italic line-clamp-1">{pet.description || 'Sem descrição'}</span>
                          </span>
                        ) : (
                          <>{pet.species || pet.type} • {pet.breed || 'SRD'} • {calculateAge(pet.birthDate)}</>
                        )}
                      </p>
                      
                      {isClinic && patientData[pet.id] && (
                        <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
                          <div className="flex items-center justify-center md:justify-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                              {patientData[pet.id].tutor?.fotoPerfil || patientData[pet.id].tutor?.photoURL ? (
                                <img src={patientData[pet.id].tutor?.fotoPerfil || patientData[pet.id].tutor?.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <AlertCircle size={14} />
                                </div>
                              )}
                            </div>
                            <div className="text-left">
                              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Tutor</p>
                              <p className="text-xs font-bold text-gray-700">{patientData[pet.id].tutor?.nome || 'Não identificado'}</p>
                            </div>
                          </div>
                          
                          {patientData[pet.id].lastRecord && (
                            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                              <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Clipboard size={10} />
                                Último Atendimento
                              </p>
                              <p className="text-xs font-medium text-emerald-800 line-clamp-1">
                                {patientData[pet.id].lastRecord?.diagnosis}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 shrink-0">
                      {isCanil ? (
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                          <div className="flex flex-row md:flex-col gap-2">
                            {pet.status !== 'adoption' && pet.status !== 'sighted' && pet.status !== 'avistado' ? (
                              <button
                                onClick={() => confirmStatusChange(pet, 'adoption')}
                                disabled={actionLoading === pet.id}
                                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
                              >
                                {actionLoading === pet.id ? <Loader2 className="animate-spin" size={18} /> : <Heart size={18} />}
                                <span className="text-xs">Para Doação</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => confirmStatusChange(pet, 'adopted')}
                                disabled={actionLoading === pet.id}
                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                              >
                                {actionLoading === pet.id ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                <span className="text-xs">Doado</span>
                              </button>
                            )}
                          </div>

                          <div className="flex flex-row gap-2 justify-center md:justify-start">
                            <button
                              onClick={() => handleShare(pet)}
                              className="p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-2xl transition-all"
                              title="Compartilhar"
                            >
                              <Share2 size={20} />
                            </button>

                            <button
                              onClick={() => navigate(`/pet/${pet.petId}`)}
                              className="p-3 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                              title="Ver Perfil (Vacinas e Histórico)"
                            >
                              <ExternalLink size={20} />
                            </button>

                            <button
                              onClick={() => navigate(`/edit-pet/${pet.id}`)}
                              className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-2xl transition-all"
                              title="Editar Cadastro"
                            >
                              <Edit2 size={20} />
                            </button>

                            <button
                              onClick={() => handleDelete(pet.id)}
                              className="p-3 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ) : isClinic ? (
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => navigate(`/professional?search=${pet.petId}`)}
                              className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                            >
                              <Clipboard size={18} />
                              <span>Prontuário</span>
                            </button>
                            {patientData[pet.id]?.tutor?.phone && (
                              <a
                                href={`https://wa.me/55${patientData[pet.id].tutor?.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 bg-white border-2 border-emerald-100 text-emerald-600 px-6 py-3 rounded-2xl font-bold shadow-sm hover:bg-emerald-50 transition-all active:scale-95"
                              >
                                <MessageCircle size={18} />
                                <span>Falar com Tutor</span>
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(pet.id)}
                              className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-bold hover:bg-red-100 transition-all active:scale-95"
                            >
                              <Trash2 size={18} />
                              <span>Excluir Paciente</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                          <div className="flex flex-row md:flex-col gap-2">
                            <button
                              onClick={() => handleToggleStatus(pet)}
                              disabled={actionLoading === pet.id}
                              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl transition-all ${
                                (pet.status === 'perdido' || pet.status === 'lost' || pet.status === 'sighted' || pet.status === 'avistado') 
                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                  : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                              title={(pet.status === 'lost' || pet.status === 'perdido' || pet.status === 'sighted' || pet.status === 'avistado') ? 'Marcar como Encontrado' : 'Marcar como Perdido'}
                            >
                              {actionLoading === pet.id ? <Loader2 className="animate-spin" size={20} /> : 
                               ((pet.status === 'perdido' || pet.status === 'lost' || pet.status === 'sighted' || pet.status === 'avistado') ? <CheckCircle size={20} /> : <AlertCircle size={20} />)}
                              <span className="text-xs font-bold">
                                {(pet.status === 'lost' || pet.status === 'perdido' || pet.status === 'sighted' || pet.status === 'avistado') ? 'Encontrado' : 'Perdido'}
                              </span>
                            </button>
                          </div>
                          
                          <div className="flex flex-row gap-2 justify-center md:justify-start">
                            <button
                              onClick={() => handleShare(pet)}
                              className="p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-2xl transition-all"
                              title="Compartilhar"
                            >
                              <Share2 size={20} />
                            </button>

                            <button
                              onClick={() => navigate(`/pet/${pet.petId || pet.id}`)}
                              className="p-3 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                              title="Ver Perfil"
                            >
                              <ExternalLink size={20} />
                            </button>

                            <button
                              onClick={() => navigate(`/edit-pet/${pet.id}`)}
                              className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-2xl transition-all"
                              title="Editar"
                            >
                              <Edit2 size={20} />
                            </button>

                            <button
                              onClick={() => handleDelete(pet.id)}
                              className="p-3 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{isClinic ? 'Excluir Paciente' : 'Excluir Cadastro'}</h3>
                    <p className="text-gray-500">
                      {isClinic 
                        ? 'Tem certeza que deseja remover este paciente do seu histórico? Esta ação não pode ser desfeita.'
                        : 'Tem certeza que deseja excluir este cadastro permanentemente? Esta ação não pode ser desfeita.'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={confirmDelete}
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
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Found Confirmation Modal */}
        <AnimatePresence>
          {showFoundModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">Marcar como Encontrado</h3>
                    <p className="text-gray-500">
                      Deseja marcar <strong>{showFoundModal.name}</strong> como ENCONTRADO? Ele não aparecerá mais no mapa de buscas.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={() => confirmStatusChange(showFoundModal, 'found')}
                      className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setShowFoundModal(null)}
                      className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Adoption Confirmation Modal */}
        <AnimatePresence>
          {showAdoptionModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">Colocar para Doação</h3>
                    <p className="text-gray-500">
                      Deseja colocar <strong>{showAdoptionModal.name}</strong> para DOAÇÃO? Ele aparecerá no mapa para possíveis adotantes.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={() => confirmStatusChange(showAdoptionModal, 'adoption')}
                      className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-purple-700 transition-all active:scale-95"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setShowAdoptionModal(null)}
                      className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Adopted Confirmation Modal */}
        <AnimatePresence>
          {showAdoptedModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">Marcar como Adotado</h3>
                    <p className="text-gray-500">
                      Deseja marcar <strong>{showAdoptedModal.name}</strong> como ADOTADO? Ele não aparecerá mais no mapa de doações.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={() => confirmStatusChange(showAdoptedModal, 'adopted')}
                      className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setShowAdoptedModal(null)}
                      className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Mark as Lost Modal */}
        <AnimatePresence>
          {showLostModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">Marcar como Perdido</h3>
                    <p className="text-gray-500">
                      Para gerar o cartaz de busca de <strong>{showLostModal.name}</strong>, precisamos de algumas informações adicionais.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                        Informações Adicionais (Para o Cartaz) *
                      </label>
                      <textarea
                        autoFocus
                        rows={5}
                        value={lostObservations}
                        onChange={(e) => setLostObservations(e.target.value)}
                        placeholder="Ex: Visto pela última vez perto da praça central às 14h. É dócil mas está assustado."
                        className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={confirmMarkAsLost}
                      disabled={actionLoading !== null}
                      className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionLoading ? <Loader2 className="animate-spin" /> : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => {
                        setShowLostModal(null);
                        setLostObservations('');
                      }}
                      disabled={actionLoading !== null}
                      className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
