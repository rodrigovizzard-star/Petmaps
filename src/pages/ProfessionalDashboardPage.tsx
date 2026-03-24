import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { petService } from '../services/petService';
import { userService } from '../services/userService';
import { Pet, MedicalRecord, Vaccine, UserProfile } from '../types';
import { Search, Loader2, Plus, Calendar, User, Phone, MapPin, Clipboard, Syringe, Save, X, ArrowLeft, Lock, Edit2, Trash2, MessageCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Logo } from '../components/Logo';

export const ProfessionalDashboardPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  if (profile && profile.role !== 'empresa' && profile.role !== 'parceiro') {
    return (
      <Layout title="Acesso Restrito">
        <div className="h-full flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl text-center max-w-md border border-gray-100">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
            <p className="text-gray-500 mb-6">Esta área é exclusiva para profissionais e empresas parceiras.</p>
            <button onClick={() => navigate('/')} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold">Voltar para o Início</button>
          </div>
        </div>
      </Layout>
    );
  }

  const [searchId, setSearchId] = useState('');
  const [pet, setPet] = useState<Pet | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [showUpdateNextVaccine, setShowUpdateNextVaccine] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);

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

  const [newRecord, setNewRecord] = useState({
    veterinarian: '',
    type: 'Consulta',
    diagnosis: '',
    observations: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

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

  const [nextVaccineDate, setNextVaccineDate] = useState('');

  const performSearch = async (id: string) => {
    if (!id.trim()) return;
    
    setLoading(true);
    setPet(null);
    setOwnerProfile(null);
    try {
      const foundPet = await petService.getPetByPetId(id.trim().toUpperCase());
      if (foundPet) {
        setPet(foundPet);
        
        // Fetch owner profile
        try {
          const profile = await userService.getUserProfile(foundPet.ownerId || foundPet.userId);
          setOwnerProfile(profile);
        } catch (profileError) {
          console.error('Error fetching owner profile:', profileError);
        }

        setNextVaccineDate(foundPet.nextVaccineDate ? (foundPet.nextVaccineDate.seconds ? new Date(foundPet.nextVaccineDate.seconds * 1000).toISOString().split('T')[0] : new Date(foundPet.nextVaccineDate).toISOString().split('T')[0]) : '');
        const [medRecords, petVaccines] = await Promise.all([
          petService.getMedicalRecords(foundPet.id),
          petService.getVaccines(foundPet.id)
        ]);
        setRecords(medRecords);
        setVaccines(petVaccines);
      } else {
        alert('Pet não encontrado com este ID.');
      }
    } catch (error) {
      console.error('Error searching pet:', error);
      alert('Erro ao buscar pet.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchId);
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchId(searchParam);
      performSearch(searchParam);
    }
  }, []);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet || !profile) {
      alert('Erro: Pet ou perfil não carregado.');
      return;
    }

    setSaving(true);
    try {
      const recordData = {
        date: new Date(newRecord.date),
        clinicId: user?.uid || '',
        clinicName: profile.nome || 'Clínica Parceira',
        veterinarian: newRecord.veterinarian,
        type: newRecord.type as any,
        diagnosis: newRecord.diagnosis,
        observations: newRecord.observations,
        createdBy: 'professional' as const,
      };
      
      if (editingRecord) {
        await petService.updateMedicalRecord(pet.id, editingRecord.id, recordData);
        alert('Registro médico atualizado com sucesso!');
      } else {
        await petService.addMedicalRecord(pet.id, recordData);
        alert('Registro médico adicionado com sucesso!');
      }
      
      const updatedRecords = await petService.getMedicalRecords(pet.id);
      setRecords(updatedRecords);
      setShowAddRecord(false);
      setEditingRecord(null);
      setNewRecord({
        veterinarian: '',
        type: 'Consulta',
        diagnosis: '',
        observations: '',
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error: any) {
      console.error('Error saving record:', error);
      alert(`Erro ao salvar registro: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };


  const handleAddVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet || !profile) {
      alert('Erro: Pet ou perfil não carregado.');
      return;
    }

    setSaving(true);
    try {
      const vaccineData: Omit<Vaccine, 'id' | 'createdAt'> = {
        vaccineName: newVaccine.vaccineName,
        manufacturer: newVaccine.manufacturer,
        batch: newVaccine.batch,
        applicationDate: new Date(newVaccine.applicationDate),
        nextDose: newVaccine.nextDose ? new Date(newVaccine.nextDose) : null,
        veterinarianName: newVaccine.veterinarianName || profile.nome,
        clinicName: newVaccine.clinicName || profile.clinicName || profile.nome || '',
        clinicId: user?.uid || '',
        notes: newVaccine.notes,
        createdBy: 'professional',
      };

      if (editingVaccine) {
        await petService.updateVaccine(pet.id, editingVaccine.id, vaccineData);
        alert('Vacina atualizada com sucesso!');
      } else {
        await petService.addVaccine(pet.id, vaccineData);
        alert('Vacina registrada com sucesso!');
      }
      
      const updatedVaccines = await petService.getVaccines(pet.id);
      setVaccines(updatedVaccines);
      setShowAddVaccine(false);
      setEditingVaccine(null);
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
    } catch (error: any) {
      console.error('Error saving vaccine:', error);
      alert(`Erro ao salvar vacina: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };


  const handleUpdateNextVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet) return;

    setSaving(true);
    try {
      await petService.updatePet(pet.id, {
        nextVaccineDate: nextVaccineDate ? new Date(nextVaccineDate) : null
      });
      setPet({ ...pet, nextVaccineDate: nextVaccineDate ? new Date(nextVaccineDate) : null });
      setShowUpdateNextVaccine(false);
      alert('Data da próxima vacina atualizada!');
    } catch (error: any) {
      console.error('Error updating next vaccine:', error);
      alert('Erro ao atualizar data da vacina.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Painel Profissional">
      <div className="h-full bg-gray-50 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-emerald-100">
            <p className="text-gray-500 font-medium mb-8 flex items-center gap-1 flex-wrap">
              Busque um pet pelo ID <Logo size="xs" /> para gerenciar o prontuário.
            </p>

          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
            <input 
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Digite o ID do pet (Ex: PM7-A9F82K)"
              className="w-full pl-14 pr-32 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-lg font-bold uppercase"
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Buscar'}
            </button>
          </form>
        </div>

        <AnimatePresence mode="wait">
          {pet && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Pet Info Card */}
              <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-8">
                <div className="w-32 h-32 rounded-3xl overflow-hidden shrink-0 shadow-lg">
                  <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">{pet.name || 'Pet sem nome'}</h2>
                      <span className="text-emerald-600 font-bold text-sm tracking-wider">{pet.petId}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tutor</p>
                        <div className="flex items-center gap-2 justify-end">
                          <p className="font-bold text-gray-900">{ownerProfile?.nome || 'Não informado'}</p>
                          {ownerProfile?.phone && (
                            <a 
                              href={`https://wa.me/55${ownerProfile.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-600 transition-colors"
                              title="Falar no WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{ownerProfile?.cpf || ownerProfile?.rg || pet.contactPhone || 'Não informado'}</p>
                      </div>
                      <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden shrink-0 border border-gray-100">
                        {ownerProfile?.fotoPerfil || ownerProfile?.photoURL ? (
                          <img src={ownerProfile.fotoPerfil || ownerProfile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <User size={20} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-[8px] text-gray-400 font-bold uppercase">Espécie</p>
                      <p className="text-xs font-bold text-gray-700 capitalize">{pet.species || pet.type}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-[8px] text-gray-400 font-bold uppercase">Raça</p>
                      <p className="text-xs font-bold text-gray-700">{pet.breed || 'SRD'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-[8px] text-gray-400 font-bold uppercase">Porte</p>
                      <p className="text-xs font-bold text-gray-700 capitalize">{pet.size || 'Não inf.'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-[8px] text-gray-400 font-bold uppercase">Cidade</p>
                      <p className="text-xs font-bold text-gray-700">{pet.city}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => setShowUpdateNextVaccine(true)}>
                      <p className="text-[8px] text-emerald-600 font-bold uppercase">Próxima Vacina</p>
                      <p className="text-xs font-bold text-emerald-700">{formatDate(pet.nextVaccineDate)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setShowAddRecord(true)}
                  className="flex-1 min-w-[200px] bg-white border-2 border-emerald-100 text-emerald-600 p-6 rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-50 transition-all shadow-sm"
                >
                  <Clipboard size={24} />
                  Novo Atendimento
                </button>
                <button 
                  onClick={() => setShowAddVaccine(true)}
                  className="flex-1 min-w-[200px] bg-white border-2 border-blue-100 text-blue-600 p-6 rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-blue-50 transition-all shadow-sm"
                >
                  <Syringe size={24} />
                  Registrar Vacina
                </button>
                {ownerProfile?.phone && (
                  <a
                    href={`https://wa.me/55${ownerProfile.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[200px] bg-emerald-600 text-white p-6 rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-lg"
                  >
                    <MessageCircle size={24} />
                    Falar com Tutor
                  </a>
                )}
              </div>

              {/* Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Medical History */}
                <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100">
                  <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <Clipboard className="text-emerald-600" size={20} />
                    Histórico Veterinário
                  </h3>
                  <div className="space-y-4">
                    {records.length === 0 ? (
                      <p className="text-gray-400 text-center py-8 text-sm italic">Nenhum registro encontrado.</p>
                    ) : (
                      records.map(record => (
                        <div key={record.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                              {formatDate(record.date)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-bold uppercase">
                                {record.type}
                              </span>
                              {user?.uid === record.clinicId && (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingRecord(record);
                                      setNewRecord({
                                        date: record.date ? (record.date.seconds ? new Date(record.date.seconds * 1000).toISOString().split('T')[0] : new Date(record.date).toISOString().split('T')[0]) : format(new Date(), 'yyyy-MM-dd'),
                                        type: record.type,
                                        diagnosis: record.diagnosis,
                                        observations: record.observations,
                                        veterinarian: record.veterinarian,
                                      });
                                      setShowAddRecord(true);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="font-bold text-gray-800 text-sm mb-1">{record.diagnosis}</p>
                          <p className="text-xs text-gray-500 line-clamp-2">{record.observations}</p>
                          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-[8px] text-gray-400 font-bold uppercase">{record.clinicName}</span>
                            <span className="text-[8px] text-gray-400 font-medium italic">Dr(a). {record.veterinarian}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Vaccines */}
                <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100">
                  <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <Syringe className="text-blue-600" size={20} />
                    Carteira de Vacinação
                  </h3>
                  <div className="space-y-4">
                    {vaccines.length === 0 ? (
                      <p className="text-gray-400 text-center py-8 text-sm italic">Nenhuma vacina registrada.</p>
                    ) : (
                      vaccines.map(vaccine => (
                        <div key={vaccine.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                              {formatDate(vaccine.applicationDate)}
                            </span>
                            <div className="flex items-center gap-2">
                              {vaccine.nextDose && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[8px] font-bold uppercase">
                                  Próxima: {formatDate(vaccine.nextDose)}
                                </span>
                              )}
                              {user?.uid === vaccine.clinicId && (
                                <div className="flex gap-1">
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
                                      setShowAddVaccine(true);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="font-bold text-gray-800 text-sm mb-1">{vaccine.vaccineName}</p>
                          <p className="text-[8px] text-gray-400 font-bold uppercase">Lote: {vaccine.batch}</p>
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <span className="text-[8px] text-gray-400 font-bold uppercase">{vaccine.clinicName}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <AnimatePresence>
          {showAddRecord && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
              >
                <button onClick={() => {
                  setShowAddRecord(false);
                  setEditingRecord(null);
                }} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
                <h2 className="text-2xl font-black text-gray-900 mb-6">{editingRecord ? 'Editar Atendimento' : 'Novo Atendimento'}</h2>
                <form onSubmit={handleAddRecord} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Data</label>
                      <input type="date" required value={newRecord.date} onChange={e => setNewRecord({...newRecord, date: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Tipo</label>
                      <select value={newRecord.type} onChange={e => setNewRecord({...newRecord, type: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option value="Consulta">Consulta</option>
                        <option value="Cirurgia">Cirurgia</option>
                        <option value="Exame">Exame</option>
                        <option value="Retorno">Retorno</option>
                        <option value="Emergência">Emergência</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Veterinário Responsável</label>
                    <input type="text" required value={newRecord.veterinarian} onChange={e => setNewRecord({...newRecord, veterinarian: e.target.value})} placeholder="Nome do veterinário" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Diagnóstico / Motivo</label>
                    <input type="text" required value={newRecord.diagnosis} onChange={e => setNewRecord({...newRecord, diagnosis: e.target.value})} placeholder="Ex: Vacinação anual, Gastrite..." className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Observações</label>
                    <textarea value={newRecord.observations} onChange={e => setNewRecord({...newRecord, observations: e.target.value})} placeholder="Detalhes do atendimento..." className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none" />
                  </div>
                  <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {editingRecord ? 'Salvar Alterações' : 'Salvar Registro'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {showAddVaccine && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
              >
                <button onClick={() => {
                  setShowAddVaccine(false);
                  setEditingVaccine(null);
                }} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
                <h2 className="text-2xl font-black text-gray-900 mb-6">{editingVaccine ? 'Editar Vacina' : 'Registrar Vacina'}</h2>
                <form onSubmit={handleAddVaccine} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Nome da Vacina</label>
                      <input 
                        type="text" 
                        required 
                        value={newVaccine.vaccineName} 
                        onChange={e => setNewVaccine({...newVaccine, vaccineName: e.target.value})} 
                        placeholder="Ex: V10, Raiva"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Fabricante</label>
                      <input 
                        type="text" 
                        value={newVaccine.manufacturer} 
                        onChange={e => setNewVaccine({...newVaccine, manufacturer: e.target.value})} 
                        placeholder="Ex: Zoetis"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" 
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
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Data da Aplicação</label>
                      <input 
                        type="date" 
                        required 
                        value={newVaccine.applicationDate} 
                        onChange={e => setNewVaccine({...newVaccine, applicationDate: e.target.value})} 
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Próxima Dose (Opcional)</label>
                    <input 
                      type="date" 
                      value={newVaccine.nextDose} 
                      onChange={e => setNewVaccine({...newVaccine, nextDose: e.target.value})} 
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Veterinário</label>
                      <input 
                        type="text" 
                        value={newVaccine.veterinarianName} 
                        onChange={e => setNewVaccine({...newVaccine, veterinarianName: e.target.value})} 
                        placeholder={profile?.nome || "Nome do Vet"}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Clínica</label>
                      <input 
                        type="text" 
                        value={newVaccine.clinicName} 
                        onChange={e => setNewVaccine({...newVaccine, clinicName: e.target.value})} 
                        placeholder={profile?.clinicName || "Nome da Clínica"}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Observações</label>
                    <textarea 
                      value={newVaccine.notes} 
                      onChange={e => setNewVaccine({...newVaccine, notes: e.target.value})} 
                      placeholder="Alguma reação ou observação..."
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24" 
                    />
                  </div>
                  <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {editingVaccine ? 'Salvar Alterações' : 'Registrar Vacina'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {showUpdateNextVaccine && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative"
              >
                <button onClick={() => setShowUpdateNextVaccine(false)} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
                <h2 className="text-2xl font-black text-gray-900 mb-6">Próxima Vacina</h2>
                <form onSubmit={handleUpdateNextVaccine} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Data da Próxima Dose</label>
                    <input 
                      type="date" 
                      required 
                      value={nextVaccineDate} 
                      onChange={e => setNextVaccineDate(e.target.value)} 
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    />
                  </div>
                  <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    Atualizar Data
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </Layout>
  );
};
