const fs = require("fs");
let config = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
config = config.replace("export const APP_VERSION = 'V.1.6.12';", "export const APP_VERSION = 'V.1.6.13';");
fs.writeFileSync("src/lib/adminConfig.ts", config);
