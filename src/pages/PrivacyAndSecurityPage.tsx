import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ArrowLeft, Shield, Lock, Eye, Key, Trash2, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/userService';

export const PrivacyAndSecurityPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    const confirmMsg = 'TEM CERTEZA? Esta ação é IRREVERSÍVEL. Todos os seus dados e pets serão excluídos permanentemente.';
    if (window.confirm(confirmMsg)) {
      try {
        await userService.deleteAccount(user.uid);
        alert('Sua conta foi excluída com sucesso.');
        // The auth state listener will handle redirection
      } catch (error: any) {
        console.error('Error deleting account:', error);
        if (error.code === 'auth/requires-recent-login') {
          alert('Para sua segurança, esta ação exige um login recente. Por favor, saia e entre novamente antes de excluir sua conta.');
        } else {
          alert('Erro ao excluir conta. Por favor, tente novamente mais tarde.');
        }
      }
    }
  };

  const sections = [
    {
      title: 'Privacidade',
      icon: <Eye className="text-emerald-600" size={24} />,
      items: [
        {
          label: 'Visibilidade do Perfil',
          description: 'Controle quem pode ver suas informações de contato.',
          action: () => alert('Funcionalidade em desenvolvimento.')
        },
        {
          label: 'Dados Compartilhados',
          description: 'Veja quais dados são compartilhados com parceiros.',
          action: () => alert('Funcionalidade em desenvolvimento.')
        }
      ]
    },
    {
      title: 'Segurança',
      icon: <Lock className="text-emerald-600" size={24} />,
      items: [
        {
          label: 'Alterar Senha',
          description: 'Recomendamos trocar sua senha periodicamente.',
          action: () => alert('Funcionalidade em desenvolvimento.')
        },
        {
          label: 'Autenticação em Duas Etapas',
          description: 'Adicione uma camada extra de proteção à sua conta.',
          action: () => alert('Funcionalidade em desenvolvimento.')
        }
      ]
    }
  ];

  return (
    <Layout 
      title="Privacidade e Segurança"
      leftElement={
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
      }
    >
      <div className="flex-1 bg-gray-50 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
        <div className="p-6 max-w-2xl mx-auto w-full space-y-8">
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-3xl shadow-inner">
              <Shield size={48} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Sua Segurança em Primeiro Lugar</h1>
              <p className="text-gray-500 font-medium">Gerencie suas preferências de privacidade e proteja sua conta.</p>
            </div>
          </div>

          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                {section.icon}
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{section.title}</h2>
              </div>
              
              <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-gray-100">
                {section.items.map((item, itemIdx) => (
                  <button
                    key={itemIdx}
                    onClick={item.action}
                    className={`w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors text-left ${
                      itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-400 font-medium">{item.description}</p>
                    </div>
                    <ChevronRight size={20} className="text-gray-300" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-8 border-t border-gray-200">
            <div className="bg-red-50 rounded-[2rem] p-8 space-y-6 border border-red-100">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle size={24} />
                <h2 className="text-lg font-black uppercase tracking-tight">Zona de Perigo</h2>
              </div>
              
              <p className="text-sm text-red-600/70 font-medium">
                Ao excluir sua conta, todos os seus dados, pets cadastrados e histórico serão removidos permanentemente de nossos servidores.
              </p>

              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center justify-center gap-3 p-5 bg-white text-red-600 rounded-2xl font-black shadow-sm border border-red-100 hover:bg-red-600 hover:text-white transition-all active:scale-95"
              >
                <Trash2 size={24} />
                EXCLUIR MINHA CONTA
              </button>
            </div>
          </div>
          
          <div className="text-center pb-8">
            <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
              Petmaps v2.0 • Proteção de Dados Garantida
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};
