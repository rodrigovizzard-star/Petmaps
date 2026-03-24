import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { User, Mail, Phone, Settings, LogOut, Bell, MapPin, Loader2, Edit2, ArrowLeft, Camera, Clipboard, Building2, Percent, Trash2, ArrowRightLeft, Check, X, List, ArrowRight, Shield, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../services/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { userService } from '../services/userService';
import { partnerService } from '../services/partnerService';
import { transferService } from '../services/transferService';
import { UserProfile, Partner, TransferRequest } from '../types';
import { motion, AnimatePresence } from 'motion/react';

import { Logo } from '../components/Logo';

export const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<TransferRequest[]>([]);
  const [processingTransfer, setProcessingTransfer] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (user) {
        try {
          const [profileData, partnerData, transfers] = await Promise.all([
            userService.getUserProfile(user.uid),
            partnerService.getPartnerByUserId(user.uid),
            transferService.getPendingTransferRequests(user.uid)
          ]);
          setProfile(profileData);
          setPartner(partnerData);
          setPendingTransfers(transfers || []);
        } catch (error) {
          console.error('Error fetching profile data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    fetchProfileData();
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const url = await userService.uploadProfilePhoto(user.uid, file);
      setProfile(prev => prev ? { ...prev, fotoPerfil: url, photoURL: url } : null);
      alert('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Erro ao enviar foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    const confirmed = window.confirm(
      'TEM CERTEZA? Esta ação excluirá permanentemente sua conta, seus pets e todos os seus dados. Esta ação não pode ser desfeita.'
    );
    
    if (!confirmed) return;

    setDeleting(true);
    try {
      // 1. Delete data from Firestore
      await userService.deleteAccount(user.uid);
      
      // 2. Delete Auth account
      await user.delete();
      
      alert('Sua conta foi excluída com sucesso.');
      navigate('/auth');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Para sua segurança, esta ação exige um login recente. Por favor, saia e entre novamente antes de excluir sua conta.');
      } else {
        alert('Erro ao excluir conta. Por favor, tente novamente mais tarde.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleAcceptTransfer = async (requestId: string) => {
    setProcessingTransfer(requestId);
    try {
      await transferService.acceptTransferRequest(requestId);
      setPendingTransfers(prev => prev.filter(req => req.id !== requestId));
      alert('Transferência aceita com sucesso! O pet agora é seu.');
    } catch (error) {
      console.error('Error accepting transfer:', error);
      alert('Erro ao aceitar transferência.');
    } finally {
      setProcessingTransfer(null);
    }
  };

  const handleRejectTransfer = async (requestId: string) => {
    setProcessingTransfer(requestId);
    try {
      await transferService.rejectTransferRequest(requestId);
      setPendingTransfers(prev => prev.filter(req => req.id !== requestId));
      alert('Transferência recusada.');
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      alert('Erro ao recusar transferência.');
    } finally {
      setProcessingTransfer(null);
    }
  };

  if (loading) {
    return (
      <Layout title="Meu Perfil">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Meu Perfil">
      <div className="h-full bg-gray-50 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
        <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">Meu Perfil</h2>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-emerald-600/10" />
            
            <div className="relative">
              <div className="w-28 h-28 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-lg overflow-hidden relative group">
                {uploading ? (
                  <Loader2 className="animate-spin" size={32} />
                ) : profile?.fotoPerfil || profile?.photoURL ? (
                  <img 
                    src={profile.fotoPerfil || profile.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={56} />
                )}
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="text-white" size={24} />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
              <Link 
                to="/edit-profile"
                className="absolute bottom-0 right-1/2 translate-x-14 p-2 bg-emerald-600 text-white rounded-full shadow-lg border-2 border-white hover:bg-emerald-700 transition-colors"
              >
                <Edit2 size={16} />
              </Link>
            </div>

            <div className="pt-2">
              <h2 className="text-2xl font-black text-gray-900">{profile?.nome || user?.displayName || 'Usuário'}</h2>
              <p className="text-gray-500 font-medium">{profile?.email || user?.email}</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                <span className="px-2 py-1 bg-emerald-50 rounded-lg">
                  {profile?.role === 'parceiro' || profile?.role === 'empresa' ? (
                    <div className="flex items-center gap-1">
                      <span>Parceiro</span>
                      <Logo size="xs" />
                    </div>
                  ) : 'Tutor'}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Transfers */}
          <AnimatePresence>
            {pendingTransfers.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-orange-50 rounded-[2.5rem] p-6 border-2 border-orange-100 space-y-4"
              >
                <div className="flex items-center gap-3 text-orange-600">
                  <ArrowRightLeft size={20} />
                  <h3 className="font-black uppercase tracking-wider text-sm">Transferências Pendentes</h3>
                </div>
                
                <div className="space-y-3">
                  {pendingTransfers.map(request => (
                    <div key={request.id} className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">Solicitação de Transferência</p>
                        <h4 className="font-black text-gray-900">{request.petName}</h4>
                        <p className="text-xs text-gray-500">De: <span className="font-bold">{request.fromUserName}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRejectTransfer(request.id)}
                          disabled={!!processingTransfer}
                          className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {processingTransfer === request.id ? <Loader2 className="animate-spin" size={20} /> : <X size={20} />}
                        </button>
                        <button 
                          onClick={() => handleAcceptTransfer(request.id)}
                          disabled={!!processingTransfer}
                          className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50"
                        >
                          {processingTransfer === request.id ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-4">Informações</h3>
            </div>
            <div className="divide-y divide-gray-50">
              <div className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">E-mail</p>
                  <p className="font-bold text-gray-700">{profile?.email || user?.email}</p>
                </div>
              </div>
              <div className="p-6 flex items-center gap-4">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Telefone</p>
                  <p className="font-bold text-gray-700">{profile?.phone || 'Não informado'}</p>
                </div>
              </div>
              <div className="p-6 flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cidade</p>
                  <p className="font-bold text-gray-700">{profile?.cidade || 'Não informada'}</p>
                </div>
              </div>
            </div>
          </div>

          {partner && (
            <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border-2 border-emerald-50">
              <div className="p-4 border-b bg-emerald-50/30">
                <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest px-4">Dados do Parceiro</h3>
              </div>
              <div className="divide-y divide-gray-50">
                <div className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Empresa</p>
                    <p className="font-bold text-gray-700">{partner.nomeEmpresa}</p>
                    {partner.cnpj && <p className="text-[10px] text-gray-400 font-medium">CNPJ: {partner.cnpj}</p>}
                    <p className="text-[10px] text-gray-400 font-medium italic">{partner.segmento}</p>
                  </div>
                </div>
                <div className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Endereço</p>
                    <p className="font-bold text-gray-700">{partner.endereço}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <Link 
              to="/settings"
              className="w-full bg-white p-6 rounded-[2rem] shadow-sm flex items-center justify-between group hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <Shield size={20} />
                </div>
                <span className="font-bold text-gray-700">Privacidade e Segurança</span>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </Link>

            <Link 
              to="/edit-profile"
              className="w-full bg-white p-6 rounded-[2rem] shadow-sm flex items-center justify-between group hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-50 text-gray-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <Settings size={20} />
                </div>
                <span className="font-bold text-gray-700">Editar Perfil</span>
              </div>
              <Settings size={20} className="text-gray-300" />
            </Link>


            <button 
              onClick={() => auth.signOut()}
              className="w-full bg-gray-100 p-6 rounded-[2rem] flex items-center gap-4 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
            >
              <div className="p-3 bg-white text-gray-600 rounded-2xl">
                <LogOut size={20} />
              </div>
              Sair da Conta
            </button>

            <button 
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full bg-red-50 p-6 rounded-[2rem] flex items-center gap-4 text-red-600 font-bold hover:bg-red-100 transition-colors border border-red-100"
            >
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                {deleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
              </div>
              Excluir Minha Conta
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};
