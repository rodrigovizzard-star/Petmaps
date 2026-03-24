import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, X } from 'lucide-react';
import { petService } from '../services/petService';
import { posterService } from '../services/posterService';
import { useAuth } from '../hooks/useAuth';
import { PetType, PetStatus, PetSize, Pet } from '../types';
import { CityAutocomplete } from '../components/CityAutocomplete';

export const EditPetPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pet, setPet] = useState<Pet | null>(null);
  
  const [newImages, setNewImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    breed: '',
    size: 'unknown' as PetSize,
    sex: 'male' as 'male' | 'female',
    birthDate: '',
    color: '',
    description: '',
    lostObservations: '',
    type: 'dog' as PetType,
    city: '',
    location: { lat: -23.5505, lng: -46.6333 },
    contactPhone: '',
    status: 'lost' as PetStatus,
  });

  useEffect(() => {
    const fetchPet = async () => {
      if (id) {
        const data = await petService.getPetById(id);
        if (data) {
          if (user && data.userId !== user.uid && data.ownerId !== user.uid) {
            alert('Você não tem permissão para editar este pet.');
            navigate('/');
            return;
          }
          setPet(data);
          setExistingImageUrls(data.imageUrls || [data.imageUrl]);
          setFormData({
            name: data.name || '',
            breed: data.breed || '',
            size: data.size,
            sex: data.sex || 'male',
            birthDate: data.birthDate ? (data.birthDate.seconds ? new Date(data.birthDate.seconds * 1000).toISOString().split('T')[0] : new Date(data.birthDate).toISOString().split('T')[0]) : '',
            color: data.color || '',
            description: data.description,
            lostObservations: data.lostObservations || '',
            type: data.type,
            city: data.city || '',
            location: data.location,
            contactPhone: data.contactPhone || '',
            status: data.status,
          });
        }
        setLoading(false);
      }
    };
    fetchPet();
  }, [id, user, navigate]);

  const handleCitySelect = (city: string, location: { lat: number; lng: number }) => {
    setFormData(prev => ({ ...prev, city, location }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      const totalImages = existingImageUrls.length + newImages.length + files.length;
      if (totalImages > 5) {
        alert('Você pode ter no máximo 5 fotos.');
        return;
      }
      
      setNewImages([...newImages, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviews([...previews, ...newPreviews]);
    }
  };

  const removeExistingImage = (index: number) => {
    const updated = [...existingImageUrls];
    updated.splice(index, 1);
    setExistingImageUrls(updated);
  };

  const removeNewImage = (index: number) => {
    const updatedNew = [...newImages];
    const updatedPreviews = [...previews];
    updatedNew.splice(index, 1);
    updatedPreviews.splice(index, 1);
    setNewImages(updatedNew);
    setPreviews(updatedPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    const isLostMode = (formData.status === 'lost' || formData.status === 'perdido') && authProfile?.companyType !== 'canil';
    const mandatoryFields = [
      { key: 'type', label: 'Tipo de Pet' },
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

    if (missingFields.length > 0) {
      alert(`Por favor, preencha os campos obrigatórios: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    if (existingImageUrls.length === 0 && newImages.length === 0) {
      alert('O pet precisa de pelo menos uma foto.');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrls = [...existingImageUrls];

      // Upload new images if any
      if (newImages.length > 0) {
        // We need a service method to upload multiple images without creating a new pet
        // For now, let's assume we can use a helper or just do it here
        // But better to add it to petService
        const uploadedUrls = await petService.uploadImages(newImages);
        finalImageUrls = [...finalImageUrls, ...uploadedUrls];
      }

      const updatedPet = await petService.updatePet(id, {
        name: formData.name,
        breed: formData.breed,
        size: formData.size,
        sex: formData.sex,
        birthDate: formData.birthDate ? new Date(formData.birthDate) : null,
        color: formData.color,
        description: formData.description,
        lostObservations: formData.lostObservations,
        type: formData.type,
        city: formData.city,
        location: formData.location,
        contactPhone: formData.contactPhone,
        status: formData.status,
        imageUrl: finalImageUrls[0],
        imageUrls: finalImageUrls,
      });

      navigate(`/pet/${id}`);
    } catch (error: any) {
      console.error('Erro ao atualizar pet:', error);
      alert(`Erro ao atualizar pet: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!pet) return <div className="h-screen flex items-center justify-center">Pet não encontrado</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="p-4 bg-white border-b flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Editar Cadastro</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 max-w-md mx-auto w-full">
        {/* Images Section */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Fotos do Pet (Máx 5) *</label>
          <div className="grid grid-cols-3 gap-3">
            {existingImageUrls.map((url, index) => (
              <div key={`existing-${index}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                <img src={url} alt="Pet" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {previews.map((preview, index) => (
              <div key={`new-${index}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                <img src={preview} alt="New Pet" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewImage(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {(existingImageUrls.length + newImages.length) < 5 && (
              <label className="aspect-square bg-gray-200 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors">
                <Camera size={24} className="text-gray-400" />
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
              </label>
            )}
          </div>
        </div>

        <div className="space-y-4">
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
                  <option value="adoption">Para Doação</option>
                  <option value="adopted">Doado</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Pet *</label>
            <select 
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value as PetType})}
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade *</label>
            <CityAutocomplete onCitySelect={handleCitySelect} defaultValue={formData.city} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp para Contato *</label>
            <input 
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
              placeholder="Ex: 11999999999"
              className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição Geral (Fixa) *</label>
            <textarea 
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Descreva características marcantes..."
              className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>

          {(formData.status === 'lost' || formData.status === 'perdido') && authProfile?.companyType !== 'canil' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Informações Adicionais (Para o Cartaz) *</label>
              <textarea 
                id="lostObservations"
                rows={4}
                value={formData.lostObservations}
                onChange={(e) => setFormData({...formData, lostObservations: e.target.value})}
                placeholder="Informações específicas sobre o desaparecimento..."
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none resize-none"
              />
              <p className="text-[10px] text-amber-600 mt-1 font-bold uppercase">
                Atenção: Estas informações aparecem no cartaz de pet perdido.
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
        </button>
      </form>
    </div>
  );
};
