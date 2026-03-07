import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';

import type { Prize } from '../types';

const COLLECTION_NAME = 'prizes';

export const PrizeService = {
    getAll: async (): Promise<Prize[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('pointsRequired', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prize));
    },

    getActive: async (): Promise<Prize[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('active', '==', true),
            orderBy('pointsRequired', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prize));
    },

    create: async (prize: Omit<Prize, 'id'>) => {
        return await addDoc(collection(db, COLLECTION_NAME), prize);
    },

    update: async (id: string, updates: Partial<Prize>) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        return await updateDoc(docRef, updates);
    },

    delete: async (id: string) => {
        return await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
