import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  LogOut,
  X,
  Search as SearchIcon,
  Home
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../utils';
import { Clipboard } from 'lucide-react';

import { Logo } from './Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchId, setSearchId] = useState('');
  
  const menuItems = React.useMemo(() => {
    const items = [
      { icon: Home, label: 'Início', path: '/' },
      { icon: User, label: 'Meu Perfil', path: '/profile' },
    ];

    if ((profile?.role === 'parceiro' || profile?.role === 'empresa') && profile?.companyType !== 'canil') {
      items.splice(1, 0, { icon: Clipboard, label: 'Painel Profissional', path: '/professional' });
    }

    return items;
  }, [profile]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      navigate(`/pet/${searchId.trim().toUpperCase()}`);
      setSearchId('');
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 z-[150]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[200] shadow-xl flex flex-col"
            >
              <div className="p-6 border-bottom flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Logo size="md" />
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="px-6 py-4">
                <form onSubmit={handleSearch} className="relative group">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="Pesquisa Pet (ID)"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    className="w-full pl-10 pr-20 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                  />
                  <button 
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Buscar
                  </button>
                </form>
              </div>

              <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl transition-colors",
                      location.pathname === item.path 
                        ? "bg-emerald-50 text-emerald-700 font-medium" 
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {item.label === 'Meu Perfil' && (profile?.fotoPerfil || profile?.photoURL) ? (
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-emerald-200">
                        <img src={profile.fotoPerfil || profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <item.icon size={20} />
                    )}
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="p-4 border-t">
                <button
                  onClick={() => auth.signOut()}
                  className="flex items-center gap-4 px-4 py-3 w-full text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut size={20} />
                  Sair
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
