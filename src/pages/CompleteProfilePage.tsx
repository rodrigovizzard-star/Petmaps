import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/userService';
import { User, Phone, MapPin, Loader2, Save, LogOut, Building2 } from 'lucide-react';
import { auth } from '../services/firebase';
import { motion } from 'motion/react';

import { Logo } from '../components/Logo';

export const CompleteProfilePage = () => {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [role, setRole] = useState<'tutor' | 'empresa'>('tutor');
  const [segmento, setSegmento] = useState<'petshop' | 'clínica veterinária' | 'agropecuária' | 'seguro' | 'plano de saúde' | 'criadores' | 'canil'>('petshop');
  const [localização, setLocalização] = useState({ lat: -23.5505, lng: -46.6333 });

  useEffect(() => {
    if (profile) {
      if (profile.phone) setPhone(profile.phone);
      if (profile.cep) setCep(profile.cep);
      if (profile.rua) setRua(profile.rua);
      if (profile.numero) setNumero(profile.numero);
      if (profile.bairro) setBairro(profile.bairro);
      if (profile.cidade) setCidade(profile.cidade);
      if (profile.role) setRole(profile.role as 'tutor' | 'empresa');
      if (profile.location) setLocalização(profile.location);
      if (profile.cpf) setCpf(profile.cpf);
      if (profile.rg) setRg(profile.rg);
    }
  }, [profile]);

  useEffect(() => {
    const isProfileComplete = profile?.phone && profile?.cidade && profile?.cep;
    if (isProfileComplete) {
      navigate('/');
    }
  }, [profile, navigate]);

  const handleCepLookup = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setCep(cleanedCep);
          setRua(data.logradouro || rua);
          setBairro(data.bairro || bairro);
          const fullCity = data.uf ? `${data.localidade}-${data.uf}` : data.localidade;
          setCidade(fullCity || cidade);
        }
      } catch (error) {
        console.error('Error fetching CEP:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const finalPhone = phone || profile?.phone;
    const finalCidade = cidade || profile?.cidade;
    const finalCep = cep || profile?.cep;
    const finalRua = rua || profile?.rua;
    const finalNumero = numero || profile?.numero;
    const finalBairro = bairro || profile?.bairro;
    const finalRole = role || profile?.role || 'tutor';

    if (!finalPhone || !finalCidade || !finalCep || !finalRua || !finalNumero || !finalBairro) {
      alert('Por favor, preencha o telefone e o endereço completo.');
      return;
    }

    setSaving(true);
    try {
      // Check for duplicate CPF if it changed
      if (cpf && cpf !== profile?.cpf) {
        const cpfExists = await userService.checkCpfExists(cpf, user.uid);
        if (cpfExists) {
          alert('Este CPF já está cadastrado em outra conta.');
          setSaving(false);
          return;
        }
      }

      // Check for duplicate RG if it changed
      if (rg && rg !== profile?.rg) {
        const rgExists = await userService.checkRgExists(rg, user.uid);
        if (rgExists) {
          alert('Este RG já está cadastrado em outra conta.');
          setSaving(false);
          return;
        }
      }

      // Check for duplicate phone if it changed
      if (finalPhone !== profile?.phone) {
        const phoneExists = await userService.checkPhoneExists(finalPhone, user.uid);
        if (phoneExists) {
          alert('Este número de telefone já está cadastrado em outra conta.');
          setSaving(false);
          return;
        }
      }

      const fullAddress = `${finalRua}, ${finalNumero} - ${finalBairro}, ${finalCidade} - CEP: ${finalCep}`;

      const updatedData = {
        phone: finalPhone,
        cidade: finalCidade,
        cep: finalCep,
        rua: finalRua,
        numero: finalNumero,
        bairro: finalBairro,
        endereço: fullAddress,
        cpf: cpf || undefined,
        rg: rg || undefined,
        location: localização,
        role: finalRole,
        companyType: (finalRole === 'empresa' ? (
          segmento === 'clínica veterinária' ? 'clinica' : 
          segmento === 'agropecuária' ? 'agro' : 
          segmento === 'plano de saúde' ? 'plano' : 
          segmento === 'criadores' ? 'criador' : 
          segmento === 'petshop' ? 'petshop' :
          segmento === 'seguro' ? 'seguro' :
          segmento === 'canil' ? 'canil' : 'petshop'
        ) : undefined) as any,
        segmento: finalRole === 'empresa' ? segmento : undefined,
      };

      await userService.updateUserProfile(user.uid, updatedData);
      
      // Update global profile state
      await refreshProfile();

      alert('Perfil completado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error('Error completing profile:', error);
      alert('Erro ao completar perfil. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl my-8"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size="lg" className="mb-2" />
          <p className="text-gray-500 font-medium">
            {profile?.phone && profile?.cidade ? 'Só falta o seu CPF' : 'Complete seu cadastro'}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {role === 'tutor' 
              ? 'Para sua segurança e dos seus pets, você pode preencher seu CPF ou RG. Os pets cadastrados passam a ser propriedade do CPF da conta.'
              : 'Para acessar o sistema, precisamos que você informe seu telefone e cidade.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {(!profile?.role) && (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Tipo de Conta</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('tutor')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      role === 'tutor' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-400'
                    }`}
                  >
                    <User size={24} />
                    <span className="text-xs font-bold">Tutor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('empresa')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      role === 'empresa' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-400'
                    }`}
                  >
                    <Building2 size={24} />
                    <span className="text-xs font-bold">Empresa</span>
                  </button>
                </div>
              </div>
            )}

            {role === 'empresa' && (
              <div className="space-y-4 pt-2 border-t border-gray-50">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Segmento da Empresa *</label>
                  <select 
                    value={segmento}
                    onChange={(e) => setSegmento(e.target.value as any)}
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
              </div>
            )}

            {role === 'tutor' && (
              <div className="space-y-4 pt-2 border-t border-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">CPF (Opcional)</label>
                    <input 
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">RG (Opcional)</label>
                    <input 
                      type="text"
                      value={rg}
                      onChange={(e) => setRg(e.target.value)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="RG"
                    />
                  </div>
                </div>
              </div>
            )}

            {(!profile?.phone) && (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">WhatsApp / Telefone *</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="Ex: 11999999999"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Cidade *</label>
              <input 
                type="text"
                required
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="Cidade"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">CEP *</label>
                <input 
                  type="text"
                  required
                  value={cep}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCep(val);
                    handleCepLookup(val);
                  }}
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="00000-000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Bairro *</label>
                <input 
                  type="text"
                  required
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Bairro"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Rua *</label>
                <input 
                  type="text"
                  required
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Rua"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Número *</label>
                <input 
                  type="text"
                  required
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Nº"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
            Finalizar Cadastro
          </button>

          <button
            type="button"
            onClick={() => auth.signOut()}
            className="w-full flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-red-500 transition-colors pt-4"
          >
            <LogOut size={18} />
            Sair da conta
          </button>
        </form>
      </motion.div>
    </div>
  );
};
