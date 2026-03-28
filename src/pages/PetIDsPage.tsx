import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  Search,
  PawPrint,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { petService } from '../services/petService';
import { Pet } from '../types';

export const PetIDsPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.userId) return;
      setLoading(true);
      try {
        const userPets = await petService.getUserPets(profile.userId);
        setPets(userPets);
      } catch (error) {
        console.error('Error fetching pet IDs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.userId]);

  const handleCopyId = (petId: string) => {
    navigator.clipboard.writeText(petId);
    setCopiedId(petId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPets = pets.filter(pet => 
    pet.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pet.petId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout title="ID do Pet" headerType="default">
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
              <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">ID do Pet</h1>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Identificadores Únicos</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm font-medium"
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-[2.5rem] p-6 h-32 animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : filteredPets.length > 0 ? (
            <div className="space-y-4">
              {filteredPets.map((pet) => (
                <motion.div
                  key={pet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2.5rem] p-5 shadow-sm border border-gray-100 flex items-center gap-5 group"
                >
                  <div className="w-20 h-20 rounded-3xl overflow-hidden bg-gray-100 shrink-0 border border-gray-50 shadow-inner">
                    <img 
                      src={pet.imageUrl} 
                      alt={pet.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 truncate text-lg uppercase tracking-tight">
                      {pet.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-black text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-widest">
                        {pet.petId || 'Sem ID'}
                      </span>
                      {pet.petId && (
                        <button 
                          onClick={() => handleCopyId(pet.petId!)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                        >
                          {copiedId === pet.petId ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => navigate(`/pet/${pet.id}`)}
                      className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-emerald-600 transition-colors"
                    >
                      Ver mais detalhes
                      <ExternalLink size={12} />
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
                className="bg-purple-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-100"
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
