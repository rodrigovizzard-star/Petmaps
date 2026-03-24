import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { userService } from './userService';
import { TransferRequest, UserProfile } from '../types';

const TRANSFERS_COLLECTION = 'transfer_requests';
const PETS_COLLECTION = 'pets';

export const transferService = {
  async createTransferRequest(petId: string, petName: string, fromUserId: string, fromUserName: string, toUserId: string, toUserName: string) {
    // Check if there's already a pending request for this pet
    const q = query(
      collection(db, TRANSFERS_COLLECTION), 
      where('petId', '==', petId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error('Já existe uma solicitação de transferência pendente para este pet.');
    }

    const docRef = await addDoc(collection(db, TRANSFERS_COLLECTION), {
      petId,
      petName,
      fromUserId,
      fromUserName,
      toUserId,
      toUserName,
      status: 'pending',
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  async getPendingTransferRequests(userId: string): Promise<TransferRequest[]> {
    const q = query(
      collection(db, TRANSFERS_COLLECTION),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransferRequest));
  },

  async getSentTransferRequests(userId: string): Promise<TransferRequest[]> {
    const q = query(
      collection(db, TRANSFERS_COLLECTION),
      where('fromUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransferRequest));
  },

  async acceptTransferRequest(requestId: string) {
    const requestRef = doc(db, TRANSFERS_COLLECTION, requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) throw new Error('Solicitação não encontrada');
    const requestData = requestSnap.data() as TransferRequest;

    // 1. Get new owner profile
    const newOwnerProfile = await userService.getUserProfile(requestData.toUserId);

    // 2. Update pet ownership
    const petRef = doc(db, PETS_COLLECTION, requestData.petId);
    const petUpdates: any = {
      ownerId: requestData.toUserId,
      userId: requestData.toUserId // Compatibility
    };

    if (newOwnerProfile) {
      if (newOwnerProfile.cpf) petUpdates.ownerCpf = newOwnerProfile.cpf;
      if (newOwnerProfile.role === 'tutor') {
        petUpdates.ownerType = null;
      } else if (newOwnerProfile.companyType) {
        petUpdates.ownerType = newOwnerProfile.companyType as any;
      }
      if (newOwnerProfile.phone) petUpdates.contactPhone = newOwnerProfile.phone;
    }

    await updateDoc(petRef, petUpdates);

    // 3. Mark request as accepted
    await updateDoc(requestRef, {
      status: 'accepted',
      updatedAt: Timestamp.now()
    });
  },

  async rejectTransferRequest(requestId: string) {
    const requestRef = doc(db, TRANSFERS_COLLECTION, requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      updatedAt: Timestamp.now()
    });
  },

  async cancelTransferRequest(requestId: string) {
    const requestRef = doc(db, TRANSFERS_COLLECTION, requestId);
    await updateDoc(requestRef, {
      status: 'cancelled',
      updatedAt: Timestamp.now()
    });
  }
};
