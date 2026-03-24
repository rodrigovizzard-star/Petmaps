import { PetStatus } from '../types';

export const getStatusLabel = (status: PetStatus | string, countryCode?: string, isCanil?: boolean): string => {
  const isSpain = countryCode?.startsWith('+34');
  const isEnglish = countryCode?.startsWith('+1') || countryCode?.startsWith('+44');
  const lang = isSpain ? 'es' : (isEnglish ? 'en' : 'pt');

  const translations: Record<string, Record<string, string>> = {
    'pt': {
      'lost': 'Perdido',
      'perdido': 'Perdido',
      'found': 'Encontrado',
      'foundowner': 'Encontrado',
      'seguro': 'Seguro',
      'safe': 'Seguro',
      'sighted': 'Avistado',
      'avistado': 'Avistado',
      'adoption': 'Para Doação',
      'adopted': 'Doado'
    },
    'en': {
      'lost': 'Lost',
      'perdido': 'Lost',
      'found': 'Found',
      'foundowner': 'Found',
      'seguro': 'Safe',
      'safe': 'Safe',
      'sighted': 'Sighted',
      'adoption': 'Adoption',
      'adopted': 'Adopted'
    },
    'es': {
      'lost': 'Perdido',
      'perdido': 'Perdido',
      'found': 'Encontrado',
      'foundowner': 'Encontrado',
      'seguro': 'Encontrado',
      'safe': 'Encontrado',
      'sighted': 'Avistado',
      'adoption': 'En Adopción',
      'adopted': 'Adoptado'
    }
  };

  if (!status) return status || '';
  const statusLower = status.toLowerCase();
  return translations[lang]?.[statusLower] || status;
};

export const getTranslation = (key: string, countryCode?: string, isCanil?: boolean): string => {
  const isSpain = countryCode?.startsWith('+34');
  const isEnglish = countryCode?.startsWith('+1') || countryCode?.startsWith('+44');
  const lang = isSpain ? 'es' : (isEnglish ? 'en' : 'pt');

  const translations: Record<string, Record<string, string>> = {
    'pt': {
      'lastSeen': 'Visto pela última vez em',
      'foundEx': 'Encontrado!',
      'foundAt': 'Encontrado em'
    },
    'en': {
      'lastSeen': 'Last seen in',
      'foundEx': 'Found!',
      'foundAt': 'Found at'
    },
    'es': {
      'lastSeen': 'Visto por última vez en',
      'foundEx': '¡Encontrado!',
      'foundAt': 'Encontrado en'
    }
  };

  return translations[lang]?.[key] || key;
};
