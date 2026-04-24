const admin = require('firebase-admin');
const fs = require('fs');

async function checkConfig() {
    try {
        const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || fs.readFileSync('./service-account.json', 'utf8');
        const creds = JSON.parse(credsRaw);
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(creds)
            });
        }
        
        const db = admin.firestore();
        const configSnap = await db.collection('config').doc('general').get();
        
        if (configSnap.exists) {
            console.log('--- CONFIG GENERAL ---');
            console.log(JSON.stringify(configSnap.data(), null, 2));
        } else {
            console.log('Config not found');
        }
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkConfig();
