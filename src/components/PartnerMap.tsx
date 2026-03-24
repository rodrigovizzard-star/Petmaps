import React from 'react';
import { 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow 
} from '@vis.gl/react-google-maps';
import { Partner } from '../types';
import { MessageCircle, MapPin, Percent } from 'lucide-react';
import { formatWhatsAppLink } from '../utils';

import { Logo } from './Logo';

interface PartnerMapProps {
  partners: Partner[];
  center?: { lat: number; lng: number };
}

export const PartnerMap: React.FC<PartnerMapProps> = ({ partners, center }) => {
  const [selectedPartner, setSelectedPartner] = React.useState<Partner | null>(null);

  return (
    <Map
      style={{ width: '100%', height: '100%' }}
      defaultCenter={center || { lat: -23.5505, lng: -46.6333 }}
      defaultZoom={12}
      gestureHandling={'greedy'}
      disableDefaultUI={true}
      mapId="PARTNER_MAP_ID"
    >
      {partners.map((partner) => (
        <AdvancedMarker
          key={partner.id}
          position={partner.localização}
          onClick={() => setSelectedPartner(partner)}
        >
          <Pin 
            background={'#10b981'} 
            borderColor={'#fff'} 
            glyphColor={'#fff'}
            scale={1.2}
          />
        </AdvancedMarker>
      ))}

      {selectedPartner && (
        <InfoWindow
          position={selectedPartner.localização}
          onCloseClick={() => setSelectedPartner(null)}
        >
          <div className="p-3 max-w-[240px] flex flex-col gap-3">
            <div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full text-[8px] font-bold uppercase tracking-wider mb-1 inline-block">
                {selectedPartner.segmento}
              </span>
              <h3 className="font-bold text-gray-900 text-sm leading-tight">{selectedPartner.nomeEmpresa}</h3>
              <div className="flex items-center gap-1 text-gray-400 text-[10px] mt-1">
                <MapPin size={10} />
                {selectedPartner.cidade}
              </div>
            </div>

            <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg">
              <p className="font-medium text-gray-700 mb-0.5">Endereço:</p>
              <p>{selectedPartner.endereço}</p>
            </div>

            <a 
              href={formatWhatsAppLink(selectedPartner.whatsapp, `Olá! Vi o parceiro ${selectedPartner.nomeEmpresa} e gostaria de mais informações.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
};
