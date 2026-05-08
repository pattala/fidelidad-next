const fs = require('fs');
const admin = require('firebase-admin');

async function run() {
  try {
    const content = fs.readFileSync('.env.local', 'utf8');
    // Extract everything between GOOGLE_CREDENTIALS_JSON=" and the last "
    const match = content.match(/GOOGLE_CREDENTIALS_JSON\s*=\s*"(.*)"/s);
    if (!match) throw new Error('No match');
    
    let jsonStr = match[1];
    // Vercel CLI often escapes double quotes as \" and newlines as \n
    jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\n/g, '\n');
    
    const creds = JSON.parse(jsonStr);
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(creds)
      });
    }
    
    const db = admin.firestore();
    await db.collection('config').doc('general').update({
      latestVersion: 'V.1.4.56'
    });
    
    console.log('SUCCESS_SYNC');
  } catch (e) {
    console.error('ERROR_SYNC:', e.message);
    process.exit(1);
  }
}

run();
