const fs = require("fs");
let code = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
code = code.replace(/export const APP_VERSION = 'V\.1\.6\.7';/g, "export const APP_VERSION = 'V.1.6.8';");
fs.writeFileSync("src/lib/adminConfig.ts", code);
console.log("Version bumped to V.1.6.8");
