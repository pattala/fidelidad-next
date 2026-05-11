const fs = require('fs');
const admin = require('firebase-admin');

try {
    const content = fs.readFileSync('.env.local', 'utf8');
    const lines = content.split('\n');
    const credsLine = lines.find(l => l.startsWith('GOOGLE_CREDENTIALS_JSON='));
    
    if (!credsLine) throw new Error('No GOOGLE_CREDENTIALS_JSON found');
    
    let rawValue = credsLine.substring(credsLine.indexOf('=') + 1).trim();
    // Remover comillas si existen
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        rawValue = rawValue.substring(1, rawValue.length - 1);
    }
    
    const creds = JSON.parse(rawValue);

    admin.initializeApp({
        credential: admin.credential.cert(creds)
    });
    
    admin.firestore().collection('config').doc('general').update({
        latestVersion: 'V.1.4.59'
    }).then(() => {
        console.log('SYNC_SUCCESS: Updated to V.1.4.59');
        process.exit(0);
    }).catch(err => {
        console.error('SYNC_ERROR_DB:', err.message);
        process.exit(1);
    });
} catch (e) {
    console.error('SYNC_ERROR:', e.message);
    process.exit(1);
}
