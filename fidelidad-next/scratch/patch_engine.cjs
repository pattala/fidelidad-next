const fs = require('fs');
let c = fs.readFileSync('api/engine-daily.js', 'utf8');

c = c.replace(/if \(detailDateStr === todayStr && activeUserIds\.has\(dtl\.userId\)\) \{/g, `const isOrphan = dtl.userId ? !activeUserIds.has(dtl.userId) : false;\n                    if (detailDateStr === todayStr && !isOrphan) {`);

fs.writeFileSync('api/engine-daily.js', c);
console.log("Patched engine-daily.js to allow orphans");
