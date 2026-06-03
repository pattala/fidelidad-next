const fs = require('fs');
let c = fs.readFileSync('api/engine-daily.js', 'utf8');

const targetStr = `                    userId: data.userId,
                    userName: data.userName || 'Socio',
                    socioNumber: data.socioNumber || '',
                    phone: data.phone || '',`;

const replacementStr = `                    userId: data.userId || data.clientId,
                    userName: data.userName || data.clientName || 'Socio',
                    socioNumber: data.socioNumber || data.clientDni || '',
                    phone: data.phone || data.clientPhone || '',`;

c = c.replace(targetStr, replacementStr);
fs.writeFileSync('api/engine-daily.js', c);
console.log("Patched engine-daily to read client properties for mystery boxes");
