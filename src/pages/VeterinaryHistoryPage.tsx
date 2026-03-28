import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  Download, 
  Plus, 
  Clipboard,
  Calendar,
  Search,
  PawPrint,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { petService } from '../services/petService';
import { Pet, MedicalRecord } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const VeterinaryHistoryPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [recordsByPet, setRecordsByPet] = useState<Record<string, MedicalRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.userId) return;
      setLoading(true);
      try {
        const userPets = await petService.getUserPets(profile.userId);
        setPets(userPets);

        const recordsData: Record<string, MedicalRecord[]> = {};
        await Promise.all(userPets.map(async (pet) => {
          const records = await petService.getMedicalRecords(pet.id);
          recordsData[pet.id] = records;
        }));
        setRecordsByPet(recordsData);
      } catch (error) {
        console.error('Error fetching veterinary history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.userId]);

  const handleDownload = (pet: Pet) => {
    // Mock download functionality
    const btn = document.getElementById(`download-btn-${pet.id}`);
    if (btn) {
      const originalContent = btn.innerHTML;
      btn.innerHTML = 'Baixando...';
      setTimeout(() => {
        btn.innerHTML = originalContent;
        alert(`Histórico veterinário de ${pet.name} baixado com sucesso! (Simulação)`);
      }, 1500);
    }
  };

  const filteredPets = pets.filter(pet => 
    pet.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout title="Histórico Veterinário" headerType="default">
      <div className="flex-1 overflow-y-auto pb-24 bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-6 space-y-6">
          
          {/* Header with Back Button */}
          <div className="flex items-center gap-4 mb-2">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-600"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Histórico Veterinário</h1>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Registros Clínicos</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome do pet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium"
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-[2.5rem] p-6 h-64 animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : filteredPets.length > 0 ? (
            <div className="space-y-6">
              {filteredPets.map((pet) => (
                <motion.div
                  key={pet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Pet Header */}
                  <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/30 bg-white/20">
                        <img 
                          src={pet.imageUrl} 
                          alt={pet.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <h2 className="text-lg font-black uppercase tracking-tight">{pet.name}</h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                          {pet.breed || 'Raça não informada'}
                        </p>
                      </div>
                    </div>
                    <button 
                      id={`download-btn-${pet.id}`}
                      onClick={() => handleDownload(pet)}
                      className="p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-colors"
                    >
                      <Download size={20} />
                    </button>
                  </div>

                  {/* Records List */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Consultas e Procedimentos</h3>
                      <button 
                        onClick={() => navigate(`/pet/${pet.id}`, { state: { openMedicalModal: true } })}
                        className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-wider hover:bg-blue-100 transition-colors"
                      >
                        <Plus size={12} />
                        Novo Registro
                      </button>
                    </div>

                    {recordsByPet[pet.id]?.length > 0 ? (
                      <div className="space-y-3">
                        {recordsByPet[pet.id].map((record) => (
                          <div key={record.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                              <Clipboard size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-gray-900 truncate uppercase tracking-tight">
                                {record.type}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                                  <Calendar size={10} />
                                  {format(record.date instanceof Date ? record.date : record.date.toDate(), 'dd/MM/yyyy')}
                                </span>
                                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                  <Clock size={10} />
                                  {record.clinicName || 'Clínica não informada'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <Clipboard className="mx-auto text-gray-300 mb-2" size={32} />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nenhum registro clínico</p>
                        <button 
                          onClick={() => navigate(`/pet/${pet.id}`, { state: { openMedicalModal: true } })}
                          className="mt-3 text-[10px] font-black text-blue-600 uppercase tracking-widest underline"
                        >
                          Registrar primeira consulta
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions for Pet */}
                  <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => navigate(`/pet/${pet.id}`, { state: { openMedicalModal: true } })}
                      className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors"
                    >
                      <Plus size={14} />
                      Inserir Registro
                    </button>
                    <button 
                      onClick={() => navigate(`/pet/${pet.id}`)}
                      className="flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
                    >
                      <PawPrint size={14} />
                      Ver Pet
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <PawPrint className="text-gray-200" size={40} />
              </div>
              <p className="text-base font-black text-gray-400 uppercase tracking-widest">Nenhum pet encontrado</p>
              <p className="text-xs text-gray-400 font-medium mb-6">Você precisa cadastrar um pet primeiro</p>
              <button 
                onClick={() => navigate('/register')}
                className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100"
              >
                Cadastrar Meu Pet
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
