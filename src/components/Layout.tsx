import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  headerType?: 'default' | 'none' | 'absolute';
  leftElement?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, headerType = 'default', leftElement }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, profile } = useAuth();
  const location = useLocation();
  const isMapPage = location.pathname === '/' || location.pathname === '/index.html' || location.pathname === '';

  return (
    <div className="h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {headerType === 'default' && (
        <header className="p-4 bg-white border-b flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors group"
            >
              <Menu size={24} />
              <span className="hidden sm:block font-bold text-sm uppercase tracking-wider">Menu</span>
            </button>
            {leftElement}
            {title && <h1 className="text-xl font-bold text-gray-900">{title}</h1>}
          </div>
          
          <div className="flex items-center gap-3 bg-white border border-gray-100 px-4 py-2 rounded-2xl shadow-sm">
            {isMapPage && (
              <>
                <Link to="/" className="hover:opacity-80 transition-opacity">
                  <Logo size="sm" />
                </Link>
                <div className="w-px h-6 bg-gray-100 mx-1" />
              </>
            )}
            <Link to="/profile" className="w-8 h-8 rounded-xl overflow-hidden bg-gray-200 border border-white shadow-sm hover:ring-2 hover:ring-emerald-500 transition-all flex items-center justify-center">
              {profile?.fotoPerfil || user?.photoURL ? (
                <img src={profile?.fotoPerfil || user?.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <UserIcon size={16} />
                </div>
              )}
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1 relative flex flex-col overflow-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {children}
      </main>

      {headerType === 'absolute' && (
        <header className="fixed top-4 left-4 right-4 z-[100] pointer-events-none flex items-center justify-between">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-3 bg-white shadow-lg rounded-2xl pointer-events-auto hover:bg-gray-50 transition-colors"
          >
            <Menu size={24} className="text-gray-700" />
          </button>

          <div className="flex items-center gap-3 bg-white shadow-lg rounded-2xl px-4 py-2 pointer-events-auto border border-white/40 backdrop-blur-md">
            {isMapPage && (
              <>
                <Link to="/" className="hover:opacity-80 transition-opacity">
                  <Logo size="sm" />
                </Link>
                <div className="w-px h-6 bg-gray-200/50 mx-1" />
              </>
            )}
            <Link 
              to="/profile" 
              className="w-9 h-9 bg-gray-100 rounded-xl overflow-hidden border border-white hover:ring-2 hover:ring-emerald-500 transition-all flex items-center justify-center"
            >
              {profile?.fotoPerfil || user?.photoURL ? (
                <img src={profile?.fotoPerfil || user?.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <UserIcon size={20} />
                </div>
              )}
            </Link>
          </div>
        </header>
      )}
    </div>
  );
};
