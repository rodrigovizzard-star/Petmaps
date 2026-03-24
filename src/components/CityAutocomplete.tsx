/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface CityAutocompleteProps {
  onCitySelect: (city: string, location: { lat: number; lng: number }) => void;
  defaultValue?: string;
  placeholder?: string;
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({ 
  onCitySelect, 
  defaultValue = '',
  placeholder = 'Digite o nome da cidade...'
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLibrary = useMapsLibrary('places');
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLibrary || !inputRef.current) return;

    const options = {
      types: ['(cities)'],
      componentRestrictions: { country: 'br' }, // Restrict to Brazil
      fields: ['address_components', 'geometry', 'name', 'formatted_address']
    };

    const ac = new placesLibrary.Autocomplete(inputRef.current, options);
    setAutocomplete(ac);

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.geometry && place.geometry.location) {
        let cityName = place.name || '';
        let stateAbbr = '';

        // Extract state abbreviation from address components
        if (place.address_components) {
          const stateComponent = place.address_components.find(c => 
            c.types.includes('administrative_area_level_1')
          );
          if (stateComponent) {
            stateAbbr = stateComponent.short_name;
          }
        }

        const fullCityName = stateAbbr ? `${cityName}-${stateAbbr}` : cityName;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        setInputValue(fullCityName);
        onCitySelect(fullCityName, { lat, lng });
      }
    });

    return () => {
      if (autocomplete) {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [placesLibrary]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
        required
      />
    </div>
  );
};
