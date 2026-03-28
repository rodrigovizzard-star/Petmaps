import { Timestamp } from 'firebase/firestore';

export type PetStatus = 'lost' | 'sighted' | 'found' | 'seguro' | 'perdido' | 'avistado' | 'encontrado' | 'foundOwner' | 'adoption' | 'adocao' | 'adopted' | 'doado';
export type PetType = 'dog' | 'cat' | 'other';
export type PetSize = 'small' | 'medium' | 'large' | 'unknown';

export interface PetLocation {
  lat: number;
  lng: number;
}

export interface PetUpdate {
  id: string;
  imageUrl: string;
  imageUrls?: string[];
  description: string;
  createdAt: any;
}

export interface MedicalRecord {
  id: string;
  date: any;
  clinicId?: string;
  clinicName: string;
  veterinarian: string;
  type: 'Consulta' | 'Exame' | 'Cirurgia' | 'Tratamento' | 'Outro';
  diagnosis: string;
  observations: string;
  imageUrl?: string;
  createdBy: 'tutor' | 'professional';
  createdAt: any;
}

export interface Vaccine {
  id: string;
  vaccineName: string;
  manufacturer: string;
  batch: string;
  applicationDate: any;
  nextDose?: any;
  veterinarianName: string;
  clinicName: string;
  clinicId?: string;
  notes: string;
  createdBy: 'tutor' | 'professional';
  createdAt: any;
  // Legacy fields for compatibility during transition
  date?: any;
  lot?: string;
}

export interface FoundEvent {
  id: string;
  petId: string;
  petDocId: string;
  petName: string;
  petImageUrl: string;
  foundAt: any;
  location: PetLocation;
  city: string;
  cidade_search?: string | string[];
  ownerId: string;
}

export interface Pet {
  id: string; // Firestore document ID
  petId: string; // PM7-XXXXXX
  ownerId: string;
  userId: string; // Keeping for compatibility
  type: PetType;
  species?: string;
  name?: string;
  breed?: string;
  size?: PetSize;
  sex?: 'male' | 'female';
  birthDate?: any;
  color?: string;
  description: string;
  status: PetStatus;
  location: PetLocation;
  city: string;
  cidade_search?: string | string[];
  imageUrl: string;
  imageUrls?: string[];
  createdAt: any;
  imageMetadata?: {
    hash?: string;
    features?: number[];
    [key: string]: any;
  };
  isActive: boolean;
  contactPhone?: string;
  updates?: PetUpdate[];
  lostObservations?: string;
  posterInstagramUrl?: string;
  posterStoryUrl?: string;
  posterPdfUrl?: string;
  nextVaccineDate?: any;
  ownerCpf?: string;
  ownerType?: 'clinica' | 'petshop' | 'agro' | 'seguro' | 'plano' | 'criador' | 'canil' | null;
  isCanil?: boolean;
  deletedByTutor?: boolean;
  hiddenByClinics?: string[];
}

export interface TransferRequest {
  id: string;
  petId: string;
  petName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: any;
  updatedAt?: any;
}

export interface UserProfile {
  userId: string;
  uid: string; // Compatibility
  email: string;
  nome: string;
  displayName?: string; // Compatibility
  fotoPerfil?: string;
  photoURL?: string; // Compatibility
  cidade?: string;
  cidade_search?: string | string[];
  phone?: string;
  cpf?: string;
  rg?: string;
  cnpj?: string;
  role: 'tutor' | 'parceiro' | 'empresa';
  companyType?: 'clinica' | 'petshop' | 'agro' | 'seguro' | 'plano' | 'criador' | 'canil';
  country?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  endereço?: string;
  dataCadastro: any;
  location?: PetLocation;
}

export interface Partner {
  id: string;
  userId: string; // Link to the user account
  nomeEmpresa: string;
  segmento: 'petshop' | 'clínica veterinária' | 'agropecuária' | 'seguro' | 'plano de saúde' | 'criadores' | 'canil';
  companyType?: 'clinica' | 'petshop' | 'agro' | 'seguro' | 'plano' | 'criador' | 'canil';
  endereço: string;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  cidade_search?: string;
  cnpj?: string;
  localização: PetLocation;
  whatsapp: string;
}
