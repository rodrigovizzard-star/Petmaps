import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { MapPin, Shield, ChevronRight, Loader2 } from 'lucide-react';
import { userService } from '../services/userService';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';

export const SettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    location: null as { lat: number, lng: number } | null,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setSettings({
          location: data.location ?? null,
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [user]);

  const handleUpdateLocation = () => {
    if (!user) return;
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          // Try to get city name from coordinates
          let city = '';
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=10`);
            const data = await response.json();
            const cityName = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
            
            // Try to get state abbreviation (ISO3166-2)
            let stateAbbr = '';
            if (data.address['ISO3166-2-lvl4']) {
              stateAbbr = data.address['ISO3166-2-lvl4'].split('-')[1];
            }
            
            city = stateAbbr ? `${cityName}-${stateAbbr}` : cityName;
          } catch (geoError) {
            console.error('Error in reverse geocoding:', geoError);
          }

          setSettings(prev => ({ ...prev, location, ...(city ? { cidade: city } : {}) }));
          await userService.updateUserProfile(user.uid, { 
            location,
            ...(city ? { cidade: city } : {})
          });
          
          if (city) {
            alert(`Localização atualizada para ${city}!`);
          } else {
            alert('Localização atualizada com sucesso!');
          }
        } catch (error) {
          console.error('Error updating location:', error);
          alert('Erro ao salvar localização no servidor.');
        } finally {
          setSaving(false);
        }
      },
      (error) => {
        console.error(error);
        alert('Erro ao obter localização do GPS.');
        setSaving(false);
      }
    );
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-emerald-600" /></div></Layout>;

  return (
    <Layout>
      <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
        <div className="max-w-2xl mx-auto p-6 space-y-8">
        <header>
          <h1 className="text-3xl font-black text-gray-900">Configurações</h1>
          <p className="text-gray-500">Gerencie suas preferências</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Localização</h2>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <MapPin size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">Sua Localização Base</p>
                <p className="text-xs text-gray-500">
                  {settings.location 
                    ? `${settings.location.lat.toFixed(4)}, ${settings.location.lng.toFixed(4)}` 
                    : 'Não configurada'}
                </p>
              </div>
              <button 
                onClick={handleUpdateLocation}
                disabled={saving}
                className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Atualizar'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed italic">
              Usamos sua localização para mostrar pets perdidos ou avistados perto de você no mapa.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Conta</h2>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <button className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                  <Shield size={24} />
                </div>
                <p className="font-bold text-gray-900">Privacidade e Segurança</p>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </button>
          </div>
        </section>
      </div>
    </div>
  </Layout>
  );
};
