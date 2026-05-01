import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { AuditService } from './auditService';

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
        const result = await addDoc(collection(db, COLLECTION_NAME), prize);
        await AuditService.log('prize_mgmt', `Premio creado: ${prize.name}`, [
            { action: 'prize_created', status: 'success', info: `Nombre: ${prize.name}, Costo: ${prize.pointsRequired} pts` }
        ]);
        return result;
    },

    update: async (id: string, updates: Partial<Prize>) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const result = await updateDoc(docRef, updates);
        await AuditService.log('prize_mgmt', `Premio actualizado (ID: ${id.slice(0, 5)}...)`, [
            { action: 'prize_updated', status: 'success', info: `Cambios: ${Object.keys(updates).join(', ')}` }
        ]);
        return result;
    },

    delete: async (id: string) => {
        const result = await deleteDoc(doc(db, COLLECTION_NAME, id));
        await AuditService.log('prize_mgmt', `Premio eliminado (ID: ${id})`, [
            { action: 'prize_deleted', status: 'success', info: `ID eliminado: ${id}` }
        ]);
        return result;
    }
};
