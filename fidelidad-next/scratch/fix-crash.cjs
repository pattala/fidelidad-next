const fs = require("fs");
let code = fs.readFileSync("api/engine-campaigns.js", "utf8");
code = code.replace(/u\.data\.fcmTokens\?\.map/g, "(u.data.fcmTokens || []).map");
code = code.replace(/uData\.fcmTokens\.map/g, "(uData.fcmTokens || []).map");
fs.writeFileSync("api/engine-campaigns.js", code);
console.log("Crash fixed!");
