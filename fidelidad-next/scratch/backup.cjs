const fs = require('fs');
const path = require('path');

const src = '.';
const dest = '../fidelidad-next_BACKUP_V1.6.17_STABLE';

function copyRecursiveSync(src, dest) {
    if (path.basename(src) === 'node_modules' || path.basename(src) === '.git' || path.basename(src) === 'dist') return;
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function(childItemName) {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}
copyRecursiveSync(src, dest);
console.log("Backup completado en " + dest);
