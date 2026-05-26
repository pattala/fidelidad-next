const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/services/emailService.ts');
let c = fs.readFileSync(file, 'utf8');
c = c.replace(/base\.replace\(\/\\\\\/\\\$\/, ''\)/g, "base.replace(/\\/$/, '')");
fs.writeFileSync(file, c, 'utf8');
