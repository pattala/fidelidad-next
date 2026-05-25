const fs = require("fs");

let engine = fs.readFileSync("api/engine-campaigns.js", "utf8");

// Fix global bypass
engine = engine.replace(
    /if \(\!isWithinNotificationWindow && \!isManualSim\) \{/,
    "if (!isWithinNotificationWindow && !isManualSim && !camp.isFlash) {"
);

fs.writeFileSync("api/engine-campaigns.js", engine);
console.log("Patched global bypass");
