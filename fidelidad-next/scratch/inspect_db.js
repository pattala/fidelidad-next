import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCiWY4sS9VaJUcfD0o5c_ZRFT0NxFdfOX8",
    authDomain: "fidelidad-v2-f2ff4.firebaseapp.com",
    projectId: "fidelidad-v2-f2ff4",
    storageBucket: "fidelidad-v2-f2ff4.firebasestorage.app",
    messagingSenderId: "770588553750",
    appId: "1:770588553750:web:1cf6afeeac65541274fb37"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    console.log("Fetching mystery box chances...");
    const q = query(collection(db, 'mystery_box_chances'), orderBy('createdAt', 'desc'), limit(5));
    const snap = await getDocs(q);
    
    console.log(`Found ${snap.size} docs.`);
    for (const doc of snap.docs) {
        const data = doc.data();
        console.log(`\nBox ID: ${doc.id}`);
        console.log(`- clientId: ${data.clientId}`);
        console.log(`- status: ${data.status}`);
        console.log(`- expiresAt: ${data.expiresAt ? data.expiresAt.toDate() : 'null'}`);
        console.log(`- createdAt: ${data.createdAt ? data.createdAt.toDate() : 'null'}`);
    }
    process.exit(0);
}

check().catch(console.error);
