const fs = require('fs');

const path = './api/assign-points.js';
let code = fs.readFileSync(path, 'utf8');

const target = `    // 1. Identificación del Cliente (DNI o SocioNumber)
    if (socioNumber) {
        const clientQuery = await db.collection('users').where('socioNumber', '==', socioNumber).limit(1).get();
        if (!clientQuery.empty) {
            const doc = clientQuery.docs[0];
            targetUid = doc.id;
            targetDocRef = doc.ref;
            foundBySocioNumber = true;
        }
    } else if (dni) {
        const clientQuery = await db.collection('users').where('dni', '==', dni).limit(1).get();
        if (!clientQuery.empty) {
            const clientDoc = clientQuery.docs[0];
            targetUid = clientDoc.id;
            targetDocRef = clientDoc.ref;
        }
    }`;

const replacement = `    // 1. Identificación del Cliente (DNI o SocioNumber)
    if (socioNumber) {
        const clientQuery = await db.collection('users').where('socioNumber', '==', socioNumber).limit(1).get();
        if (!clientQuery.empty) {
            const doc = clientQuery.docs[0];
            targetUid = doc.id;
            targetDocRef = doc.ref;
            foundBySocioNumber = true;
        }
    } else if (dni) {
        const rawDni = guestData.dni || req.body.dni || '';
        let clientQuery = await db.collection('users').where('dni', '==', dni).limit(1).get();
        
        if (clientQuery.empty && rawDni && rawDni !== dni) {
             clientQuery = await db.collection('users').where('dni', '==', rawDni).limit(1).get();
        }

        if (!clientQuery.empty) {
            const clientDoc = clientQuery.docs[0];
            targetUid = clientDoc.id;
            targetDocRef = clientDoc.ref;
        }
    }`;

code = code.replace(target, replacement);

fs.writeFileSync(path, code);
console.log('Replaced correctly');
