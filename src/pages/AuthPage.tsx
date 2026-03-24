import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { userService } from '../services/userService';
import { partnerService } from '../services/partnerService';
import { motion } from 'motion/react';
import { Mail, Lock, Loader2, Eye, EyeOff, Building2, User, MapPin, Phone, Percent } from 'lucide-react';

import { Logo } from '../components/Logo';

type AuthMode = 'login' | 'register_tutor' | 'register_parceiro';

export const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('Brasil');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // Partner fields
  const [partnerData, setPartnerData] = useState({
    nomeEmpresa: '',
    segmento: 'petshop' as 'petshop' | 'clínica veterinária' | 'agropecuária' | 'seguro' | 'plano de saúde' | 'criadores' | 'canil',
    endereço: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    localização: { lat: -23.5505, lng: -46.6333 },
    whatsapp: '',
    cnpj: '',
  });

  // Tutor extra fields
  const [tutorData, setTutorData] = useState({
    phone: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    cpf: '',
    rg: '',
    localização: { lat: -23.5505, lng: -46.6333 },
  });

  const handleCepLookup = async (cep: string, type: 'tutor' | 'partner') => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          if (type === 'tutor') {
            setTutorData(prev => ({
              ...prev,
              cep: cleanedCep,
              rua: data.logradouro || prev.rua,
              bairro: data.bairro || prev.bairro,
              cidade: data.localidade || prev.cidade
            }));
          } else {
            setPartnerData(prev => ({
              ...prev,
              cep: cleanedCep,
              rua: data.logradouro || prev.rua,
              bairro: data.bairro || prev.bairro,
              cidade: data.localidade || prev.cidade
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching CEP:', error);
      }
    }
  };

  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode !== 'login' && password !== confirmPassword) {
      alert('As senhas não coincidem.');
      return;
    }

    if (mode === 'register_tutor' || mode === 'register_parceiro') {
      const data = mode === 'register_tutor' ? tutorData : partnerData;
      const phone = mode === 'register_tutor' ? tutorData.phone : partnerData.whatsapp;
      const cleanedPhone = phone.replace(/\D/g, '');
      
      if (cleanedPhone.length < 10) {
        alert('Por favor, insira o número com DDD (mínimo 10 dígitos).');
        return;
      }

      if (!data.cep || !data.rua || !data.numero || !data.bairro || !data.cidade) {
        alert('Por favor, preencha o endereço completo (CEP, Rua, Número, Bairro e Cidade).');
        return;
      }
    }

    if (mode === 'register_parceiro') {
      // Additional validation if needed
    }

    setLoading(true);
    console.log('Starting auth process...', { mode, email });
    try {
      if (mode === 'login') {
        console.log('Attempting login...');
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        console.log('Attempting registration...');
        
        console.log('Creating Firebase Auth user...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Now that we are authenticated, we can check for existing phone in Firestore
        // Note: createUserWithEmailAndPassword already checks if email exists in Auth
        const phone = mode === 'register_tutor' ? tutorData.phone : partnerData.whatsapp;
        console.log('Checking phone existence in Firestore...', phone);
        const phoneExists = await userService.checkPhoneExists(phone);
        
        if (phoneExists) {
          // If phone exists, we must delete the newly created Auth user to maintain consistency
          console.log('Phone already exists, deleting Auth user...');
          await userCredential.user.delete();
          alert('Este número de telefone já está cadastrado.');
          setLoading(false);
          return;
        }

        const fullAddress = mode === 'register_tutor' 
          ? `${tutorData.rua}, ${tutorData.numero} - ${tutorData.bairro}, ${tutorData.cidade} - CEP: ${tutorData.cep}`
          : `${partnerData.rua}, ${partnerData.numero} - ${partnerData.bairro}, ${partnerData.cidade} - CEP: ${partnerData.cep}`;

        if (mode === 'register_tutor') {
          // CPF/RG are now optional
          console.log('Creating user profile in Firestore...', uid);
          await userService.createUserProfile(uid, {
            email,
            nome,
            phone: tutorData.phone,
            cidade: tutorData.cidade,
            endereço: fullAddress,
            cep: tutorData.cep,
            rua: tutorData.rua,
            numero: tutorData.numero,
            bairro: tutorData.bairro,
            cpf: tutorData.cpf || undefined,
            rg: tutorData.rg || undefined,
            role: 'tutor',
            country: country,
          } as any);
        } else if (mode === 'register_parceiro') {
          const companyType = partnerData.segmento === 'clínica veterinária' ? 'clinica' : 
                             partnerData.segmento === 'petshop' ? 'petshop' : 
                             partnerData.segmento === 'agropecuária' ? 'agro' :
                             partnerData.segmento === 'seguro' ? 'seguro' :
                             partnerData.segmento === 'plano de saúde' ? 'plano' :
                             partnerData.segmento === 'criadores' ? 'criador' : 'canil';
          
            await userService.createUserProfile(uid, {
              email,
              nome: partnerData.nomeEmpresa,
              phone: partnerData.whatsapp,
              cidade: partnerData.cidade,
              endereço: fullAddress,
              cep: partnerData.cep,
              rua: partnerData.rua,
              numero: partnerData.numero,
              bairro: partnerData.bairro,
              cnpj: partnerData.cnpj,
              role: 'empresa',
              companyType: companyType,
              country: country,
            } as any);
            
            await partnerService.createPartnerProfile(uid, {
              nomeEmpresa: partnerData.nomeEmpresa,
              segmento: partnerData.segmento,
              companyType: companyType,
              endereço: fullAddress,
              cep: partnerData.cep,
              rua: partnerData.rua,
              numero: partnerData.numero,
              bairro: partnerData.bairro,
              cidade: partnerData.cidade,
              cnpj: partnerData.cnpj,
              localização: partnerData.localização,
              whatsapp: partnerData.whatsapp,
            });
        }

        // Send welcome email
        try {
          console.log('Triggering welcome email...');
          await fetch('/api/auth/welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, displayName: nome || partnerData.nomeEmpresa }),
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
        }

        alert('Cadastro realizado com sucesso!');
      }
      navigate('/');
    } catch (error: any) {
      console.error('Auth error caught:', error);
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (error: any) => {
    console.error('Auth Error:', error.code, error.message);
    let message = 'Ocorreu um erro ao processar sua solicitação.';
    
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        message = 'E-mail ou senha incorretos.';
        break;
      case 'auth/email-already-in-use':
        message = 'Este e-mail já está em uso.';
        break;
      case 'auth/weak-password':
        message = 'A senha deve ter pelo menos 6 caracteres.';
        break;
      default:
        message = error.message;
    }
    alert(message);
  };

  if (isResetting) {
    return (
      <div className="min-h-screen bg-brand flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl">
          <div className="text-center mb-8 flex flex-col items-center">
            <Logo size="xl" className="mb-3" />
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase text-center max-w-[280px] leading-tight">
              SISTEMA DE REGISTRO ANIMAL BASEADO EM IDENTIFICADOR ÚNICO
            </p>
            <p className="text-gray-500 font-medium mt-6">Recuperar Senha</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
            </div>
            <p className="text-xs text-gray-400 px-2">
              Certifique-se de verificar sua pasta de Spam após solicitar a recuperação.
            </p>
            <button onClick={async () => {
              if (!email) return alert('Insira seu e-mail');
              if (!email.includes('@')) return alert('Insira um e-mail válido');
              setLoading(true);
              try {
                await sendPasswordResetEmail(auth, email);
                alert('E-mail de recuperação enviado! Verifique sua caixa de entrada e pasta de Spam.');
                setIsResetting(false);
              } catch (err) { handleAuthError(err); }
              finally { setLoading(false); }
            }} disabled={loading} className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : 'Enviar e-mail'}
            </button>
            <button onClick={() => setIsResetting(false)} className="w-full text-gray-500 font-semibold hover:underline">Voltar</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand flex flex-col items-center justify-center p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl my-8"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size="xl" className="mb-3" />
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase text-center max-w-[280px] leading-tight">
            SISTEMA DE REGISTRO ANIMAL BASEADO EM IDENTIFICADOR ÚNICO
          </p>
          <p className="text-gray-500 font-medium mt-6">
            {mode === 'login' ? 'Bem-vindo de volta!' : 
             mode === 'register_tutor' ? 'Crie sua conta Petmaps' : 'Cadastro de Parceiro'}
          </p>
          {mode === 'register_tutor' && (
            <p className="text-xs text-gray-400 mt-2 px-4">
              Ao criar sua conta, você já se registra automaticamente como tutor para poder cadastrar seus pets e utilizar todos os recursos.
            </p>
          )}
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode !== 'login' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo *"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail *"
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha *"
                className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {mode !== 'login' && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar Senha *"
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            )}

            {mode !== 'login' && (
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <select 
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                >
                  <option value="Brasil">Brasil (+55)</option>
                  <option value="Portugal">Portugal (+351)</option>
                  <option value="EUA">EUA (+1)</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            )}

          {mode === 'register_tutor' && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input 
                    type="text"
                    value={tutorData.cpf}
                    onChange={(e) => setTutorData(prev => ({...prev, cpf: e.target.value}))}
                    placeholder="CPF"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    value={tutorData.rg}
                    onChange={(e) => setTutorData(prev => ({...prev, rg: e.target.value}))}
                    placeholder="RG"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 px-2">CPF ou RG são opcionais, mas recomendados.</p>

              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="tel"
                  required
                  value={tutorData.phone}
                  onChange={(e) => setTutorData(prev => ({...prev, phone: e.target.value}))}
                  placeholder="WhatsApp * (Ex: 11999999999)"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={tutorData.cep}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTutorData(prev => ({...prev, cep: val}));
                      handleCepLookup(val, 'tutor');
                    }}
                    placeholder="CEP *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={tutorData.cidade}
                    onChange={(e) => setTutorData(prev => ({...prev, cidade: e.target.value}))}
                    placeholder="Cidade *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 relative">
                  <input 
                    type="text"
                    required
                    value={tutorData.rua}
                    onChange={(e) => setTutorData(prev => ({...prev, rua: e.target.value}))}
                    placeholder="Rua *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={tutorData.numero}
                    onChange={(e) => setTutorData(prev => ({...prev, numero: e.target.value}))}
                    placeholder="Nº *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="relative">
                <input 
                  type="text"
                  required
                  value={tutorData.bairro}
                  onChange={(e) => setTutorData(prev => ({...prev, bairro: e.target.value}))}
                  placeholder="Bairro *"
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {mode === 'register_parceiro' && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text"
                  required
                  value={partnerData.nomeEmpresa}
                  onChange={(e) => setPartnerData(prev => ({...prev, nomeEmpresa: e.target.value}))}
                  placeholder="Nome da empresa *"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="relative">
                <input 
                  type="text"
                  required
                  value={partnerData.cnpj}
                  onChange={(e) => setPartnerData(prev => ({...prev, cnpj: e.target.value}))}
                  placeholder="CNPJ *"
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <select 
                value={partnerData.segmento}
                onChange={(e) => setPartnerData(prev => ({...prev, segmento: e.target.value as any}))}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="petshop">Petshop *</option>
                <option value="clínica veterinária">Clínica Veterinária *</option>
                <option value="agropecuária">Agropecuária *</option>
                <option value="seguro">Seguro *</option>
                <option value="plano de saúde">Plano de Saúde *</option>
                <option value="criadores">Criadores *</option>
                <option value="canil">Canil *</option>
              </select>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={partnerData.cep}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPartnerData(prev => ({...prev, cep: val}));
                      handleCepLookup(val, 'partner');
                    }}
                    placeholder="CEP *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={partnerData.cidade}
                    onChange={(e) => setPartnerData(prev => ({...prev, cidade: e.target.value}))}
                    placeholder="Cidade *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 relative">
                  <input 
                    type="text"
                    required
                    value={partnerData.rua}
                    onChange={(e) => setPartnerData(prev => ({...prev, rua: e.target.value}))}
                    placeholder="Rua *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={partnerData.numero}
                    onChange={(e) => setPartnerData(prev => ({...prev, numero: e.target.value}))}
                    placeholder="Nº *"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="relative">
                <input 
                  type="text"
                  required
                  value={partnerData.bairro}
                  onChange={(e) => setPartnerData(prev => ({...prev, bairro: e.target.value}))}
                  placeholder="Bairro *"
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="tel"
                  required
                  value={partnerData.whatsapp}
                  onChange={(e) => setPartnerData(prev => ({...prev, whatsapp: e.target.value}))}
                  placeholder="WhatsApp (Ex: 11999999999)"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="text-right">
              <button 
                type="button"
                onClick={() => setIsResetting(true)}
                className="text-sm text-emerald-600 font-semibold hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? 'Entrar' : 'Cadastrar')}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className="mt-8 flex flex-col gap-3">
              <button 
                onClick={() => setMode('register_tutor')}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
              >
                <User size={20} />
                Criar conta Petmaps
              </button>
              <button 
                onClick={() => setMode('register_parceiro')}
                className="w-full py-4 border-2 border-emerald-100 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
              >
                <Building2 size={20} />
                Sou uma Empresa / Parceiro
              </button>
            </div>
          </>
        )}

        {mode !== 'login' && (
          <div className="mt-8 text-center">
            <button 
              onClick={() => setMode('login')}
              className="text-emerald-600 font-semibold hover:underline"
            >
              Já tem uma conta? Entre
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
