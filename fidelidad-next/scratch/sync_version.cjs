const fs = require('fs');
const admin = require('firebase-admin');

try {
    const content = fs.readFileSync('.env.local', 'utf8');
    const lines = content.split('\n');
    const credsLine = lines.find(l => l.startsWith('GOOGLE_CREDENTIALS_JSON='));
    
    if (!credsLine) throw new Error('No GOOGLE_CREDENTIALS_JSON found');
    
    const rawValue = credsLine.substring(credsLine.indexOf('=') + 1).trim();
    // rawValue is something like "{\"type\":...}"
    // Double parsing will first unescape the string, then parse the JSON
    const unescaped = JSON.parse(rawValue);
    const creds = typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped;

    admin.initializeApp({
        credential: admin.credential.cert(creds)
    });
    
    admin.firestore().collection('config').doc('general').update({
        latestVersion: 'V.1.4.56'
    }).then(() => {
        console.log('SYNC_SUCCESS');
        process.exit(0);
    }).catch(err => {
        console.error('SYNC_ERROR_DB:', err.message);
        process.exit(1);
    });
} catch (e) {
    console.error('SYNC_ERROR:', e.message);
    process.exit(1);
}
