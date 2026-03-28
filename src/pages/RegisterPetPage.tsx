import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { petService } from '../services/petService';
import { posterService } from '../services/posterService';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/userService';
import { PetType, PetStatus, PetSize, Pet, UserProfile } from '../types';
import { Layout } from '../components/Layout';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { motion } from 'framer-motion';

export const RegisterPetPage = () => {
  const { user, profile: authProfile } = useAuth();
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userPets, setUserPets] = useState<Pet[]>([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showLostModal, setShowLostModal] = useState<Pet | null>(null);
  const [lostObservations, setLostObservations] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    species: 'dog',
    breed: '',
    size: 'unknown' as PetSize,
    sex: 'male' as 'male' | 'female',
    birthDate: '',
    color: '',
    description: '',
    lostObservations: '',
    city: '',
    location: { lat: -23.5505, lng: -46.6333 }, // Default to SP
    contactPhone: '',
    status: 'seguro' as PetStatus,
  });

  const isLostMode = (type === 'lost' || formData.status === 'lost' || formData.status === 'perdido') && authProfile?.companyType !== 'canil';

  // Fetch user pets if type is lost
  useEffect(() => {
    if (user) {
      userService.getUserProfile(user.uid).then(p => {
        setProfile(p);
        if (p) {
          setFormData(prev => ({
            ...prev,
            city: prev.city || p.cidade || '',
            contactPhone: prev.contactPhone || p.phone || '',
          }));
        }
      });
    }
    if (type === 'lost' && user) {
      setLoadingPets(true);
      petService.getUserPets(user.uid).then(pets => {
        // Only show pets that are NOT already lost/sighted
        const safePets = pets.filter(p => p.status !== 'lost' && p.status !== 'perdido' && p.status !== 'sighted');
        setUserPets(safePets);
        setLoadingPets(false);
      });
    }
  }, [type, user]);

  // Update status if type changes
  useEffect(() => {
    const isCanil = authProfile?.companyType === 'canil';
    if (type === 'sighted' && !isCanil) {
      setFormData(prev => ({ ...prev, status: 'sighted' }));
    } else if (type === 'lost' && !isCanil) {
      setFormData(prev => ({ ...prev, status: 'lost' }));
    } else if (isCanil) {
      setFormData(prev => ({ ...prev, status: 'adoption' }));
    } else {
      setFormData(prev => ({ ...prev, status: 'seguro' }));
    }
  }, [type, authProfile]);

  const [isLocating, setIsLocating] = useState(false);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => {
          const newState = {
            ...prev,
            location: { lat: latitude, lng: longitude }
          };
          // If we have an image and a city (which might be updated by location or already present)
          if (type === 'sighted' && images.length > 0 && newState.city) {
            // AI comparison removed
          }
          return newState;
        });
        setIsLocating(false);
        alert('Localização atualizada com sucesso!');
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsLocating(false);
        alert('Não foi possível obter sua localização. Por favor, selecione a cidade manualmente.');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleMarkAsLost = async (pet: Pet) => {
    setLostObservations(pet.lostObservations || '');
    setShowLostModal(pet);
  };

  const confirmMarkAsLost = async () => {
    if (!showLostModal) return;
    if (!lostObservations.trim()) {
      alert('Por favor, preencha as Informações Adicionais para o cartaz.');
      return;
    }

    setLoading(true);
    const petToUpdate = showLostModal;
    setShowLostModal(null);

    try {
      await petService.updatePet(petToUpdate.id, {
        status: 'lost',
        lostObservations: lostObservations,
        isActive: true
      });
      
      navigate('/my-pets');
    } catch (error) {
      console.error('Error marking as lost:', error);
      alert('Erro ao atualizar status do pet.');
    } finally {
      setLoading(false);
      setLostObservations('');
    }
  };

  const handleCitySelect = (city: string, location: { lat: number; lng: number }) => {
    setFormData(prev => ({ ...prev, city, location }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      const remainingSlots = 5 - images.length;
      const newFiles = files.slice(0, remainingSlots);
      
      const updatedImages = [...images, ...newFiles];
      setImages(updatedImages);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      const updatedPreviews = [...previews, ...newPreviews];
      setPreviews(updatedPreviews);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    const newPreviews = [...previews];
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    setImages(newImages);
    setPreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mandatory fields validation
    const mandatoryFields = type === 'sighted' ? [
      { key: 'city', label: 'Cidade' },
      { key: 'contactPhone', label: 'WhatsApp para Contato' },
    ] : [
      { key: 'species', label: 'Espécie' },
      { key: 'breed', label: 'Raça' },
      { key: 'size', label: 'Porte' },
      { key: 'sex', label: 'Sexo' },
      { key: 'birthDate', label: 'Data de Nascimento' },
      { key: 'color', label: 'Cor' },
      { key: 'name', label: 'Nome do Pet' },
      { key: 'city', label: 'Cidade' },
      { key: 'contactPhone', label: 'WhatsApp para Contato' },
      { key: isLostMode ? 'lostObservations' : 'description', label: isLostMode ? 'Informações Adicionais' : 'Descrição' },
    ];

    const missingFields = mandatoryFields.filter(f => !formData[f.key as keyof typeof formData]);
    
    if (images.length === 0) {
      alert('Por favor, adicione pelo menos uma foto.');
      return;
    }

    if (missingFields.length > 0) {
      alert(`Por favor, preencha os campos obrigatórios: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      console.log('Iniciando cadastro do pet...', formData);
      const petId = await petService.createPet({
        ownerId: type === 'sighted' ? null : user.uid,
        userId: user.uid,
        ownerType: type === 'sighted' ? null : (profile?.companyType || null),
        ownerCpf: type === 'sighted' ? '' : (profile?.cpf || profile?.rg || ''),
        type: (type === 'sighted' ? 'other' : formData.species) as any,
        species: type === 'sighted' ? undefined : formData.species,
        name: type === 'sighted' ? 'Pet Avistado' : formData.name,
        breed: type === 'sighted' ? undefined : (formData.breed || 'Desconhecido'),
        size: type === 'sighted' ? undefined : formData.size,
        sex: type === 'sighted' ? undefined : formData.sex,
        birthDate: type === 'sighted' ? null : (formData.birthDate ? new Date(formData.birthDate) : null),
        color: type === 'sighted' ? undefined : formData.color,
        description: type === 'sighted' ? 'Pet avistado na rua.' : formData.description,
        lostObservations: formData.lostObservations,
        status: type === 'sighted' ? 'sighted' : (type === 'lost' ? 'lost' : 'seguro'),
        location: formData.location,
        city: formData.city,
        imageUrl: '', // Will be set by service
        contactPhone: formData.contactPhone,
      }, images);

      console.log('Pet cadastrado com sucesso! ID:', petId);
      
      navigate(type === 'sighted' ? '/' : '/my-pets');
    } catch (error: any) {
      console.error('Erro detalhado ao cadastrar pet:', error);
      alert(`Erro ao cadastrar pet: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = type === 'sighted' ? 'Pet Avistado' : 
                   type === 'lost' ? 'Registrar Pet Perdido' : 'Registrar Meu Pet';

  return (
    <Layout 
      title={pageTitle}
      leftElement={
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
      }
    >
      <div className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
        {type === 'lost' && authProfile?.companyType !== 'canil' && userPets.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle size={20} />
              <h2 className="font-bold">Seu pet já está cadastrado?</h2>
            </div>
            <p className="text-sm text-gray-500">Selecione um pet abaixo para marcá-lo como perdido rapidamente:</p>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
              {userPets.map(pet => (
                <button
                  key={pet.id}
                  onClick={() => handleMarkAsLost(pet)}
                  className="flex-shrink-0 w-32 group text-left"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden mb-2 relative border-2 border-transparent group-hover:border-red-500 transition-all shadow-sm">
                    <img 
                      src={pet.imageUrl} 
                      alt={pet.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">Marcar Perdido</span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-gray-900 truncate">{pet.name || 'Sem nome'}</p>
                  <p className="text-[10px] text-gray-400 truncate">{pet.breed || pet.species}</p>
                </button>
              ))}
            </div>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-50 px-2 text-gray-400 font-bold">Ou cadastre um novo</span>
              </div>
            </div>
          </section>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-4">
            {type !== 'sighted' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as PetStatus;
                    setFormData({...formData, status: newStatus});
                    if (newStatus === 'lost' || newStatus === 'perdido') {
                      setTimeout(() => {
                        const element = document.getElementById('lostObservations');
                        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element?.focus();
                      }, 100);
                    }
                  }}
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {authProfile?.companyType === 'canil' ? (
                    <>
                      <option value="adoption">Para Doação</option>
                      <option value="adopted">Doado</option>
                    </>
                  ) : (
                    <>
                      <option value="lost">Perdido</option>
                      <option value="found">Encontrado</option>
                      <option value="sighted">Avistado</option>
                      {formData.status !== 'sighted' && formData.status !== 'avistado' && (
                        <>
                          <option value="adoption">Para Doação</option>
                          <option value="adopted">Doado</option>
                        </>
                      )}
                    </>
                  )}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group">
                  <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowLeft size={16} className="rotate-45" />
                  </button>
                </div>
              ))}
              {previews.length < 5 && (
                <label className="aspect-square bg-gray-200 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors">
                  <Camera size={32} className="text-gray-400 mb-1" />
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Adicionar Foto</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center">Você pode adicionar até 5 fotos.</p>
          </div>

          {type !== 'sighted' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Espécie *</label>
                <select 
                  value={formData.species}
                  onChange={(e) => setFormData({...formData, species: e.target.value})}
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="dog">Cachorro</option>
                  <option value="cat">Gato</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Raça *</label>
                  <input 
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({...formData, breed: e.target.value})}
                    placeholder="Ex: Poodle"
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Porte *</label>
                  <select 
                    value={formData.size}
                    onChange={(e) => setFormData({...formData, size: e.target.value as any})}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="unknown">Não sei</option>
                    <option value="small">Pequeno</option>
                    <option value="medium">Médio</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sexo *</label>
                  <select 
                    value={formData.sex}
                    onChange={(e) => setFormData({...formData, sex: e.target.value as any})}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="male">Macho</option>
                    <option value="female">Fêmea</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento *</label>
                  <input 
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cor *</label>
                  <input 
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    placeholder="Ex: Branco e Marrom"
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome do Pet *</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Totó"
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade *</label>
                <CityAutocomplete onCitySelect={handleCitySelect} defaultValue={formData.city} />
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="mt-2 flex items-center gap-2 text-emerald-600 text-xs font-bold hover:text-emerald-700 transition-colors"
                >
                  {isLocating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MapPin size={14} />
                  )}
                  <span>USAR MINHA LOCALIZAÇÃO ATUAL</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp para Contato (com DDD)</label>
                <input 
                  type="tel"
                  required
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                  placeholder="Ex: 11999999999"
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {isLostMode ? 'Informações Adicionais (Importante para o Cartaz) *' : 'Descrição / Observações *'}
                </label>
                <textarea 
                  id="lostObservations"
                  rows={4}
                  value={isLostMode ? formData.lostObservations : formData.description}
                  onChange={(e) => setFormData({
                    ...formData, 
                    [isLostMode ? 'lostObservations' : 'description']: e.target.value
                  })}
                  placeholder={isLostMode 
                    ? "Preencha com informações como: proximidade que o pet foi perdido, horário e demais detalhes relevantes, pois estas informações irão aparecer no cartaz."
                    : "Descreva características marcantes..."
                  }
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
                {isLostMode && (
                  <p className="text-[10px] text-amber-600 mt-1 font-bold uppercase">
                    Atenção: Estas informações são cruciais para quem encontrar seu pet!
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade onde foi avistado *</label>
                <CityAutocomplete onCitySelect={handleCitySelect} defaultValue={formData.city} />
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="mt-2 flex items-center gap-2 text-emerald-600 text-xs font-bold hover:text-emerald-700 transition-colors"
                >
                  {isLocating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MapPin size={14} />
                  )}
                  <span>USAR MINHA LOCALIZAÇÃO ATUAL</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu WhatsApp para Contato (com DDD) *</label>
                <input 
                  type="tel"
                  required
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                  placeholder="Ex: 11999999999"
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || images.length === 0}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Cadastrar Pet'}
          </button>
        </form>
      </div>

      {/* Mark as Lost Modal */}
      {showLostModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
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
                  <p className="text-[10px] text-amber-600 mt-2 font-bold uppercase flex items-center gap-1">
                    <AlertCircle size={10} />
                    Estas informações aparecerão no cartaz de busca.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={confirmMarkAsLost}
                  disabled={loading}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Confirmar'}
                </button>
                <button
                  onClick={() => {
                    setShowLostModal(null);
                    setLostObservations('');
                  }}
                  disabled={loading}
                  className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
