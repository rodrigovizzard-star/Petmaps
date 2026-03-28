import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, MessageCircle, Share2, Edit2, Trash2, CheckCircle2, AlertTriangle, Clipboard, Syringe, Info, Users, Download, Instagram, Smartphone, FileText, Sparkles, X, Save, ShieldCheck, User, ArrowRightLeft, Search, UserPlus, Heart } from 'lucide-react';
import { petService } from '../services/petService';
import { posterService } from '../services/posterService';
import { transferService } from '../services/transferService';
import { Pet, PetStatus, MedicalRecord, Vaccine, UserProfile } from '../types';
import { getStatusLabel } from '../utils/translations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatWhatsAppLink, maskCpf } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { userService } from '../services/userService';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { calculateDistance } from '../utils/geo';

import { Camera, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

import { Logo } from '../components/Logo';

export const PetDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPoster, setGeneratingPoster] = useState(false);
  const [generatedPosters, setGeneratedPosters] = useState<{ instagram: string; whatsapp: string; pdf: string } | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'vaccines'>('info');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [savingVaccine, setSavingVaccine] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [newVaccine, setNewVaccine] = useState({
    vaccineName: '',
    manufacturer: '',
    batch: '',
    applicationDate: format(new Date(), 'yyyy-MM-dd'),
    nextDose: '',
    veterinarianName: '',
    clinicName: '',
    notes: '',
  });
  const [newRecord, setNewRecord] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'Consulta' as MedicalRecord['type'],
    diagnosis: '',
    observations: '',
    veterinarian: '',
    clinicName: '',
  });
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [searchIdentifier, setSearchIdentifier] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [initiatingTransfer, setInitiatingTransfer] = useState(false);
  const [deleteModalType, setDeleteModalType] = useState<'sighted' | 'patient' | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchPet = async () => {
    if (id) {
      setLoading(true);
      try {
        // Try fetching by Petmaps ID first
        let data = await petService.getPetByPetId(id);
        if (!data) {
          // Fallback to Firestore ID
          data = await petService.getPetById(id);
        }
        
        if (data) {
          setPet(data);
          // Fetch owner profile
          const profile = await userService.getUserProfile(data.ownerId || data.userId);
          setOwnerProfile(profile);

          // Fetch records and vaccines
          try {
            const [medRecords, petVaccines] = await Promise.all([
              petService.getMedicalRecords(data.id),
              petService.getVaccines(data.id)
            ]);
            setRecords(medRecords);
            setVaccines(petVaccines);
          } catch (err) {
            console.error('Error fetching medical data:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching pet:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Data não informada';
    try {
      if (date instanceof Date) return format(date, "dd/MM/yyyy");
      if (date.toDate && typeof date.toDate === 'function') return format(date.toDate(), "dd/MM/yyyy");
      if (date.seconds) return format(new Date(date.seconds * 1000), "dd/MM/yyyy");
      return format(new Date(date), "dd/MM/yyyy");
    } catch (e) {
      return 'Data inválida';
    }
  };

  const formatDateLong = (date: any) => {
    if (!date) return 'Data não informada';
    try {
      let d: Date;
      if (date instanceof Date) d = date;
      else if (date.toDate && typeof date.toDate === 'function') d = date.toDate();
      else if (date.seconds) d = new Date(date.seconds * 1000);
      else d = new Date(date);
      
      return format(d, "dd 'de' MMMM, yyyy", { locale: ptBR });
    } catch (e) {
      return 'Data inválida';
    }
  };

  const handleMarkAsLost = async () => {
    const isAdoption = isCanil && (pet?.status === 'adopted' || pet?.status === 'doado' || !pet?.status);
    const confirmMsg = isAdoption ? 'Deseja colocar este pet para doação?' : 'Deseja marcar este pet como perdido?';
    if (!pet || !window.confirm(confirmMsg)) return;
    
    setLoading(true);
    try {
      await petService.updatePetStatus(pet.id, isAdoption ? 'adoption' : 'lost');
      
      await fetchPet();
      alert(isAdoption ? 'Pet colocado para doação com sucesso!' : 'Pet marcado como perdido com sucesso!');
    } catch (error) {
      console.error('Error marking as lost:', error);
      alert('Erro ao atualizar status.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsFound = async () => {
    const isAdoption = pet?.status === 'adoption' || pet?.status === 'adocao';
    const confirmMsg = isAdoption ? 'Deseja marcar este pet como doado?' : 'Deseja marcar este pet como encontrado?';
    if (!pet || !window.confirm(confirmMsg)) return;
    
    setLoading(true);
    try {
      await petService.updatePetStatus(pet.id, isAdoption ? 'doado' : 'found');
      await fetchPet();
      alert(isAdoption ? 'Parabéns! O pet foi marcado como doado.' : 'Parabéns! Ficamos felizes que o pet foi encontrado.');
    } catch (error) {
      console.error('Error marking as found:', error);
      alert('Erro ao atualizar status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPet();
  }, [id]);

  useEffect(() => {
    if (location.state && pet) {
      const state = location.state as any;
      let handled = false;

      if (state.openVaccineModal) {
        setActiveTab('vaccines');
        setShowAddVaccine(true);
        handled = true;
      } else if (state.openMedicalModal) {
        setActiveTab('history');
        setShowAddRecord(true);
        handled = true;
      }

      if (handled) {
        // Clear state to avoid reopening on refresh/back
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, pet, navigate, location.pathname]);

  const handleGeneratePoster = async () => {
    if (!pet) return;
    setGeneratingPoster(true);
    try {
      console.log('PetDetailsPage: Iniciando geração de cartaz para pet:', pet);
      const { whatsapp, pdf } = await posterService.generatePosters(pet, ownerProfile?.country);
      
      const whatsappUrl = URL.createObjectURL(whatsapp);
      const pdfUrl = URL.createObjectURL(pdf);
      
      setGeneratedPosters({
        whatsapp: whatsappUrl,
        pdf: pdfUrl
      });
      
      alert('Cartazes gerados com sucesso! Você já pode baixar as versões para redes sociais e impressão.');
    } catch (err: any) {
      console.error('PetDetailsPage: Erro ao gerar cartaz:', err);
      alert(`Não foi possível gerar o cartaz: ${err.message || 'Erro desconhecido'}. Tente novamente ou verifique sua conexão.`);
    } finally {
      setGeneratingPoster(false);
    }
  };

  const downloadPoster = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSharePoster = async () => {
    const posterUrl = generatedPosters?.whatsapp || pet?.posterStoryUrl;
    if (!posterUrl) return;
    
    try {
      const response = await fetch(posterUrl);
      const blob = await response.blob();
      const file = new File([blob], 'pet-perdido.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Pet Perdido',
          text: `Ajude a encontrar o ${pet?.name || 'pet'}! ID: ${pet?.petId}`,
        });
      } else {
        downloadPoster(posterUrl, 'pet-perdido.png');
      }
    } catch (err) {
      console.error('Error sharing poster:', err);
      downloadPoster(posterUrl, 'pet-perdido.png');
    }
  };

  const shareOnWhatsApp = () => {
    if (!pet) return;
    const isSighted = pet.status === 'sighted' || pet.status === 'avistado';
    const petName = pet.name || 'este pet';
    const idText = pet.petId ? ` ID: ${pet.petId}` : '';
    const message = isSighted 
      ? `Vi um pet avistado em ${pet.city}!${idText}\nVeja os detalhes: ${window.location.href}`
      : `Ajude a encontrar o ${petName}!${idText}\nVeja o perfil: ${window.location.href}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareOnFacebook = () => {
    if (!pet) return;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const handleShare = async () => {
    if (!pet) return;
    const isSighted = pet.status === 'sighted' || pet.status === 'avistado';
    const petName = pet.name || 'Pet';
    const idText = pet.petId ? ` ID: ${pet.petId}` : '';
    
    const shareData = {
      title: `Petmaps - ${petName}`,
      text: isSighted 
        ? `Pet avistado em ${pet.city}!${idText}`
        : `Ajude a encontrar o ${petName}!${idText}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet || !currentUser) return;

    setSavingVaccine(true);
    try {
      const vaccineData: Omit<Vaccine, 'id' | 'createdAt'> = {
        vaccineName: newVaccine.vaccineName,
        manufacturer: newVaccine.manufacturer,
        batch: newVaccine.batch,
        applicationDate: new Date(newVaccine.applicationDate),
        nextDose: newVaccine.nextDose ? new Date(newVaccine.nextDose) : null,
        veterinarianName: newVaccine.veterinarianName,
        clinicName: newVaccine.clinicName,
        clinicId: currentUser.uid,
        notes: newVaccine.notes,
        createdBy: 'tutor', // Tutors use this modal
      };

      await petService.addVaccine(pet.id, vaccineData);
      await fetchPet();
      setShowAddVaccine(false);
      setNewVaccine({
        vaccineName: '',
        manufacturer: '',
        batch: '',
        applicationDate: format(new Date(), 'yyyy-MM-dd'),
        nextDose: '',
        veterinarianName: '',
        clinicName: '',
        notes: '',
      });
      alert('Vacina registrada com sucesso!');
    } catch (error) {
      console.error('Error adding vaccine:', error);
      alert('Erro ao registrar vacina.');
    } finally {
      setSavingVaccine(false);
    }
  };

  const handleUpdateVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet || !editingVaccine) return;

    setSavingVaccine(true);
    try {
      const vaccineData: Partial<Vaccine> = {
        vaccineName: newVaccine.vaccineName,
        manufacturer: newVaccine.manufacturer,
        batch: newVaccine.batch,
        applicationDate: new Date(newVaccine.applicationDate),
        nextDose: newVaccine.nextDose ? new Date(newVaccine.nextDose) : null,
        veterinarianName: newVaccine.veterinarianName,
        clinicName: newVaccine.clinicName,
        notes: newVaccine.notes,
      };

      await petService.updateVaccine(pet.id, editingVaccine.id, vaccineData);
      await fetchPet();
      setEditingVaccine(null);
      alert('Vacina atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating vaccine:', error);
      alert('Erro ao atualizar vacina.');
    } finally {
      setSavingVaccine(false);
    }
  };


  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet || !currentUser) return;

    setSavingRecord(true);
    try {
      const recordData: Omit<MedicalRecord, 'id' | 'createdAt'> = {
        date: new Date(newRecord.date),
        type: newRecord.type as any,
        diagnosis: newRecord.diagnosis,
        observations: newRecord.observations,
        veterinarian: newRecord.veterinarian,
        clinicName: newRecord.clinicName,
        clinicId: currentUser.uid,
        createdBy: 'tutor',
      };

      await petService.addMedicalRecord(pet.id, recordData);
      await fetchPet();
      setShowAddRecord(false);
      setNewRecord({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'Consulta',
        diagnosis: '',
        observations: '',
        veterinarian: '',
        clinicName: '',
      });
      alert('Registro médico adicionado com sucesso!');
    } catch (error) {
      console.error('Error adding medical record:', error);
      alert('Erro ao adicionar registro médico.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet || !editingRecord) return;

    setSavingRecord(true);
    try {
      const recordData: Partial<MedicalRecord> = {
        date: new Date(newRecord.date),
        type: newRecord.type as any,
        diagnosis: newRecord.diagnosis,
        observations: newRecord.observations,
        veterinarian: newRecord.veterinarian,
        clinicName: newRecord.clinicName,
      };

      await petService.updateMedicalRecord(pet.id, editingRecord.id, recordData);
      await fetchPet();
      setEditingRecord(null);
      alert('Registro médico atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating medical record:', error);
      alert('Erro ao atualizar registro médico.');
    } finally {
      setSavingRecord(false);
    }
  };


  const generateVaccinationPDF = async () => {
    if (!pet) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(16, 185, 129); // Emerald 600
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('CARTEIRA DE VACINAÇÃO', pageWidth / 2, 25, { align: 'center' });

    // Pet Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('INFORMAÇÕES DO PET', 14, 50);
    doc.setLineWidth(0.5);
    doc.line(14, 52, pageWidth - 14, 52);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const petInfo = [
      ['Petmaps ID:', pet.petId],
      ['Nome:', pet.name || 'N/A'],
      ['Espécie:', pet.species || pet.type],
      ['Raça:', pet.breed || 'SRD'],
      ['Sexo:', pet.sex === 'male' ? 'Macho' : pet.sex === 'female' ? 'Fêmea' : 'N/A'],
      ['Nascimento:', formatDate(pet.birthDate)],
      ['Cor:', pet.color || 'N/A'],
    ];

    let y = 60;
    petInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 50, y);
      y += 7;
    });

    // Tutor Info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMAÇÕES DO TUTOR', 110, 50);
    doc.setFontSize(10);
    const tutorInfo = [
      ['Nome:', ownerProfile?.nome || 'N/A'],
      ['Telefone:', pet.contactPhone || ownerProfile?.phone || 'N/A'],
      ['Cidade:', pet.city || ownerProfile?.cidade || 'N/A'],
    ];

    y = 60;
    tutorInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 110, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 135, y);
      y += 7;
    });

    // QR Code
    try {
      const qrCodeUrl = await QRCode.toDataURL(window.location.href);
      doc.addImage(qrCodeUrl, 'PNG', pageWidth - 45, 10, 30, 30);
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('Acesse o perfil', pageWidth - 30, 45, { align: 'center' });
    } catch (err) {
      console.error('Error generating QR code for PDF:', err);
    }

    // Vaccines Table
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTÓRICO DE VACINAS', 14, 120);
    
    const tableData = vaccines.map(v => [
      v.vaccineName,
      v.manufacturer || 'N/A',
      v.batch || 'N/A',
      formatDate(v.applicationDate),
      formatDate(v.nextDose),
      v.veterinarianName || 'N/A',
      v.clinicName || 'N/A',
      v.createdBy === 'professional' ? 'Profissional' : 'Tutor'
    ]);

    autoTable(doc, {
      startY: 125,
      head: [['Vacina', 'Fabricante', 'Lote', 'Data', 'Próxima', 'Vet', 'Clínica', 'Tipo']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
    });

    doc.save(`carteira_vacinacao_${pet.name || pet.petId}.pdf`);
  };

  const handleSearchUser = async () => {
    if (!searchIdentifier.trim()) return;
    setSearchingUser(true);
    setFoundUser(null);
    try {
      const profile = await userService.getUserByCpfOrRg(searchIdentifier);
      if (profile) {
        if (profile.uid === currentUser?.uid) {
          alert('Você não pode transferir o pet para você mesmo.');
        } else {
          setFoundUser(profile);
        }
      } else {
        alert('Usuário não encontrado com este CPF ou RG.');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      alert('Erro ao buscar usuário.');
    } finally {
      setSearchingUser(false);
    }
  };

  const handleInitiateTransfer = async () => {
    if (!pet || !foundUser || !currentUser || !ownerProfile) return;
    
    setInitiatingTransfer(true);
    try {
      await transferService.createTransferRequest(
        pet.id,
        pet.name || 'Pet sem nome',
        currentUser.uid,
        ownerProfile.nome || 'Tutor',
        foundUser.uid,
        foundUser.nome
      );
      alert(`Solicitação de transferência enviada para ${foundUser.nome}! O novo tutor precisa aceitar no aplicativo dele.`);
      setShowTransferModal(false);
      setSearchIdentifier('');
      setFoundUser(null);
    } catch (error: any) {
      console.error('Error initiating transfer:', error);
      alert(error.message || 'Erro ao iniciar transferência.');
    } finally {
      setInitiatingTransfer(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <Loader2 className="animate-spin text-emerald-600" size={48} />
      <p className="text-gray-500 font-medium">Carregando informações...</p>
    </div>
  );

  if (!pet) return (
    <div className="h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
      <div className="w-24 h-24 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle size={48} />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-2">Pet não encontrado</h2>
      <p className="text-gray-500 mb-8 max-w-xs">Não conseguimos localizar nenhum pet com o ID informado. Verifique se o código está correto.</p>
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
      >
        <ArrowLeft size={20} />
        Voltar
      </button>
    </div>
  );

  const statusColors: Record<string, string> = {
    lost: 'bg-red-500',
    perdido: 'bg-red-500',
    sighted: 'bg-orange-500',
    avistado: 'bg-orange-500',
    found: 'bg-emerald-500',
    seguro: 'bg-emerald-500',
    safe: 'bg-emerald-500',
    foundOwner: 'bg-emerald-500',
    adoption: 'bg-purple-500',
    adopted: 'bg-blue-500'
  };

  const isCanil = currentProfile?.companyType === 'canil';
  const isClinic = (currentProfile?.role === 'parceiro' || currentProfile?.role === 'empresa') && currentProfile?.companyType !== 'canil';

  const handleDeletePatient = () => {
    if (!pet || !currentUser || !isClinic) return;
    setDeleteModalType('patient');
  };

  const confirmDeletePatient = async () => {
    setDeleteModalType(null);
    setLoading(true);
    try {
      await petService.hidePetFromClinic(pet.id, currentUser.uid);
      navigate('/meus-pets');
    } catch (error) {
      console.error('Error hiding pet from clinic:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = {
    text: getStatusLabel(pet.status, currentProfile?.country, isCanil),
    color: statusColors[pet.status] || 'bg-gray-500'
  };

  const isOwner = currentUser?.uid === (pet.ownerId || pet.userId);
  const isSighted = pet.status === 'sighted' || pet.status === 'avistado';

  const handleDeleteSightedPet = () => {
    if (!pet || !currentUser || !isSighted) return;
    setDeleteModalType('sighted');
  };

  const confirmDeleteSightedPet = async () => {
    setDeleteModalType(null);
    setLoading(true);
    try {
      await petService.deletePet(pet.id);
      navigate('/pets/sighted');
    } catch (error) {
      console.error('Error deleting sighted pet:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
      <div className="relative h-96 shrink-0 bg-gray-200">
        <img 
          src={Array.isArray(pet.imageUrls) && pet.imageUrls.length > 0 ? pet.imageUrls[currentImageIndex] : pet.imageUrl} 
          alt={pet.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        
        {Array.isArray(pet.imageUrls) && pet.imageUrls.length > 1 && (
          <div className="absolute bottom-6 right-6 flex gap-2">
            {pet.imageUrls.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`w-3 h-3 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}

        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 p-3 bg-white/80 backdrop-blur shadow-lg rounded-full hover:bg-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className={`absolute bottom-6 left-6 px-4 py-2 rounded-full text-white font-bold shadow-lg ${statusLabel.color}`}>
          {statusLabel.text}
        </div>
      </div>

      <div className="flex-1 p-8 space-y-8 max-w-2xl mx-auto w-full">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-black text-gray-900">
                {isSighted ? 'Pet Avistado' : (pet.name || 'Pet sem nome')}
              </h1>
              {pet.petId && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold tracking-wider">
                  {pet.petId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-500 font-medium">
              <MapPin size={18} className="text-emerald-600" />
              {pet.city}
            </div>
          </div>
          <div className="flex gap-2">
            {isClinic && (
              <button 
                onClick={handleDeletePatient}
                className="p-3 bg-white shadow-sm rounded-full text-red-500 hover:bg-red-50 transition-colors"
                title="Excluir Paciente"
              >
                <Trash2 size={20} />
              </button>
            )}
            {isSighted && isOwner && (
              <button 
                onClick={handleDeleteSightedPet}
                className="p-3 bg-white shadow-sm rounded-full text-red-500 hover:bg-red-50 transition-colors"
                title="Excluir Pet Avistado"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button 
              onClick={handleShare}
              className="p-3 bg-white shadow-sm rounded-full text-gray-600 hover:bg-gray-50 transition-colors"
              title="Compartilhar"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* Sharing Options */}
        <div className="grid grid-cols-3 gap-3">
          {isOwner && (
            (pet.status === 'lost' || pet.status === 'perdido' || pet.status === 'adoption' || pet.status === 'adocao' || isSighted) ? (
              <button 
                onClick={handleMarkAsFound}
                className={`col-span-3 flex items-center justify-center gap-3 p-5 ${(pet.status === 'adoption' || pet.status === 'adocao') ? 'bg-blue-600' : 'bg-emerald-600'} text-white rounded-3xl font-black shadow-xl hover:opacity-90 transition-all active:scale-95 mb-4`}
              >
                <CheckCircle2 size={24} />
                {(pet.status === 'adoption' || pet.status === 'adocao') ? 'MARCAR COMO DOADO' : 'MARCAR COMO ENCONTRADO'}
              </button>
            ) : (pet.status === 'adopted' || pet.status === 'doado' || pet.status === 'seguro' || pet.status === 'foundOwner' || pet.status === 'found' || !pet.status) ? (
              <button 
                onClick={handleMarkAsLost}
                className={`col-span-3 flex items-center justify-center gap-3 p-5 ${isCanil ? 'bg-purple-600' : 'bg-red-600'} text-white rounded-3xl font-black shadow-xl hover:opacity-90 transition-all active:scale-95 mb-4`}
              >
                {isCanil ? <Heart size={24} /> : <AlertTriangle size={24} />}
                {isCanil ? 'MARCAR PARA DOAÇÃO' : 'MARCAR COMO PERDIDO'}
              </button>
            ) : null
          )}

          <button 
            onClick={shareOnWhatsApp}
            className="flex flex-col items-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-colors"
          >
            <MessageCircle size={24} />
            <span className="text-[10px] font-bold uppercase">WhatsApp</span>
          </button>
          <button 
            onClick={shareOnFacebook}
            className="flex flex-col items-center gap-2 p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors"
          >
            <Share2 size={24} />
            <span className="text-[10px] font-bold uppercase">Facebook</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex flex-col items-center gap-2 p-4 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-100 transition-colors"
          >
            <Plus size={24} className="rotate-45" />
            <span className="text-[10px] font-bold uppercase">Copiar Link</span>
          </button>
        </div>

        {/* Poster Section (Only for Lost Pets) */}
        {(pet.status === 'lost' || pet.status === 'perdido') && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-red-50 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">{isCanil ? 'Cartaz de Doação' : 'Cartaz de Busca'}</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{isCanil ? 'Gere e compartilhe o cartaz' : 'Gere e compartilhe o cartaz'}</p>
                </div>
              </div>
              <button 
                onClick={handleGeneratePoster}
                disabled={generatingPoster}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {generatingPoster ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                {generatedPosters ? 'Gerar Novamente' : 'Gerar Cartaz'}
              </button>
            </div>

            {(pet.posterStoryUrl || generatedPosters) ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => downloadPoster(generatedPosters?.whatsapp || pet.posterStoryUrl!, 'whatsapp.png')}
                    className="flex flex-col items-center gap-2 p-4 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-100 transition-colors border border-gray-100"
                  >
                    <Smartphone size={24} />
                    <span className="text-[10px] font-bold uppercase">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => downloadPoster(generatedPosters?.pdf || pet.posterPdfUrl!, 'poster.pdf')}
                    className="flex flex-col items-center gap-2 p-4 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-100 transition-colors border border-gray-100"
                  >
                    <FileText size={24} />
                    <span className="text-[10px] font-bold uppercase">PDF (A4)</span>
                  </button>
                  <button 
                    onClick={handleSharePoster}
                    className="flex flex-col items-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-colors border border-emerald-100"
                  >
                    <Share2 size={24} />
                    <span className="text-[10px] font-bold uppercase">Compartilhar</span>
                  </button>
                </div>
                <p className="text-[10px] text-center text-gray-400 font-medium italic">
                  O cartaz inclui QR Code que leva diretamente a este perfil.
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-3xl text-center border border-dashed border-gray-200">
                <p className="text-gray-500 text-sm font-medium">
                  {generatingPoster ? 'Gerando cartazes profissionais...' : 'Clique em "Gerar Cartaz" para criar versões otimizadas para redes sociais e impressão.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        {!isSighted && (
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
            <button 
              onClick={() => setActiveTab('info')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all ${activeTab === 'info' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <Info size={16} />
              Informações
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <Clipboard size={16} />
              Histórico
            </button>
            <button 
              onClick={() => setActiveTab('vaccines')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all ${activeTab === 'vaccines' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <Syringe size={16} />
              Vacinas
            </button>
          </div>
        )}

        {/* Sighted Pet Specific Info */}
        {isSighted && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Data do Avistamento</p>
                  <p className="font-bold text-gray-900">{formatDateLong(pet.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Localização</p>
                  <p className="font-bold text-gray-900">{pet.city}</p>
                </div>
              </div>

              {pet.contactPhone && (
                <div className="pt-6 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">Contato de quem avistou</p>
                  <a 
                    href={formatWhatsAppLink(pet.contactPhone, `Olá! Vi seu registro de pet avistado em ${pet.city} no Petmaps.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full p-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    <MessageCircle size={24} />
                    FALAR COM QUEM AVISTOU
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Info className="text-emerald-600" size={20} />
                Descrição do Avistamento
              </h2>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-gray-600 leading-relaxed">
                  {pet.description || 'Nenhuma descrição adicional fornecida.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'info' && !isSighted) && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                <Calendar className="text-emerald-600" size={24} />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Registrado em</p>
                  <p className="font-semibold text-gray-700">
                    {formatDateLong(pet.createdAt)}
                  </p>
                </div>
              </div>
              {!isSighted && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                  <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs uppercase">
                    {(pet.species || pet.type || 'Pet')[0]}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Espécie</p>
                    <p className="font-semibold text-gray-700 capitalize">
                      {pet.species || (pet.type === 'dog' ? 'Cachorro' : pet.type === 'cat' ? 'Gato' : 'Pet')}
                    </p>
                  </div>
                </div>
              )}
              {pet.breed && pet.breed !== 'Desconhecido' && !isSighted && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] uppercase">
                    R
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Raça</p>
                    <p className="font-semibold text-gray-700">{pet.breed}</p>
                  </div>
                </div>
              )}
              {pet.sex && !isSighted && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                  <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-[10px] uppercase">
                    S
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sexo</p>
                    <p className="font-semibold text-gray-700 capitalize">{pet.sex === 'male' ? 'Macho' : 'Fêmea'}</p>
                  </div>
                </div>
              )}
              {pet.color && pet.color !== 'Não informado' && !isSighted && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                  <div className="w-6 h-6 bg-stone-100 text-stone-600 rounded-full flex items-center justify-center font-bold text-[10px] uppercase">
                    C
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cor</p>
                    <p className="font-semibold text-gray-700">{pet.color}</p>
                  </div>
                </div>
              )}
              {!isSighted && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                  <div className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-[10px] uppercase">
                    P
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Porte</p>
                    <p className="font-semibold text-gray-700 capitalize">
                      {pet.size === 'small' ? 'Pequeno' : pet.size === 'medium' ? 'Médio' : pet.size === 'large' ? 'Grande' : 'Não informado'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!isSighted && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={20} />
                  Propriedade
                </h2>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center overflow-hidden">
                      {ownerProfile?.fotoPerfil || ownerProfile?.photoURL ? (
                        <img src={ownerProfile.fotoPerfil || ownerProfile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tutor Principal</p>
                      <p className="font-semibold text-gray-700">{ownerProfile?.nome || 'N/A'}</p>
                      <p className="text-xs text-gray-400">
                        CPF/RG: {(currentProfile?.role === 'empresa' || currentProfile?.role === 'parceiro') 
                          ? (pet.ownerCpf || ownerProfile?.cpf || ownerProfile?.rg || 'Não informado')
                          : maskCpf(pet.ownerCpf || ownerProfile?.cpf || ownerProfile?.rg)}
                      </p>
                    </div>
                  </div>
                  {isOwner && (
                    <button 
                      onClick={() => setShowTransferModal(true)}
                      className="w-full mt-4 flex items-center justify-center gap-2 p-4 bg-orange-50 text-orange-600 rounded-2xl font-bold hover:bg-orange-100 transition-colors border border-orange-100"
                    >
                      <ArrowRightLeft size={20} />
                      Transferir Tutor
                    </button>
                  )}
                  <p className="text-[10px] text-gray-400 italic mt-2">
                    * Os pets cadastrados são propriedade legal do CPF vinculado à conta.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900">Descrição</h2>
              <p className="text-gray-600 leading-relaxed bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                {pet.description || 'Nenhuma descrição fornecida.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && !isSighted && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clipboard className="text-emerald-600" size={20} />
                Histórico Veterinário
              </h2>
              {isOwner && (
                <button 
                  onClick={() => setShowAddRecord(true)}
                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                  title="Adicionar Registro"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
            {records.length === 0 ? (
              <div className="bg-white p-12 rounded-[2rem] text-center border border-gray-100 shadow-sm">
                <Clipboard className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-gray-400 font-medium italic">Nenhum registro médico encontrado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {records.map(record => (
                  <div key={record.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {formatDate(record.date)}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {record.type}
                        </span>
                      </div>
                      {currentUser?.uid === record.clinicId && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingRecord(record);
                              setNewRecord({
                                date: record.date ? (record.date.seconds ? new Date(record.date.seconds * 1000).toISOString().split('T')[0] : new Date(record.date).toISOString().split('T')[0]) : format(new Date(), 'yyyy-MM-dd'),
                                type: record.type,
                                diagnosis: record.diagnosis,
                                observations: record.observations,
                                veterinarian: record.veterinarian,
                                clinicName: record.clinicName,
                              });
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{record.diagnosis}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">{record.observations}</p>
                    <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{record.clinicName}</span>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 italic">Dr(a). {record.veterinarian}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'vaccines' && !isSighted && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Syringe className="text-emerald-600" size={20} />
                Carteira de Vacinação
              </h2>
              <div className="flex gap-2">
                {isOwner && (
                  <button 
                    onClick={() => setShowAddVaccine(true)}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                    title="Registrar Vacina"
                  >
                    <Plus size={20} />
                  </button>
                )}
                <button 
                  onClick={generateVaccinationPDF}
                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                  title="Gerar Carteira Digital (PDF)"
                >
                  <Download size={20} />
                </button>
              </div>
            </div>

            {vaccines.length === 0 ? (
              <div className="bg-white p-12 rounded-[2rem] text-center border border-gray-100 shadow-sm">
                <Syringe className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-gray-400 font-medium italic">Nenhuma vacina registrada.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {vaccines.map(vaccine => (
                  <div key={vaccine.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {formatDate(vaccine.applicationDate)}
                        </span>
                        {vaccine.createdBy === 'professional' ? (
                          <span className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            <ShieldCheck size={10} />
                            Profissional
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            {ownerProfile?.fotoPerfil || ownerProfile?.photoURL ? (
                              <div className="w-3 h-3 rounded-full overflow-hidden">
                                <img src={ownerProfile.fotoPerfil || ownerProfile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <User size={10} />
                            )}
                            Tutor
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {vaccine.nextDose && (
                          <div className="text-right">
                            <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Próxima Dose</p>
                            <p className="text-xs font-bold text-orange-600">
                              {formatDate(vaccine.nextDose)}
                            </p>
                          </div>
                        )}
                        {currentUser?.uid === vaccine.clinicId && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingVaccine(vaccine);
                                setNewVaccine({
                                  vaccineName: vaccine.vaccineName,
                                  manufacturer: vaccine.manufacturer || '',
                                  batch: vaccine.batch || '',
                                  applicationDate: vaccine.applicationDate ? (vaccine.applicationDate.seconds ? new Date(vaccine.applicationDate.seconds * 1000).toISOString().split('T')[0] : new Date(vaccine.applicationDate).toISOString().split('T')[0]) : format(new Date(), 'yyyy-MM-dd'),
                                  nextDose: vaccine.nextDose ? (vaccine.nextDose.seconds ? new Date(vaccine.nextDose.seconds * 1000).toISOString().split('T')[0] : new Date(vaccine.nextDose).toISOString().split('T')[0]) : '',
                                  veterinarianName: vaccine.veterinarianName || '',
                                  clinicName: vaccine.clinicName || '',
                                  notes: vaccine.notes || '',
                                });
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">{vaccine.vaccineName}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Fabricante</p>
                        <p className="text-xs font-medium text-gray-700">{vaccine.manufacturer || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Lote</p>
                        <p className="text-xs font-medium text-gray-700">{vaccine.batch || 'N/A'}</p>
                      </div>
                    </div>
                    {vaccine.notes && (
                      <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded-xl italic">"{vaccine.notes}"</p>
                    )}
                    <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-blue-600" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{vaccine.clinicName || 'Clínica não informada'}</span>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 italic">{vaccine.veterinarianName ? `Dr(a). ${vaccine.veterinarianName}` : 'Vet não informado'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                      <ArrowRightLeft size={24} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">Transferir Tutor</h2>
                  </div>
                  <button 
                    onClick={() => {
                      setShowTransferModal(false);
                      setFoundUser(null);
                      setSearchIdentifier('');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={24} className="text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-500 font-medium">
                    Busque o novo tutor pelo CPF ou RG. O destinatário deve estar cadastrado no sistema.
                  </p>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="text"
                        value={searchIdentifier}
                        onChange={(e) => setSearchIdentifier(e.target.value)}
                        placeholder="CPF ou RG do novo tutor"
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:border-orange-500 transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleSearchUser}
                      disabled={searchingUser || !searchIdentifier}
                      className="bg-orange-600 text-white px-6 rounded-2xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
                    >
                      {searchingUser ? <Loader2 className="animate-spin" size={20} /> : 'Buscar'}
                    </button>
                  </div>

                  {foundUser && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-emerald-50 rounded-3xl border-2 border-emerald-100 space-y-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm overflow-hidden">
                          {foundUser.fotoPerfil || foundUser.photoURL ? (
                            <img src={foundUser.fotoPerfil || foundUser.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User size={24} />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Novo Tutor Encontrado</p>
                          <h3 className="font-black text-gray-900">{foundUser.nome}</h3>
                          <p className="text-xs text-gray-500">{foundUser.cidade || 'Cidade não informada'}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleInitiateTransfer}
                        disabled={initiatingTransfer}
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {initiatingTransfer ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                        SOLICITAR TRANSFERÊNCIA
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vaccine Modals */}
        <AnimatePresence>
          {(showAddVaccine || editingVaccine) && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
              >
                <button 
                  onClick={() => {
                    setShowAddVaccine(false);
                    setEditingVaccine(null);
                  }} 
                  className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
                <h2 className="text-2xl font-black text-gray-900 mb-6">
                  {editingVaccine ? 'Editar Vacina' : 'Registrar Vacina'}
                </h2>
                <form onSubmit={editingVaccine ? handleUpdateVaccine : handleAddVaccine} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Nome da Vacina</label>
                      <input 
                        type="text" 
                        required 
                        value={newVaccine.vaccineName} 
                        onChange={e => setNewVaccine({...newVaccine, vaccineName: e.target.value})} 
                        placeholder="Ex: V10, Raiva"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Fabricante</label>
                      <input 
                        type="text" 
                        value={newVaccine.manufacturer} 
                        onChange={e => setNewVaccine({...newVaccine, manufacturer: e.target.value})} 
                        placeholder="Ex: Zoetis"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Lote</label>
                      <input 
                        type="text" 
                        value={newVaccine.batch} 
                        onChange={e => setNewVaccine({...newVaccine, batch: e.target.value})} 
                        placeholder="Ex: 123456"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Data da Aplicação</label>
                      <input 
                        type="date" 
                        required 
                        value={newVaccine.applicationDate} 
                        onChange={e => setNewVaccine({...newVaccine, applicationDate: e.target.value})} 
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Próxima Dose (Opcional)</label>
                    <input 
                      type="date" 
                      value={newVaccine.nextDose} 
                      onChange={e => setNewVaccine({...newVaccine, nextDose: e.target.value})} 
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Veterinário</label>
                      <input 
                        type="text" 
                        value={newVaccine.veterinarianName} 
                        onChange={e => setNewVaccine({...newVaccine, veterinarianName: e.target.value})} 
                        placeholder="Nome do Vet"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Clínica</label>
                      <input 
                        type="text" 
                        value={newVaccine.clinicName} 
                        onChange={e => setNewVaccine({...newVaccine, clinicName: e.target.value})} 
                        placeholder="Nome da Clínica"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Observações</label>
                    <textarea 
                      value={newVaccine.notes} 
                      onChange={e => setNewVaccine({...newVaccine, notes: e.target.value})} 
                      placeholder="Alguma reação ou observação..."
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-24" 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={savingVaccine} 
                    className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {savingVaccine ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {editingVaccine ? 'Salvar Alterações' : 'Registrar Vacina'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Medical Record Modal */}
        <AnimatePresence>
          {(showAddRecord || editingRecord) && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
              >
                <button 
                  onClick={() => {
                    setShowAddRecord(false);
                    setEditingRecord(null);
                  }} 
                  className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
                <h2 className="text-2xl font-black text-gray-900 mb-6">
                  {editingRecord ? 'Editar Registro' : 'Novo Registro Médico'}
                </h2>
                <form onSubmit={editingRecord ? handleUpdateRecord : handleAddRecord} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Data</label>
                      <input 
                        type="date" 
                        required 
                        value={newRecord.date} 
                        onChange={e => setNewRecord({...newRecord, date: e.target.value})} 
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Tipo</label>
                      <select 
                        value={newRecord.type} 
                        onChange={e => setNewRecord({...newRecord, type: e.target.value as any})} 
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                      >
                        <option value="Consulta">Consulta</option>
                        <option value="Exame">Exame</option>
                        <option value="Cirurgia">Cirurgia</option>
                        <option value="Tratamento">Tratamento</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Diagnóstico / Motivo</label>
                    <input 
                      type="text" 
                      required 
                      value={newRecord.diagnosis} 
                      onChange={e => setNewRecord({...newRecord, diagnosis: e.target.value})} 
                      placeholder="Ex: Check-up anual, Vômitos"
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Veterinário</label>
                      <input 
                        type="text" 
                        value={newRecord.veterinarian} 
                        onChange={e => setNewRecord({...newRecord, veterinarian: e.target.value})} 
                        placeholder="Nome do profissional"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Clínica</label>
                      <input 
                        type="text" 
                        value={newRecord.clinicName} 
                        onChange={e => setNewRecord({...newRecord, clinicName: e.target.value})} 
                        placeholder="Nome da clínica"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Observações</label>
                    <textarea 
                      value={newRecord.observations} 
                      onChange={e => setNewRecord({...newRecord, observations: e.target.value})} 
                      placeholder="Detalhes do atendimento, prescrições..."
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-24" 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={savingRecord} 
                    className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {savingRecord ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {editingRecord ? 'Salvar Alterações' : 'Adicionar Registro'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {pet.contactPhone && !isOwner && (
          <div className="pt-4">
            <a
              href={formatWhatsAppLink(pet.contactPhone, isSighted ? `Olá! Vi seu registro de pet avistado em ${pet.city} no Petmaps.` : `Olá! Vi seu post no Petmaps sobre o pet ${pet.name || ''} (ID: ${pet.petId}). Tenho informações.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <MessageCircle size={24} />
              {isSighted ? 'Contatar quem avistou' : 'Contatar dono'}
            </a>
          </div>
        )}

        {!currentUser && (
          <div className="pt-8 space-y-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Gostou do</span>
              <Logo size="xs" />
              <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">?</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => navigate('/auth')}
                className="flex items-center justify-center gap-3 p-5 bg-white border-2 border-brand/10 text-brand rounded-3xl font-bold hover:bg-brand/5 transition-all shadow-sm"
              >
                <Plus size={20} />
                Crie o ID do seu pet
              </button>
              <button 
                onClick={() => navigate('/auth')}
                className="flex items-center justify-center gap-3 p-5 bg-white border-2 border-blue-100 text-blue-600 rounded-3xl font-bold hover:bg-blue-50 transition-all shadow-sm"
              >
                <Users size={20} />
                Seja um parceiro <Logo size="xs" className="inline-block ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Delete Confirmation Modal */}
      {deleteModalType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900">
                  {deleteModalType === 'sighted' ? 'Excluir Registro' : 'Excluir Paciente'}
                </h3>
                <p className="text-gray-500">
                  {deleteModalType === 'sighted' 
                    ? 'Deseja realmente excluir este registro de pet avistado? Esta ação não pode ser desfeita.'
                    : 'Deseja realmente excluir este paciente do seu histórico? Esta ação não pode ser desfeita.'}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={deleteModalType === 'sighted' ? confirmDeleteSightedPet : confirmDeletePatient}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-red-700 transition-all active:scale-95"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setDeleteModalType(null)}
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
  );
};
