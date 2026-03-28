import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  deleteDoc,
  orderBy,
  Timestamp,
  collectionGroup
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { Pet, PetStatus, MedicalRecord, Vaccine } from '../types';

const PETS_COLLECTION = 'pets';
const FOUND_HISTORY_COLLECTION = 'found_history';

function generateRandomPetId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PM7-${result}`;
}

export const petService = {
  async generateUniquePetId(): Promise<string> {
    let petId = generateRandomPetId();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const q = query(collection(db, PETS_COLLECTION), where('petId', '==', petId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        isUnique = true;
      } else {
        petId = generateRandomPetId();
        attempts++;
      }
    }
    return petId;
  },

  async createPet(petData: Omit<Pet, 'id' | 'petId' | 'createdAt' | 'isActive'>, imageFiles: File[]) {
    console.log('petService: Iniciando upload das imagens...', imageFiles.length);
    
    try {
      const imageUrls: string[] = [];
      
      for (const file of imageFiles) {
        try {
          const storageRef = ref(storage, `pets/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(snapshot.ref);
          imageUrls.push(url);
        } catch (storageError: any) {
          console.warn('petService: Erro no Storage, tentando fallback base64:', storageError);
          const base64: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          
          if (base64.length > 1000000) {
            throw new Error('Uma das imagens é muito grande. Por favor, use fotos menores.');
          }
          imageUrls.push(base64);
        }
      }

      console.log('petService: Uploads concluídos. URLs:', imageUrls.map(u => u.startsWith('data:') ? 'base64...' : u));

      const petId = (petData.status === 'sighted' || petData.status === 'avistado') ? '' : await this.generateUniquePetId();

      // 2. Save to Firestore
      const finalPetData: any = {};
      Object.entries(petData).forEach(([key, value]) => {
        if (value !== undefined) {
          finalPetData[key] = value;
        }
      });

      const docRef = await addDoc(collection(db, PETS_COLLECTION), {
        ...finalPetData,
        petId,
        ownerId: (petData.status === 'sighted' || petData.status === 'avistado') ? null : (petData.ownerId || (petData as any).userId),
        ownerType: (petData as any).ownerType || null,
        isCanil: (petData as any).ownerType === 'canil',
        imageUrl: imageUrls[0] || '',
        imageUrls,
        cidade_search: (petData.city || '') ? [
          (petData.city || '').toLowerCase().replace(/\s*-\s*/g, '-'),
          (petData.city || '').toLowerCase().split('-')[0].trim()
        ] : [],
        createdAt: Timestamp.now(),
        isActive: petData.status === 'perdido' || petData.status === 'lost' || petData.status === 'sighted' || petData.status === 'adoption',
        imageMetadata: {},
        updates: [],
      });
      return docRef.id;
    } catch (error: any) {
      console.error('petService: Erro durante o processo:', error);
      throw error;
    }
  },

  async addStoryUpdate(petId: string, description: string, imageFile: File) {
    console.log('petService: Adicionando atualização à história...', petId);
    let imageUrl = '';
    
    try {
      const storageRef = ref(storage, `stories/${petId}/${Date.now()}_${imageFile.name}`);
      const snapshot = await uploadBytes(storageRef, imageFile);
      imageUrl = await getDownloadURL(snapshot.ref);
    } catch (storageError: any) {
      console.warn('petService: Erro no Storage (story), usando fallback base64:', storageError);
      imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });
      
      if (imageUrl.length > 1000000) {
        throw new Error('A imagem da história é muito grande. Por favor, use uma foto menor.');
      }
    }

    const petRef = doc(db, PETS_COLLECTION, petId);
    const petSnap = await getDoc(petRef);
    
    if (petSnap.exists()) {
      const currentUpdates = petSnap.data().updates || [];
      const newUpdate = {
        id: Date.now().toString(),
        imageUrl,
        description,
        createdAt: Timestamp.now(),
      };

      await updateDoc(petRef, {
        updates: [...currentUpdates, newUpdate]
      });
      return newUpdate;
    }
    throw new Error('Pet não encontrado');
  },

  async getActivePets(status?: PetStatus, city?: string, onlyCanil?: boolean) {
    try {
      let q;
      const constraints: any[] = [];

      if (status) {
        const statusMap: Record<string, string[]> = {
          'lost': ['lost', 'perdido', 'desaparecido'],
          'perdido': ['lost', 'perdido', 'desaparecido'],
          'found': ['found', 'foundowner', 'encontrado'],
          'foundOwner': ['found', 'foundowner', 'encontrado'],
          'seguro': ['seguro', 'safe'],
          'adopted': ['adopted', 'doado'],
          'doado': ['adopted', 'doado'],
          'sighted': ['sighted', 'avistado'],
          'adoption': ['adoption', 'adocao']
        };
        const statuses = statusMap[status] || [status];
        constraints.push(where('status', 'in', statuses.slice(0, 10)));
      } else {
        constraints.push(where('status', 'in', [
          'lost', 'perdido', 'found', 'foundowner', 
          'sighted', 'avistado', 'adoption', 'adocao', 'adopted', 'doado'
        ]));
      }

      if (city) {
        const cityLower = city.toLowerCase();
        const normalizedCity = cityLower.replace(/\s*-\s*/g, '-');
        const baseCity = cityLower.split('-')[0].trim();
        // Use 'array-contains-any' to match any of the possible city formats
        constraints.push(where('cidade_search', 'array-contains-any', [normalizedCity, cityLower, baseCity]));
      }

      if (onlyCanil) {
        constraints.push(where('isCanil', '==', true));
      }

      q = query(collection(db, PETS_COLLECTION), ...constraints);

      const querySnapshot = await getDocs(q);
      const pets = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...(doc.data() as object)
        }))
        .filter((pet: any) => !pet.deletedByTutor) as Pet[];

      // Sort client-side to avoid index requirements
      return pets.sort((a, b) => {
        const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate() : new Date(a.createdAt as any);
        const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate() : new Date(b.createdAt as any);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error('Error fetching pets:', error);
      return [];
    }
  },

  async getPetByPetId(petId: string) {
    const q = query(collection(db, PETS_COLLECTION), where('petId', '==', petId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Pet;
    }
    return null;
  },

  async getPetById(id: string) {
    const docRef = doc(db, PETS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Pet;
    }
    return null;
  },

  async getMedicalRecords(petId: string): Promise<MedicalRecord[]> {
    const recordsRef = collection(db, PETS_COLLECTION, petId, 'medicalRecords');
    const snapshot = await getDocs(recordsRef);
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord));
    return records.sort((a, b) => {
      const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
      const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  },

  async addMedicalRecord(petId: string, record: Omit<MedicalRecord, 'id' | 'createdAt'>) {
    const recordsRef = collection(db, PETS_COLLECTION, petId, 'medicalRecords');
    const docRef = await addDoc(recordsRef, {
      ...record,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  async updateMedicalRecord(petId: string, recordId: string, data: Partial<MedicalRecord>) {
    const recordRef = doc(db, PETS_COLLECTION, petId, 'medicalRecords', recordId);
    await updateDoc(recordRef, data);
  },

  async deleteMedicalRecord(petId: string, recordId: string) {
    const recordRef = doc(db, PETS_COLLECTION, petId, 'medicalRecords', recordId);
    await deleteDoc(recordRef);
  },

  async getVaccines(petId: string): Promise<Vaccine[]> {
    const vaccinesRef = collection(db, PETS_COLLECTION, petId, 'vaccines');
    const snapshot = await getDocs(vaccinesRef);
    const vaccines = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        // Map legacy fields if they exist
        applicationDate: data.applicationDate || data.date,
        batch: data.batch || data.lot || '',
      } as Vaccine;
    });
    return vaccines.sort((a, b) => {
      const dateA = a.applicationDate instanceof Timestamp ? a.applicationDate.toDate() : new Date(a.applicationDate);
      const dateB = b.applicationDate instanceof Timestamp ? b.applicationDate.toDate() : new Date(b.applicationDate);
      return dateB.getTime() - dateA.getTime();
    });
  },

  async addVaccine(petId: string, vaccine: Omit<Vaccine, 'id' | 'createdAt'>) {
    const vaccinesRef = collection(db, PETS_COLLECTION, petId, 'vaccines');
    const docRef = await addDoc(vaccinesRef, {
      ...vaccine,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  async updateVaccine(petId: string, vaccineId: string, data: Partial<Vaccine>) {
    const vaccineRef = doc(db, PETS_COLLECTION, petId, 'vaccines', vaccineId);
    await updateDoc(vaccineRef, data);
  },

  async deleteVaccine(petId: string, vaccineId: string) {
    const vaccineRef = doc(db, PETS_COLLECTION, petId, 'vaccines', vaccineId);
    await deleteDoc(vaccineRef);
  },

  async updatePet(id: string, data: Partial<Pet>) {
    const docRef = doc(db, PETS_COLLECTION, id);
    const updates: any = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates[key] = value;
      }
    });
    
    if (data.city) {
      updates.cidade_search = [
        data.city.toLowerCase().replace(/\s*-\s*/g, '-'),
        data.city.toLowerCase().split('-')[0].trim()
      ];
    }

    // Handle status change side effects if status is provided
    if (data.status) {
      const isLostStatus = data.status === 'lost' || data.status === 'perdido';
      const isSightedStatus = data.status === 'sighted' || data.status === 'avistado';
      updates.isActive = isLostStatus || isSightedStatus || data.status === 'adoption';

      if (isSightedStatus) {
        updates.petId = '';
      }

      try {
        const petSnap = await getDoc(docRef);
        if (petSnap.exists()) {
          const oldData = petSnap.data() as Pet;
          
          // 1. If marked as lost again, remove from found history
          if (isLostStatus && oldData.status !== data.status) {
            const historyRef = collection(db, FOUND_HISTORY_COLLECTION);
            const q = query(historyRef, where('petDocId', '==', id));
            const historySnap = await getDocs(q);
            for (const d of historySnap.docs) {
              await deleteDoc(d.ref);
            }
            console.log('petService: Histórico de encontro removido via updatePet');
          }

          // 2. If marked as found from a lost state, add to history
          const isFoundStatus = data.status === 'found' || data.status === 'foundOwner' || data.status === 'seguro';
          const wasLost = oldData.status === 'lost' || oldData.status === 'perdido' || oldData.status === 'sighted' || oldData.status === 'adoption';
          
          if (isFoundStatus && wasLost && oldData.status !== data.status) {
            const historyData: any = {
              petId: oldData.petId || 'N/A',
              petDocId: id,
              petName: oldData.name || 'Pet sem nome',
              petImageUrl: oldData.imageUrl || '',
              foundAt: Timestamp.now(),
              ownerId: oldData.ownerId || oldData.userId || 'unknown',
              status: data.status
            };

            if (oldData.location) historyData.location = oldData.location;
            if (oldData.city) {
              historyData.city = oldData.city;
              historyData.cidade_search = [
                oldData.city.toLowerCase().replace(/\s*-\s*/g, '-'),
                oldData.city.toLowerCase().split('-')[0].trim()
              ];
            }

            await addDoc(collection(db, FOUND_HISTORY_COLLECTION), historyData);
            console.log('petService: Histórico de encontro registrado via updatePet');
          }
        }
      } catch (e) {
        console.error('petService: Erro ao processar efeitos colaterais de status em updatePet:', e);
      }
    }

    await updateDoc(docRef, updates);
  },

  async deletePet(id: string) {
    console.log('petService: Iniciando processo de exclusão do pet...', id);
    if (!id) throw new Error('ID do pet é obrigatório');
    
    const docRef = doc(db, PETS_COLLECTION, id);
    const petSnap = await getDoc(docRef);
    
    if (!petSnap.exists()) throw new Error('Pet não encontrado');
    
    // Check if pet has medical records or vaccines
    const medicalRef = collection(db, PETS_COLLECTION, id, 'medicalRecords');
    const vaccinesRef = collection(db, PETS_COLLECTION, id, 'vaccines');
    
    const [medSnap, vacSnap] = await Promise.all([
      getDocs(medicalRef),
      getDocs(vaccinesRef)
    ]);
    
    const hasRecords = !medSnap.empty || !vacSnap.empty;
    
    if (hasRecords) {
      console.log('petService: Pet possui histórico clínico. Realizando exclusão lógica (soft delete).');
      await updateDoc(docRef, {
        deletedByTutor: true,
        isActive: false,
        status: 'seguro' // Change status to safe to remove from maps/lists
      });
      
      // Also remove from found history
      try {
        const historyRef = collection(db, FOUND_HISTORY_COLLECTION);
        const qHistory = query(historyRef, where('petDocId', '==', id));
        const historySnap = await getDocs(qHistory);
        for (const d of historySnap.docs) {
          await deleteDoc(d.ref);
        }
      } catch (e) {
        console.error('petService: Erro ao excluir histórico durante soft delete:', e);
      }
      
      return;
    }

    console.log('petService: Pet sem histórico clínico. Excluindo permanentemente.');
    
    // 1. Delete found history for this pet
    try {
      const historyRef = collection(db, FOUND_HISTORY_COLLECTION);
      const qHistory = query(historyRef, where('petDocId', '==', id));
      const historySnap = await getDocs(qHistory);
      for (const d of historySnap.docs) {
        await deleteDoc(d.ref);
      }
      console.log(`petService: ${historySnap.size} registros de histórico excluídos`);
    } catch (e) {
      console.error('petService: Erro ao excluir histórico do pet:', e);
    }

    // 2. Delete transfer requests for this pet
    try {
      const transfersRef = collection(db, 'transfer_requests');
      const qTransfers = query(transfersRef, where('petId', '==', id));
      const transfersSnap = await getDocs(qTransfers);
      for (const d of transfersSnap.docs) {
        await deleteDoc(d.ref);
      }
      console.log(`petService: ${transfersSnap.size} solicitações de transferência excluídas`);
    } catch (e) {
      console.error('petService: Erro ao excluir transferências do pet:', e);
    }

    // 3. Delete subcollections (medical records and vaccines)
    try {
      for (const medDoc of medSnap.docs) {
        await deleteDoc(medDoc.ref);
      }
      for (const vacDoc of vacSnap.docs) {
        await deleteDoc(vacDoc.ref);
      }
    } catch (e) {
      console.error('petService: Erro ao excluir subcoleções do pet:', e);
    }

    // 4. Delete the pet document
    await deleteDoc(docRef);
    console.log('petService: Pet excluído com sucesso');
  },

  async hidePetFromClinic(petId: string, clinicId: string) {
    console.log('petService: Ocultando pet para a clínica...', petId, clinicId);
    if (!petId || !clinicId) throw new Error('ID do pet e da clínica são obrigatórios');
    
    const docRef = doc(db, PETS_COLLECTION, petId);
    const petSnap = await getDoc(docRef);
    
    if (!petSnap.exists()) throw new Error('Pet não encontrado');
    
    const data = petSnap.data() as Pet;
    const hiddenByClinics = data.hiddenByClinics || [];
    
    if (!hiddenByClinics.includes(clinicId)) {
      await updateDoc(docRef, {
        hiddenByClinics: [...hiddenByClinics, clinicId]
      });
    }
  },

  async updatePetStatus(id: string, status: PetStatus, isCanil?: boolean) {
    console.log('petService: Atualizando status do pet...', id, status);
    if (!id) throw new Error('ID do pet é obrigatório');
    const docRef = doc(db, PETS_COLLECTION, id);
    
    const updates: any = { 
      status,
      isActive: status === 'perdido' || status === 'lost' || status === 'sighted' || status === 'adoption' || status === 'adocao'
    };

    if (isCanil !== undefined) {
      updates.isCanil = isCanil;
    }

    // If marked as lost again, remove from found history
    const isLostStatus = status === 'lost' || status === 'perdido';
    if (isLostStatus) {
      try {
        const historyRef = collection(db, FOUND_HISTORY_COLLECTION);
        const q = query(historyRef, where('petDocId', '==', id));
        const historySnap = await getDocs(q);
        for (const d of historySnap.docs) {
          await deleteDoc(d.ref);
        }
        console.log('petService: Histórico de encontro removido (pet perdido novamente)');
      } catch (e) {
        console.error('petService: Erro ao remover histórico de encontro:', e);
      }
    }

    // If marked as found/safe/adopted, record in history and increment count
    const isFoundStatus = status === 'found' || status === 'foundOwner' || status === 'seguro' || status === 'encontrado';
    const isAdoptedStatus = status === 'adopted' || status === 'doado';
    
    if (isFoundStatus || isAdoptedStatus) {
      try {
        const petSnap = await getDoc(docRef);
        if (petSnap.exists()) {
          const petData = petSnap.data() as Pet;
          // For Canil, we always want to record adoption history even if it wasn't "lost"
          const wasLost = petData.status === 'perdido' || petData.status === 'lost' || petData.status === 'sighted' || petData.status === 'adoption' || petData.status === 'adocao';
          
          if (wasLost) {
            // Only add to Found History if it's NOT an adoption (as per existing logic)
            if (isFoundStatus) {
              const historyData: any = {
                petId: petData.petId || 'N/A',
                petDocId: id,
                petName: petData.name || 'Pet sem nome',
                petImageUrl: petData.imageUrl || '',
                foundAt: Timestamp.now(),
                ownerId: petData.ownerId || petData.userId || 'unknown',
                status: petData.status || 'found'
              };

              if (petData.location) historyData.location = petData.location;
              if (petData.city) {
                historyData.city = petData.city;
                historyData.cidade_search = [
                  petData.city.toLowerCase().replace(/\s*-\s*/g, '-'),
                  petData.city.toLowerCase().split('-')[0].trim()
                ];
              }

              await addDoc(collection(db, FOUND_HISTORY_COLLECTION), historyData);
              console.log('petService: Histórico de encontro registrado');
            }
          }
        }
      } catch (historyError) {
        console.error('petService: Erro ao registrar histórico (continuando atualização de status):', historyError);
        // We continue because updating the pet status is more important than the history log
      }
    }

    await updateDoc(docRef, updates);
    console.log('petService: Status atualizado com sucesso');
  },

  async getFoundHistory(city?: string) {
    try {
      let q;
      const constraints: any[] = [orderBy('foundAt', 'desc')];
      
      if (city) {
        const cityLower = city.toLowerCase();
        const normalizedCity = cityLower.replace(/\s*-\s*/g, '-');
        const baseCity = cityLower.split('-')[0].trim();
        // Use 'array-contains-any' to match any of the possible city formats
        constraints.push(where('cidade_search', 'array-contains-any', [normalizedCity, cityLower, baseCity]));
      }

      q = query(
        collection(db, FOUND_HISTORY_COLLECTION),
        ...constraints
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as object)
      })) as any[];
    } catch (error) {
      console.error('Error fetching found history:', error);
      return [];
    }
  },

  async cleanupOrphanedHistory() {
    console.log('petService: Iniciando limpeza de histórico órfão...');
    try {
      const historySnap = await getDocs(collection(db, FOUND_HISTORY_COLLECTION));
      let deletedCount = 0;

      for (const historyDoc of historySnap.docs) {
        const data = historyDoc.data();
        const petDocId = data.petDocId;

        if (petDocId) {
          const petSnap = await getDoc(doc(db, PETS_COLLECTION, petDocId));
          if (!petSnap.exists()) {
            await deleteDoc(historyDoc.ref);
            deletedCount++;
          } else {
            const petData = petSnap.data() as Pet;
            // If the pet exists but its status is 'adopted', it shouldn't be in Found History
            if (petData.status === 'adopted') {
              await deleteDoc(historyDoc.ref);
              deletedCount++;
            }
          }
        } else {
          // No petDocId, might be very old record or invalid
          await deleteDoc(historyDoc.ref);
          deletedCount++;
        }
      }
      console.log(`petService: Limpeza concluída. ${deletedCount} registros órfãos removidos.`);
      return deletedCount;
    } catch (error) {
      console.error('petService: Erro durante limpeza de histórico:', error);
      return 0;
    }
  },

  async getUserPets(userId: string) {
    try {
      console.log('Fetching pets for user:', userId);
      // Fetch pets where ownerId matches
      const qOwner = query(
        collection(db, PETS_COLLECTION),
        where('ownerId', '==', userId)
      );
      
      // Fetch pets where userId matches (legacy)
      const qUser = query(
        collection(db, PETS_COLLECTION),
        where('userId', '==', userId)
      );

      const [ownerSnapshot, userSnapshot] = await Promise.all([
        getDocs(qOwner),
        getDocs(qUser)
      ]);
      
      const petsMap = new Map<string, Pet>();
      
      ownerSnapshot.docs.forEach(doc => {
        petsMap.set(doc.id, { id: doc.id, ...doc.data() } as Pet);
      });
      
      userSnapshot.docs.forEach(doc => {
        if (!petsMap.has(doc.id)) {
          petsMap.set(doc.id, { id: doc.id, ...doc.data() } as Pet);
        }
      });

      const pets = Array.from(petsMap.values()).filter(pet => !pet.deletedByTutor);
      console.log(`Found ${pets.length} pets for user ${userId}`);
      return pets;
    } catch (error) {
      console.error('Error fetching user pets:', error);
      return [];
    }
  },

  async uploadImages(files: File[]) {
    const urls: string[] = [];
    for (const file of files) {
      try {
        const storageRef = ref(storage, `pets/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        urls.push(url);
      } catch (storageError: any) {
        console.warn('petService: Erro no Storage (uploadImages), usando fallback base64:', storageError);
        const base64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        urls.push(base64);
      }
    }
    return urls;
  },

  /**
   * Placeholder for future image comparison logic
   */
  async comparePetImages(targetImageUrl: string, candidateImageUrl: string) {
    console.log('Future AI comparison between:', targetImageUrl, candidateImageUrl);
    // This would call a cloud function or external API in the future
    return 0; // Similarity score
  },

  async fixPetCitySearchFields() {
    console.log('Fixing pet city search fields...');
    const petsRef = collection(db, PETS_COLLECTION);
    const snapshot = await getDocs(petsRef);
    let updatedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.cidade_search && data.city) {
        const cityLower = data.city.toLowerCase();
        const normalizedCity = cityLower.replace(/\s*-\s*/g, '-');
        const baseCity = cityLower.split('-')[0].trim();
        
        await updateDoc(docSnap.ref, { 
          cidade_search: [normalizedCity, cityLower, baseCity]
        });
        updatedCount++;
      }
    }
    return updatedCount;
  },

  async getClinicPatients(clinicId: string): Promise<Pet[]> {
    try {
      console.log('Fetching patients for clinic:', clinicId);
      // Find pets that have medical records or vaccines from this clinic
      const recordsQuery = query(collectionGroup(db, 'medicalRecords'), where('clinicId', '==', clinicId));
      const vaccinesQuery = query(collectionGroup(db, 'vaccines'), where('clinicId', '==', clinicId));
      
      const [recordsSnap, vaccinesSnap] = await Promise.all([
        getDocs(recordsQuery),
        getDocs(vaccinesQuery)
      ]);
      
      console.log(`Found ${recordsSnap.size} records and ${vaccinesSnap.size} vaccines`);
      
      const petIds = new Set<string>();
      recordsSnap.docs.forEach(doc => {
        const petRef = doc.ref.parent.parent;
        if (petRef) {
          petIds.add(petRef.id);
        }
      });
      vaccinesSnap.docs.forEach(doc => {
        const petRef = doc.ref.parent.parent;
        if (petRef) {
          petIds.add(petRef.id);
        }
      });
      
      if (petIds.size === 0) {
        console.log('No patients found for this clinic.');
        return [];
      }
      
      console.log(`Unique patients found: ${petIds.size}`);
      
      const patients: Pet[] = [];
      const idArray = Array.from(petIds);
      
      // Firestore 'in' query limit is 10 (or 30 in some versions, but 10 is safer)
      for (let i = 0; i < idArray.length; i += 10) {
        const chunk = idArray.slice(i, i + 10);
        const q = query(collection(db, PETS_COLLECTION), where('__name__', 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach(doc => {
          const data = doc.data() as Pet;
          // Filter out pets hidden by this clinic
          if (!data.hiddenByClinics?.includes(clinicId)) {
            patients.push({ id: doc.id, ...data } as Pet);
          }
        });
      }
      
      return patients;
    } catch (error) {
      console.error('Error fetching clinic patients:', error);
      return [];
    }
  },

  async getPetCountsByCity(city: string) {
    try {
      const cityLower = city.toLowerCase();
      const normalizedCity = cityLower.replace(/\s*-\s*/g, '-');
      const baseCity = cityLower.split('-')[0].trim();
      
      const q = query(
        collection(db, PETS_COLLECTION),
        where('cidade_search', 'array-contains-any', [normalizedCity, cityLower, baseCity])
      );
      
      const querySnapshot = await getDocs(q);
      const pets = querySnapshot.docs.map(doc => doc.data() as Pet);
      
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      return {
        new: pets.filter(p => {
          const createdAt = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : new Date(p.createdAt as any);
          return createdAt >= sevenDaysAgo;
        }).length,
        lost: pets.filter(p => p.status === 'lost' || p.status === 'perdido').length,
        sighted: pets.filter(p => p.status === 'sighted' || p.status === 'avistado').length,
        found: pets.filter(p => p.status === 'found' || p.status === 'foundOwner' || p.status === 'seguro' || p.status === 'encontrado').length,
        forAdoption: pets.filter(p => p.status === 'adoption' || p.status === 'adocao' || p.status === 'para_doar').length,
        adopted: pets.filter(p => p.status === 'adopted' || p.status === 'doado' || p.status === 'adotado').length,
      };
    } catch (error) {
      console.error('Error fetching pet counts by city:', error);
      return { new: 0, lost: 0, sighted: 0, found: 0, forAdoption: 0, adopted: 0 };
    }
  }
};
