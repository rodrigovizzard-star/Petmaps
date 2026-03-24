import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { PetMap } from '../components/PetMap';
import { petService } from '../services/petService';
import { Pet } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const MapPage = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const zoom = searchParams.get('zoom');

  const [allPets, setAllPets] = useState<Pet[]>([]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(
    lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined
  );
  const [mapZoom, setMapZoom] = useState<number>(zoom ? parseInt(zoom) : 4);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPets = async () => {
      console.log('MapPage: Fetching active pets...');
      const data = await petService.getActivePets();
      console.log(`MapPage: Found ${data.length} active pets`, data);
      setAllPets(data);
    };
    fetchPets();
  }, []);

  return (
    <Layout headerType="absolute">
      <div className="h-full w-full relative flex flex-col">
        {/* Map Container */}
        <div className="flex-1 relative">
          <PetMap 
            pets={allPets} 
            onMarkerClick={(pet) => navigate(`/pet/${pet.petId || pet.id}`)} 
            center={mapCenter}
            zoom={mapZoom}
            isCanil={profile?.companyType === 'canil'}
          />
        </div>
      </div>
    </Layout>
  );
};
