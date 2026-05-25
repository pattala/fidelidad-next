const fs = require("fs");
const file = "src/modules/admin/pages/CampaignsPage.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
    /const { id, \.\.\.rest } = bonus;\s*const newBonus = \{\s*\.\.\.rest,\s*name: `\$\{bonus\.name\} \(COPIA\)`,\s*active: false \/\/ Requested by user\s*\};/g,
    `const { id, broadcastSentAt, lastBroadcastDate, lastBroadcastCount, ...rest } = bonus;\n            const newBonus = {\n                ...rest,\n                name: \`\${bonus.name} (COPIA)\`,\n                active: false // Requested by user\n            };`
);

fs.writeFileSync(file, code);
