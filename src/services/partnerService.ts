import { 
  doc,
  collection, 
  getDocs, 
  query, 
  where,
  addDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Partner } from '../types';

const PARTNERS_COLLECTION = 'partners';

export const partnerService = {
  async getPartners(city?: string, segment?: string): Promise<Partner[]> {
    const partnersRef = collection(db, PARTNERS_COLLECTION);
    let partnersQuery = query(partnersRef);
    
    if (city) {
      const cityLower = city.toLowerCase();
      const normalizedCity = cityLower.replace(/\s*-\s*/g, '-');
      const baseCity = cityLower.split('-')[0].trim();
      partnersQuery = query(partnersRef, where('cidade_search', 'array-contains-any', [normalizedCity, cityLower, baseCity]));
    }
    
    const snapshot = await getDocs(partnersQuery);
    let partners = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Partner));

    if (segment) {
      const segmentMap: Record<string, string> = {
        'petshop': 'petshop',
        'clinica': 'clínica veterinária',
        'agro': 'agropecuária',
        'seguro': 'seguro',
        'plano': 'plano de saúde',
        'criador': 'criadores',
        'canil': 'canil'
      };
      const targetSegment = segmentMap[segment] || segment;
      partners = partners.filter(p => p.segmento === targetSegment);
    }

    // Also fetch users with role 'empresa'
    const usersRef = collection(db, 'users');
    let usersQuery = query(usersRef, where('role', '==', 'empresa'));
    
    if (city) {
      const cityLower = city.toLowerCase();
      const normalizedCity = cityLower.replace(/\s*-\s*/g, '-');
      const baseCity = cityLower.split('-')[0].trim();
      usersQuery = query(usersRef, where('role', '==', 'empresa'), where('cidade_search', 'array-contains-any', [normalizedCity, cityLower, baseCity]));
    }
    
    const userSnapshot = await getDocs(usersQuery);
    
    const companyUsers = userSnapshot.docs.map(doc => {
      const data = doc.data();
      // Skip if already in partners list
      if (partners.some(p => p.userId === doc.id)) return null;
      
      const segmentMap: Record<string, string> = {
        'petshop': 'petshop',
        'clinica': 'clínica veterinária',
        'agro': 'agropecuária',
        'seguro': 'seguro',
        'plano': 'plano de saúde',
        'criador': 'criadores',
        'canil': 'canil'
      };

      const userSegment = segmentMap[data.companyType as string] || 'clínica veterinária';

      // Filter by segment if provided
      if (segment) {
        const targetSegment = segmentMap[segment] || segment;
        if (userSegment !== targetSegment) return null;
      }
      
      return {
        id: `user_${doc.id}`,
        userId: doc.id,
        nomeEmpresa: data.nome || data.displayName || 'Empresa Parceira',
        segmento: userSegment,
        endereço: data.cidade || 'Endereço não informado',
        cidade: data.cidade || '',
        localização: data.location || { lat: 0, lng: 0 },
        whatsapp: data.phone || '',
      } as Partner;
    }).filter((p): p is Partner => p !== null);

    return [...partners, ...companyUsers];
  },

  async getPartnersByCity(city: string): Promise<Partner[]> {
    const allPartners = await this.getPartners();
    return allPartners.filter(p => p.cidade.toLowerCase() === city.toLowerCase());
  },

  async addPartner(partner: Omit<Partner, 'id'>): Promise<string> {
    const partnersRef = collection(db, PARTNERS_COLLECTION);
    const docRef = await addDoc(partnersRef, {
      ...partner,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  async createPartnerProfile(userId: string, data: Omit<Partner, 'id' | 'userId'>) {
    const partnersRef = collection(db, PARTNERS_COLLECTION);
    const docRef = await addDoc(partnersRef, {
      ...data,
      cidade_search: (data.cidade || '') ? [
        (data.cidade || '').toLowerCase().replace(/\s*-\s*/g, '-'),
        (data.cidade || '').toLowerCase().split('-')[0].trim()
      ] : [],
      userId,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  async getPartnerByUserId(userId: string): Promise<Partner | null> {
    const partnersRef = collection(db, PARTNERS_COLLECTION);
    const q = query(partnersRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Partner;
    }
    return null;
  },

  async updatePartnerProfile(partnerId: string, data: Partial<Partner>) {
    if (!partnerId) throw new Error('Partner ID is required for updating profile');
    
    const docRef = doc(db, PARTNERS_COLLECTION, partnerId);
    const updates: any = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates[key] = value;
      }
    });

    if (Object.keys(updates).length === 0) {
      console.warn('No updates provided for partner profile:', partnerId);
      return;
    }

    if (updates.cidade) {
      updates.cidade_search = [
        updates.cidade.toLowerCase().replace(/\s*-\s*/g, '-'),
        updates.cidade.toLowerCase().split('-')[0].trim()
      ];
    }
    
    try {
      console.log(`Attempting to update partner profile ${partnerId} with:`, updates);
      await updateDoc(docRef, updates);
      console.log(`Successfully updated partner profile ${partnerId}`);
    } catch (error: any) {
      console.error(`Error in updatePartnerProfile for ID ${partnerId}:`, error);
      // Fallback to setDoc
      try {
        console.log(`Falling back to setDoc for partner profile ${partnerId}`);
        await setDoc(docRef, updates, { merge: true });
        console.log(`Successfully set partner profile ${partnerId} via fallback`);
      } catch (innerError: any) {
        console.error(`Fallback setDoc also failed for partner ID ${partnerId}:`, innerError);
        throw innerError;
      }
    }
  },

  async fixCitySearchFields() {
    console.log('Fixing city search fields...');
    const partnersRef = collection(db, PARTNERS_COLLECTION);
    const snapshot = await getDocs(partnersRef);
    let updatedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.cidade_search || !Array.isArray(data.cidade_search)) {
        const city = data.cidade || '';
        const normalized = city.toLowerCase().replace(/\s*-\s*/g, '-');
        const base = city.toLowerCase().split('-')[0].trim();
        await updateDoc(docSnap.ref, { 
          cidade_search: city ? [normalized, base] : []
        });
        updatedCount++;
      }
    }

    // Also fix users
    const usersRef = collection(db, 'users');
    const userSnapshot = await getDocs(usersRef);
    for (const docSnap of userSnapshot.docs) {
      const data = docSnap.data();
      if (!data.cidade_search || !Array.isArray(data.cidade_search)) {
        const city = data.cidade || '';
        const normalized = city.toLowerCase().replace(/\s*-\s*/g, '-');
        const base = city.toLowerCase().split('-')[0].trim();
        await updateDoc(docSnap.ref, { 
          cidade_search: city ? [normalized, base] : []
        });
        updatedCount++;
      }
    }

    return updatedCount;
  }
};
