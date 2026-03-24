import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/userService';
import { partnerService } from '../services/partnerService';
import { User, Mail, Phone, MapPin, Camera, Loader2, ArrowLeft, Save, Building2, Percent } from 'lucide-react';
import { UserProfile, Partner } from '../types';

import { Logo } from '../components/Logo';

export const EditProfilePage = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const [profileData, partnerData] = await Promise.all([
          userService.getUserProfile(user.uid),
          partnerService.getPartnerByUserId(user.uid)
        ]);
        setProfile(profileData);
        setPartner(partnerData);
        setPhotoPreview(profileData?.fotoPerfil || profileData?.photoURL || null);
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleCepLookup = async (cep: string, type: 'profile' | 'partner') => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          const fullCity = data.uf ? `${data.localidade}-${data.uf}` : data.localidade;
          if (type === 'profile') {
            setProfile(prev => prev ? {
              ...prev,
              cep: cleanedCep,
              rua: data.logradouro || prev.rua,
              bairro: data.bairro || prev.bairro,
              cidade: fullCity || prev.cidade
            } : null);
          } else {
            setPartner(prev => prev ? {
              ...prev,
              cep: cleanedCep,
              rua: data.logradouro || prev.rua,
              bairro: data.bairro || prev.bairro,
              cidade: fullCity || prev.cidade
            } : null);
          }
        }
      } catch (error) {
        console.error('Error fetching CEP:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!profile.cep || !profile.rua || !profile.numero || !profile.bairro || !profile.cidade) {
      alert('Por favor, preencha o endereço completo.');
      return;
    }

    if (partner) {
      // Additional validation if needed
    }

    setSaving(true);
    try {
      let photoURL = profile.fotoPerfil || profile.photoURL || '';
      
      if (photoFile) {
        console.log('Uploading new profile photo...');
        photoURL = await userService.uploadProfilePhoto(user.uid, photoFile);
      }

      const fullAddress = `${profile.rua || ''}, ${profile.numero || ''} - ${profile.bairro || ''}, ${profile.cidade || ''} - CEP: ${profile.cep || ''}`;

      console.log('Updating user profile...');
      const userUpdates: Partial<UserProfile> = {
        nome: profile.nome,
        displayName: profile.nome,
        phone: profile.phone,
        cidade: profile.cidade,
        endereço: fullAddress,
        cep: profile.cep,
        rua: profile.rua,
        numero: profile.numero,
        bairro: profile.bairro,
        fotoPerfil: photoURL,
        photoURL: photoURL,
        cnpj: partner?.cnpj || null,
        companyType: (partner ? (
          partner.segmento === 'clínica veterinária' ? 'clinica' : 
          partner.segmento === 'agropecuária' ? 'agro' : 
          partner.segmento === 'plano de saúde' ? 'plano' : 
          partner.segmento === 'criadores' ? 'criador' : 
          partner.segmento === 'petshop' ? 'petshop' :
          partner.segmento === 'seguro' ? 'seguro' :
          partner.segmento === 'canil' ? 'canil' : 'petshop'
        ) : profile.companyType) as any,
      };

      await userService.updateUserProfile(user.uid, userUpdates);

      if (partner) {
        console.log('Updating partner profile...');
        
        await partnerService.updatePartnerProfile(partner.id, {
          nomeEmpresa: partner.nomeEmpresa,
          segmento: partner.segmento,
          endereço: fullAddress,
          cep: profile.cep,
          rua: profile.rua,
          numero: profile.numero,
          bairro: profile.bairro,
          whatsapp: partner.whatsapp,
          cidade: profile.cidade,
          cnpj: partner.cnpj,
        });
      }

      // Refresh the global profile state
      await refreshProfile();
      
      alert('Perfil atualizado com sucesso!');
      navigate('/profile');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(`Erro ao atualizar perfil: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Editar Perfil">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Editar Perfil">
      <div className="h-full bg-gray-50 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
        <div className="p-6 max-w-2xl mx-auto w-full space-y-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-black text-gray-900">Editar Perfil</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Upload */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-emerald-100 border-4 border-white shadow-lg">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-emerald-600">
                      <User size={64} />
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-3 bg-emerald-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-emerald-700 transition-colors">
                  <Camera size={20} />
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase">Toque na câmera para alterar a foto</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Dados Pessoais</h3>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      type="text"
                      required
                      value={profile?.nome || ''}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, nome: e.target.value } : null)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                    <input 
                      type="email"
                      disabled
                      value={profile?.email || ''}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">WhatsApp / Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      type="tel"
                      value={profile?.phone || ''}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Ex: 11999999999"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Cidade</label>
                  <input 
                    type="text"
                    required
                    value={profile?.cidade || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, cidade: e.target.value } : null)}
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="Cidade"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">CEP</label>
                    <input 
                      type="text"
                      required
                      value={profile?.cep || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile(prev => prev ? { ...prev, cep: val } : null);
                        handleCepLookup(val, 'profile');
                      }}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="00000-000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Bairro</label>
                    <input 
                      type="text"
                      required
                      value={profile?.bairro || ''}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, bairro: e.target.value } : null)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Bairro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Rua</label>
                    <input 
                      type="text"
                      required
                      value={profile?.rua || ''}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, rua: e.target.value } : null)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Rua"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Número</label>
                    <input 
                      type="text"
                      required
                      value={profile?.numero || ''}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, numero: e.target.value } : null)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Nº"
                    />
                  </div>
                </div>

                {profile?.role === 'tutor' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">CPF</label>
                        <input 
                          type="text"
                          disabled
                          value={profile?.cpf || ''}
                          className="w-full p-4 bg-gray-100 border border-gray-100 rounded-2xl text-gray-500 cursor-not-allowed outline-none"
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">RG</label>
                        <input 
                          type="text"
                          disabled
                          value={profile?.rg || ''}
                          className="w-full p-4 bg-gray-100 border border-gray-100 rounded-2xl text-gray-500 cursor-not-allowed outline-none"
                          placeholder="00.000.000-0"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {partner && (
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest px-1">Dados da Empresa</h3>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Nome da Empresa</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="text"
                        required
                        value={partner.nomeEmpresa}
                        onChange={(e) => setPartner(prev => prev ? { ...prev, nomeEmpresa: e.target.value } : null)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">CNPJ</label>
                    <input 
                      type="text"
                      required
                      value={partner.cnpj || ''}
                      onChange={(e) => setPartner(prev => prev ? { ...prev, cnpj: e.target.value } : null)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Segmento</label>
                    <select 
                      value={partner.segmento}
                      onChange={(e) => setPartner(prev => prev ? { ...prev, segmento: e.target.value as any } : null)}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="petshop">Petshop</option>
                      <option value="clínica veterinária">Clínica Veterinária</option>
                      <option value="agropecuária">Agropecuária</option>
                      <option value="seguro">Seguro</option>
                      <option value="plano de saúde">Plano de Saúde</option>
                      <option value="criadores">Criadores</option>
                      <option value="canil">Canil</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">WhatsApp da Empresa</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="tel"
                        required
                        value={partner.whatsapp}
                        onChange={(e) => setPartner(prev => prev ? { ...prev, whatsapp: e.target.value } : null)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
