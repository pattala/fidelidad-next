const fs = require('fs');
const admin = require('firebase-admin');

async function run() {
  try {
    const content = fs.readFileSync('.env.local', 'utf8');
    const match = content.match(/GOOGLE_CREDENTIALS_JSON\s*=\s*"(.*)"/);
    if (!match) throw new Error('GOOGLE_CREDENTIALS_JSON not found in .env.local');
    
    let jsonStr = match[1];
    // If it's escaped by Vercel, it might have \" and \n as literal characters
    // We want to unescape them to get the real JSON string if they were escaped.
    // However, if they are NOT escaped in the file, we should leave them.
    
    // Let's try to parse it directly first.
    let creds;
    try {
        creds = JSON.parse(jsonStr);
    } catch (e) {
        // Try unescaping
        console.log('Direct parse failed, trying unescape...');
        const unescaped = jsonStr.replace(/\\"/g, '"').replace(/\\n/g, '\n');
        creds = JSON.parse(unescaped);
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(creds)
      });
    }
    
    const db = admin.firestore();
    const doc = await db.collection('config').doc('general').get();
    if (doc.exists) {
        console.log('CURRENT_CONFIG:', JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('CONFIG_NOT_FOUND');
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

run();
