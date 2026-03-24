import React from 'react';
import { 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { Pet, PetStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { petService } from '../services/petService';
import { Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PetMapProps {
  pets: Pet[];
  onMarkerClick: (pet: Pet) => void;
  onDeletePet?: (petId: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  isCanil?: boolean;
}

const getStatusColor = (status: PetStatus) => {
  switch (status) {
    case 'lost':
    case 'perdido': 
      return '#ef4444'; // Red
    case 'sighted': 
      return '#f97316'; // Orange (Visto)
    case 'found':
    case 'foundOwner':
    case 'seguro':
      return '#22c55e'; // Green (Encontrado/Seguro)
    case 'adoption':
      return '#a855f7'; // Purple (Em Doação)
    case 'adopted':
      return '#3b82f6'; // Blue (Adotado)
    default: 
      return '#6b7280';
  }
};

const CompactMarker = ({ color, onClick, size }: { color: string; onClick: () => void; size: number }) => (
  <div 
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="group relative flex items-center justify-center cursor-pointer"
    style={{ width: size * 1.5, height: size * 1.5 }}
  >
    {/* Outer glow/ring */}
    <div 
      className="absolute rounded-full opacity-20 transition-all group-hover:opacity-40 group-hover:scale-125"
      style={{ 
        backgroundColor: color,
        width: size * 1.8,
        height: size * 1.8
      }}
    />
    {/* The dot itself */}
    <div 
      className="rounded-full border shadow-md transition-transform group-hover:scale-110 z-10"
      style={{ 
        backgroundColor: color,
        width: size,
        height: size,
        borderWidth: size > 8 ? 2 : 1,
        borderColor: 'white'
      }}
    />
  </div>
);

export const PetMap: React.FC<PetMapProps> = ({ pets, onMarkerClick, onDeletePet, center, zoom, isCanil }) => {
  const { user } = useAuth();
  const [selectedPet, setSelectedPet] = React.useState<Pet | null>(null);
  const [currentZoom, setCurrentZoom] = React.useState(zoom || 4);
  const map = useMap();

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      let d: Date;
      if (date.toDate) d = date.toDate();
      else if (date.seconds) d = new Date(date.seconds * 1000);
      else d = new Date(date);
      return format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch (e) {
      return '';
    }
  };

  const [showDeleteModal, setShowDeleteModal] = React.useState<string | null>(null);

  const handleDeleteSightedPet = (e: React.MouseEvent, petId: string) => {
    e.stopPropagation();
    setShowDeleteModal(petId);
  };

  const confirmDeleteSightedPet = async () => {
    if (!showDeleteModal) return;
    const petId = showDeleteModal;
    setShowDeleteModal(null);

    try {
      await petService.deletePet(petId);
      setSelectedPet(null);
      if (onDeletePet) {
        onDeletePet(petId);
      }
    } catch (error) {
      console.error('Error deleting sighted pet:', error);
    }
  };

  // Listen for zoom changes to update marker sizes and spread
  React.useEffect(() => {
    if (!map) return;
    const listener = map.addListener('zoom_changed', () => {
      const newZoom = map.getZoom();
      if (newZoom !== undefined) setCurrentZoom(newZoom);
    });
    return () => listener.remove();
  }, [map]);

  // Calculate marker size based on zoom (micro points when zoomed out, normal when zoomed in)
  const markerSize = React.useMemo(() => {
    // Zoom 4 (Brazil) -> ~7px
    // Zoom 15 (City) -> ~20px
    // Zoom 18+ (Street) -> ~24px
    return Math.max(7, Math.min(24, (currentZoom - 4) * (13.5 / 11) + 7));
  }, [currentZoom]);

  // Group pets by location to handle overlaps and spread them out
  const petsWithPositions = React.useMemo(() => {
    const groups: Record<string, Pet[]> = {};
    const validPets: Pet[] = [];

    pets.forEach(pet => {
      // Don't show 'seguro' pets on the map
      if (pet.status === 'seguro') return;

      const lat = typeof pet.location?.lat === 'string' ? parseFloat(pet.location.lat) : pet.location?.lat;
      const lng = typeof pet.location?.lng === 'string' ? parseFloat(pet.location.lng) : pet.location?.lng;

      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        // Use a key with 5 decimal places to group pets that are very close
        const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(pet);
        validPets.push(pet);
      }
    });

    // Calculate spread positions for each pet
    const positions: Record<string, { lat: number; lng: number }> = {};
    
    Object.keys(groups).forEach(key => {
      const group = groups[key];
      const [baseLat, baseLng] = key.split('_').map(Number);
      
      group.forEach((pet, index) => {
        if (group.length === 1) {
          positions[pet.id] = { lat: baseLat, lng: baseLng };
        } else {
          // Spiral pattern for multiple pets at the same location
          const angle = index * (Math.PI * (3 - Math.sqrt(5)));
          
          // Dynamic radius based on zoom to maintain visual separation in pixels
          // We target roughly 30-40 pixels of separation on screen
          const pixelOffset = 35;
          const zoomFactor = 360 / (256 * Math.pow(2, currentZoom));
          const radius = (pixelOffset * zoomFactor) * Math.sqrt(index);
          
          // Cap the radius to prevent pets from appearing too far from their actual city
          const maxRadius = 0.15; // ~16km
          const finalRadius = Math.min(radius, maxRadius);
          
          positions[pet.id] = {
            lat: baseLat + finalRadius * Math.cos(angle),
            lng: baseLng + finalRadius * Math.sin(angle)
          };
        }
      });
    });

    return { validPets, positions };
  }, [pets, currentZoom]);

  React.useEffect(() => {
    if (map && center) {
      map.panTo(center);
      if (zoom) map.setZoom(zoom);
    }
  }, [map, center, zoom]);

  return (
    <div className="w-full h-full relative">
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultCenter={center || { lat: -14.235, lng: -51.925 }} // Brazil default
        defaultZoom={zoom || 4}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
        mapId="PETMAPS_MAP_ID"
        onZoomChanged={(e) => setCurrentZoom(e.detail.zoom)}
      >
        {petsWithPositions.validPets.map((pet) => {
          const position = petsWithPositions.positions[pet.id];

          return (
            <AdvancedMarker
              key={pet.id}
              position={position}
              onClick={() => setSelectedPet(pet)}
            >
              <CompactMarker 
                color={getStatusColor(pet.status)} 
                onClick={() => setSelectedPet(pet)} 
                size={markerSize}
              />
            </AdvancedMarker>
          );
        })}

        {selectedPet && (
          <InfoWindow
            position={petsWithPositions.positions[selectedPet.id]}
            onCloseClick={() => setSelectedPet(null)}
          >
            <div className="p-2 max-w-[200px] flex flex-col gap-2">
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img 
                   src={selectedPet.imageUrl || selectedPet.petImageUrl} 
                   alt={selectedPet.name || selectedPet.petName} 
                   className="w-full h-full object-cover"
                   referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{selectedPet.name || selectedPet.petName || 'Pet sem nome'}</h3>
                
                {(selectedPet.status === 'sighted' || selectedPet.status === 'avistado') ? (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <Calendar size={10} />
                      <span>Registrado em: {formatDate(selectedPet.createdAt)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-2 italic">
                      {selectedPet.description || 'Sem descrição'}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 font-medium">{selectedPet.breed || 'Raça não informada'}</p>
                    <p className="text-[10px] text-gray-400">{selectedPet.city}</p>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => onMarkerClick(selectedPet)}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                >
                  Ver Detalhes
                </button>
                {(selectedPet.status === 'sighted' || selectedPet.status === 'avistado') && user?.uid === (selectedPet.ownerId || selectedPet.userId) && (
                  <button 
                    onClick={(e) => handleDeleteSightedPet(e, selectedPet.id)}
                    className="px-3 bg-red-50 text-red-600 py-2 rounded-xl hover:bg-red-100 transition-colors"
                    title="Excluir Registro"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Minimal Legend - Positioned at the bottom center with fixed positioning for mobile reliability. z-index is higher than map controls but lower than sidebar. */}
      <div className="fixed bottom-10 sm:bottom-12 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl sm:rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[100] border border-white/40 flex items-center gap-3 sm:gap-6 w-[92%] sm:w-auto justify-center pointer-events-auto overflow-x-hidden">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ef4444] border-2 border-white shadow-sm" />
          <span className="text-[8px] sm:text-[10px] font-black text-gray-800 uppercase tracking-tighter">Perdido</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#f97316] border-2 border-white shadow-sm" />
          <span className="text-[8px] sm:text-[10px] font-black text-gray-800 uppercase tracking-tighter">Visto</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#22c55e] border-2 border-white shadow-sm" />
          <span className="text-[8px] sm:text-[10px] font-black text-gray-800 uppercase tracking-tighter">Encontrado</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#a855f7] border-2 border-white shadow-sm" />
          <span className="text-[8px] sm:text-[10px] font-black text-gray-800 uppercase tracking-tighter">Para Doação</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#3b82f6] border-2 border-white shadow-sm" />
          <span className="text-[8px] sm:text-[10px] font-black text-gray-800 uppercase tracking-tighter">Doado</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900">Excluir Registro</h3>
                <p className="text-gray-500 text-sm">
                  Deseja realmente excluir este registro de pet avistado? Esta ação não pode ser desfeita.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={confirmDeleteSightedPet}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-red-700 transition-all active:scale-95"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
