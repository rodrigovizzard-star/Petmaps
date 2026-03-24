import { 
  doc, 
  getDoc, 
  getDocs,
  collection,
  setDoc, 
  updateDoc, 
  query,
  where,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { UserProfile } from '../types';

const USERS_COLLECTION = 'users';

export const userService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...docSnap.data() } as UserProfile;
    }
    return null;
  },

  async createUserProfile(uid: string, data: Partial<UserProfile>) {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const profile: any = {
      userId: uid,
      uid: uid,
      email: data.email || '',
      nome: data.nome || data.displayName || '',
      displayName: data.nome || data.displayName || '',
      fotoPerfil: data.fotoPerfil || data.photoURL || '',
      photoURL: data.fotoPerfil || data.photoURL || '',
      cidade: data.cidade || '',
      cidade_search: (data.cidade || '') ? Array.from(new Set([
        (data.cidade || '').toLowerCase().replace(/\s*-\s*/g, '-'),
        (data.cidade || '').toLowerCase().split('-')[0].trim()
      ])).filter(Boolean) : [],
      phone: data.phone || '',
      role: data.role || 'tutor',
      cpf: data.cpf || null,
      rg: data.rg || null,
      cnpj: data.cnpj || null,
      country: data.country || 'Brasil',
      dataCadastro: Timestamp.now(),
      ...data,
    };

    // Remove any undefined values that might have come from the spread or initial assignment
    Object.keys(profile).forEach(key => {
      if (profile[key] === undefined) {
        delete profile[key];
      }
    });

    await setDoc(docRef, profile);
    return profile;
  },

  async updateUserProfile(uid: string, data: Partial<UserProfile>) {
    if (!uid) throw new Error('UID is required for updating profile');
    
    const docRef = doc(db, USERS_COLLECTION, uid);
    const updates: any = {};
    
    // Filter out undefined values and handle special fields
    Object.entries(data).forEach(([key, value]) => {
      // Only include valid keys and non-undefined values
      if (value !== undefined) {
        updates[key] = value;
      }
    });

    // Ensure we have something to update
    if (Object.keys(updates).length === 0) {
      console.warn('No updates provided for user profile:', uid);
      return;
    }

    if (updates.cidade) {
      updates.cidade_search = Array.from(new Set([
        updates.cidade.toLowerCase().replace(/\s*-\s*/g, '-'),
        updates.cidade.toLowerCase().split('-')[0].trim()
      ])).filter(Boolean);
    }

    // Sync photo fields if one is provided but not the other
    if (updates.fotoPerfil && !updates.photoURL) updates.photoURL = updates.fotoPerfil;
    if (updates.photoURL && !updates.fotoPerfil) updates.fotoPerfil = updates.photoURL;
    
    try {
      console.log(`Attempting to update user profile ${uid} with:`, updates);
      await updateDoc(docRef, updates);
      console.log(`Successfully updated user profile ${uid}`);
    } catch (error: any) {
      console.error(`Error in updateUserProfile for UID ${uid}:`, error);
      // Fallback to setDoc if updateDoc fails (e.g. if doc doesn't exist)
      try {
        console.log(`Falling back to setDoc for user profile ${uid}`);
        await setDoc(docRef, updates, { merge: true });
        console.log(`Successfully set user profile ${uid} via fallback`);
      } catch (innerError: any) {
        console.error(`Fallback setDoc also failed for UID ${uid}:`, innerError);
        throw innerError;
      }
    }
  },

  async checkEmailExists(email: string, excludeUid?: string): Promise<boolean> {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);
    
    if (excludeUid) {
      return snapshot.docs.some(doc => doc.id !== excludeUid);
    }
    return !snapshot.empty;
  },

  async checkPhoneExists(phone: string, excludeUid?: string): Promise<boolean> {
    if (!phone) return false;
    const usersRef = collection(db, USERS_COLLECTION);
    
    // Query for the exact phone string first
    const q1 = query(usersRef, where('phone', '==', phone));
    const snapshot1 = await getDocs(q1);
    
    if (!snapshot1.empty) {
      if (excludeUid) {
        return snapshot1.docs.some(doc => doc.id !== excludeUid);
      }
      return true;
    }

    return false;
  },

  async checkCpfExists(cpf: string, excludeUid?: string): Promise<boolean> {
    if (!cpf) return false;
    const cleaned = cpf.replace(/\D/g, '');
    if (!cleaned) return false;
    
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('cpf', '==', cleaned));
    const snapshot = await getDocs(q);
    
    if (excludeUid) {
      return snapshot.docs.some(doc => doc.id !== excludeUid);
    }
    return !snapshot.empty;
  },

  async checkRgExists(rg: string, excludeUid?: string): Promise<boolean> {
    if (!rg) return false;
    const cleaned = rg.replace(/\D/g, '');
    if (!cleaned) return false;
    
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('rg', '==', cleaned));
    const snapshot = await getDocs(q);
    
    if (excludeUid) {
      return snapshot.docs.some(doc => doc.id !== excludeUid);
    }
    return !snapshot.empty;
  },

  async cleanupDuplicateUsers() {
    console.log('Starting duplicate cleanup...');
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
    
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const toDelete: string[] = [];

    // Sort by registration date (keep oldest)
    users.sort((a, b) => {
      const dateA = a.dataCadastro?.seconds || 0;
      const dateB = b.dataCadastro?.seconds || 0;
      return dateA - dateB;
    });

    for (const user of users) {
      const email = (user.email || '').toLowerCase();
      const phone = (user.phone || '').replace(/\D/g, '');
      
      let isDuplicate = false;
      
      if (email && seenEmails.has(email)) {
        isDuplicate = true;
      } else if (email) {
        seenEmails.add(email);
      }

      if (!isDuplicate && phone && seenPhones.has(phone)) {
        isDuplicate = true;
      } else if (phone) {
        seenPhones.add(phone);
      }

      if (isDuplicate) {
        toDelete.push(user.uid);
      }
    }

    console.log(`Found ${toDelete.length} duplicates to delete.`);
    for (const uid of toDelete) {
      await userService.deleteUserProfile(uid);
      console.log(`Deleted duplicate user: ${uid}`);
    }
    
    return toDelete.length;
  },

  async uploadProfilePhoto(uid: string, file: File) {
    const path = `profiles/${uid}/${Date.now()}_${file.name}`;
    let url = '';
    
    try {
      console.log('userService: Tentando upload para Firebase Storage...');
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      url = await getDownloadURL(snapshot.ref);
      console.log('userService: Upload para Storage concluído com sucesso.');
    } catch (error: any) {
      console.warn('userService: Erro de permissão no Storage, usando fallback base64:', error);
      
      // Fallback to base64 if storage fails (likely permission issue)
      url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (base64.length > 1000000) { // ~1MB limit for Firestore
            reject(new Error('A imagem é muito grande. Por favor, escolha uma foto menor (máx 1MB).'));
          } else {
            resolve(base64);
          }
        };
        reader.onerror = () => reject(new Error('Erro ao processar imagem.'));
        reader.readAsDataURL(file);
      });
    }
    
    await userService.updateUserProfile(uid, {
      fotoPerfil: url,
      photoURL: url,
    });
    
    return url;
  },

  async deleteUserProfile(uid: string) {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await deleteDoc(docRef);
  },

  async deleteAccount(uid: string) {
    // 1. Delete user's pets and their subcollections
    const petsRef = collection(db, 'pets');
    const qPets = query(petsRef, where('ownerId', '==', uid));
    const petsSnap = await getDocs(qPets);
    for (const d of petsSnap.docs) {
      // Delete subcollections first
      const medicalRef = collection(db, 'pets', d.id, 'medicalRecords');
      const medSnap = await getDocs(medicalRef);
      for (const medDoc of medSnap.docs) {
        await deleteDoc(medDoc.ref);
      }

      const vaccinesRef = collection(db, 'pets', d.id, 'vaccines');
      const vacSnap = await getDocs(vaccinesRef);
      for (const vacDoc of vacSnap.docs) {
        await deleteDoc(vacDoc.ref);
      }

      // Delete transfer requests for this pet
      const transfersRef = collection(db, 'transfer_requests');
      const qTransfers = query(transfersRef, where('petId', '==', d.id));
      const transfersSnap = await getDocs(qTransfers);
      for (const transDoc of transfersSnap.docs) {
        await deleteDoc(transDoc.ref);
      }

      // Delete found history for this pet (all history, regardless of owner)
      const historyRef = collection(db, 'found_history');
      const qHistory = query(historyRef, where('petDocId', '==', d.id));
      const historySnap = await getDocs(qHistory);
      for (const histDoc of historySnap.docs) {
        await deleteDoc(histDoc.ref);
      }

      // Delete the pet document
      await deleteDoc(d.ref);
    }
    
    // 2. Delete partner profile if exists
    const partnersRef = collection(db, 'partners');
    const qPartner = query(partnersRef, where('userId', '==', uid));
    const partnerSnap = await getDocs(qPartner);
    for (const d of partnerSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 3. Delete found history
    const historyRef = collection(db, 'found_history');
    const qHistory = query(historyRef, where('ownerId', '==', uid));
    const historySnap = await getDocs(qHistory);
    for (const d of historySnap.docs) {
      await deleteDoc(d.ref);
    }

    // 5. Delete transfer requests (where user is sender or receiver)
    const transfersRef = collection(db, 'transfer_requests');
    const qFrom = query(transfersRef, where('fromUserId', '==', uid));
    const qTo = query(transfersRef, where('toUserId', '==', uid));
    const [fromSnap, toSnap] = await Promise.all([getDocs(qFrom), getDocs(qTo)]);
    
    for (const d of fromSnap.docs) {
      await deleteDoc(d.ref);
    }
    for (const d of toSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 6. Delete user profile from Firestore (do this last)
    await this.deleteUserProfile(uid);

    // Note: Auth deletion must be handled in the component due to re-authentication requirements
  },

  async getUserByCpfOrRg(identifier: string): Promise<UserProfile | null> {
    const cleaned = identifier.replace(/\D/g, '');
    if (!cleaned) return null;

    const usersRef = collection(db, USERS_COLLECTION);
    
    // Try CPF
    const qCpf = query(usersRef, where('cpf', '==', cleaned));
    const snapCpf = await getDocs(qCpf);
    if (!snapCpf.empty) {
      return { ...snapCpf.docs[0].data() } as UserProfile;
    }

    // Try RG
    const qRg = query(usersRef, where('rg', '==', cleaned));
    const snapRg = await getDocs(qRg);
    if (!snapRg.empty) {
      return { ...snapRg.docs[0].data() } as UserProfile;
    }

    return null;
  }
};
