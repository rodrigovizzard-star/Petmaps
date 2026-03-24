import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { MapPage } from './pages/MapPage';
import { AuthPage } from './pages/AuthPage';
import { RegisterPetPage } from './pages/RegisterPetPage';
import { EditPetPage } from './pages/EditPetPage';
import { PetDetailsPage } from './pages/PetDetailsPage';
import { PetListPage } from './pages/PetListPage';
import { PartnersPage } from './pages/PartnersPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { CompleteProfilePage } from './pages/CompleteProfilePage';
import { ProfessionalDashboardPage } from './pages/ProfessionalDashboardPage';
import { MyPetsPage } from './pages/MyPetsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyAndSecurityPage } from './pages/PrivacyAndSecurityPage';
import { isFirebaseConfigured } from './services/firebase';
import { AlertTriangle } from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthProvider } from './contexts/AuthContext';
import { petService } from './services/petService';

import { Logo } from './components/Logo';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const CleanupHandler = () => {
  const { user } = useAuth();
  
  useEffect(() => {
    const runCleanup = async () => {
      // Run cleanup if user is the admin email
      if (user?.email === 'rodrigovizzard@gmail.com') {
        const hasCleaned = sessionStorage.getItem('petmaps_cleanup_run');
        if (!hasCleaned) {
          console.log('App: Iniciando limpeza automática de histórico...');
          await petService.cleanupOrphanedHistory();
          sessionStorage.setItem('petmaps_cleanup_run', 'true');
        }
      }
    };
    runCleanup();
  }, [user]);

  return null;
};

const ConfigWarning = () => {
  const missingKeys = [
    !import.meta.env.VITE_FIREBASE_API_KEY && 'VITE_FIREBASE_API_KEY',
    !import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && 'VITE_FIREBASE_AUTH_DOMAIN',
    !import.meta.env.VITE_FIREBASE_PROJECT_ID && 'VITE_FIREBASE_PROJECT_ID',
    !import.meta.env.VITE_GOOGLE_MAPS_API_KEY && 'VITE_GOOGLE_MAPS_API_KEY',
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuração Necessária</h1>
        <p className="text-gray-600 mb-6 flex items-center justify-center gap-1 flex-wrap">
          Para o <Logo size="xs" /> funcionar, você precisa configurar as chaves do Firebase e do Google Maps no painel de segredos (Secrets) do AI Studio.
        </p>
        
        {missingKeys.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-red-500 uppercase mb-2">Chaves Faltantes:</p>
            <div className="text-left bg-red-50 p-4 rounded-2xl text-sm font-mono text-red-700 space-y-1">
              {missingKeys.map(key => <p key={key as string}>• {key}</p>)}
            </div>
          </div>
        )}

        <div className="bg-blue-50 p-4 rounded-2xl text-xs text-blue-700 mb-6 text-left">
          <strong>Dica:</strong> As chaves do Firebase geralmente começam com <code className="bg-blue-100 px-1 rounded">AIza</code>. Certifique-se de não estar usando a sua chave da Gemini API no lugar da chave do Firebase.
        </div>
        
        <p className="mt-6 text-xs text-gray-400">
          Dica: Certifique-se de adicionar o domínio do app (run.app) na lista de "Domínios Autorizados" no Firebase Auth.
        </p>
      </div>
    </div>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  
  if (!user) return <Navigate to="/auth" />;

  // Profile completion is no longer mandatory
  return <>{children}</>;
};

const ProfessionalRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  
  if ((profile?.role === 'empresa' || profile?.role === 'parceiro') && profile?.companyType !== 'canil') {
    return <>{children}</>;
  }
  
  return <Navigate to="/" />;
};

const TutorRoute = ({ children, allowSighted = false }: { children: React.ReactNode, allowSighted?: boolean }) => {
  const { profile, loading } = useAuth();
  const { type } = useParams<{ type: string }>();
  
  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  
  // If allowSighted is true and it's a sighted report, everyone can access
  if (allowSighted && type === 'sighted') {
    return <>{children}</>;
  }

  // Only allow tutors and canil partners to access these routes
  if (profile?.role === 'tutor' || profile?.companyType === 'canil') {
    return <>{children}</>;
  }
  
  // If partner, redirect to professional dashboard or home
  return <Navigate to="/professional" />;
};

export default function App() {
  if (!isFirebaseConfigured) {
    return <ConfigWarning />;
  }

  return (
    <AuthProvider>
      <APIProvider apiKey={API_KEY}>
        <Router>
          <CleanupHandler />
          <Routes>
              {/* ... routes ... */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/complete-profile" element={
                <PrivateRoute>
                  <CompleteProfilePage />
                </PrivateRoute>
              } />
              
              <Route path="/professional" element={
                <PrivateRoute>
                  <ProfessionalRoute>
                    <ProfessionalDashboardPage />
                  </ProfessionalRoute>
                </PrivateRoute>
              } />
              
              <Route path="/" element={
                <PrivateRoute>
                  <MapPage />
                </PrivateRoute>
              } />

              <Route path="/register" element={
                <PrivateRoute>
                  <RegisterPetPage />
                </PrivateRoute>
              } />

              <Route path="/register/:type" element={
                <PrivateRoute>
                  <RegisterPetPage />
                </PrivateRoute>
              } />

              <Route path="/edit-pet/:id" element={
                <PrivateRoute>
                  <EditPetPage />
                </PrivateRoute>
              } />

              <Route path="/pet/:id" element={<PetDetailsPage />} />

              <Route path="/lost" element={
                <PrivateRoute>
                  <PetListPage />
                </PrivateRoute>
              } />

              <Route path="/sighted" element={
                <PrivateRoute>
                  <PetListPage />
                </PrivateRoute>
              } />

              <Route path="/found" element={
                <PrivateRoute>
                  <PetListPage />
                </PrivateRoute>
              } />

              <Route path="/adoption" element={
                <PrivateRoute>
                  <PetListPage />
                </PrivateRoute>
              } />

              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/partners/:segment" element={<PartnersPage />} />

              <Route path="/profile" element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              } />

              <Route path="/edit-profile" element={
                <PrivateRoute>
                  <EditProfilePage />
                </PrivateRoute>
              } />

              <Route path="/my-pets" element={
                <PrivateRoute>
                  <MyPetsPage />
                </PrivateRoute>
              } />

              <Route path="/pets/:status" element={
                <PrivateRoute>
                  <PetListPage />
                </PrivateRoute>
              } />

              <Route path="/settings" element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              } />

              <Route path="/privacy" element={
                <PrivateRoute>
                  <PrivacyAndSecurityPage />
                </PrivateRoute>
              } />
            </Routes>
        </Router>
      </APIProvider>
    </AuthProvider>
  );
}
