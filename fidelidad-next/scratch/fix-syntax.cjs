const fs = require("fs");
let lines = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8").split("\n");
const idx = lines.findIndex(l => l.includes("const unsubCampaigns = onSnapshot(qCampaigns"));
if (idx !== -1 && lines[idx - 1].trim() === ");" && lines[idx - 2].trim() === ");") {
    lines.splice(idx - 1, 1);
    fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", lines.join("\n"));
}
let config = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
config = config.replace("V.1.6.16", "V.1.6.17");
fs.writeFileSync("src/lib/adminConfig.ts", config);
