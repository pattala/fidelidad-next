const fs = require("fs");
let code = fs.readFileSync("api/engine-campaigns.js", "utf8");
code = code.replace(/uData\.fcmTokens\.filter\(\(t\) => t && typeof t === 'string' && t\.length > 10\)/g, "uData.fcmTokens.map(t => typeof t === 'object' && t !== null ? t.token : t).filter((t) => t && typeof t === 'string' && t.length > 10)");
code = code.replace(/u\.data\.fcmTokens\?\.filter\(\(t\) => t && typeof t === 'string' && t\.length > 10\)/g, "u.data.fcmTokens?.map(t => typeof t === 'object' && t !== null ? t.token : t).filter((t) => t && typeof t === 'string' && t.length > 10)");
code = code.replace(/badge: iconUrl\s*},/g, "badge: iconUrl\n                                        },\n                                        notification: { title, body: pushBody },");
fs.writeFileSync("api/engine-campaigns.js", code);
console.log("Patched");
