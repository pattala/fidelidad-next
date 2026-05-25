const fs = require("fs");
let code = fs.readFileSync("src/modules/client/pages/ClientHomePage.tsx", "utf8");
if (!code.includes("/api/engine-campaigns")) {
    code = code.replace(/setCurrentTimeStore\(TimeService\.now\(\)\);\s*}, 10000\);/g, `setCurrentTimeStore(TimeService.now());
            // Ping silencioso al motor para disparar campañas (cada 10s es mucho, usamos un contador o lo dejamos, como la funcion no hace nada si no hay nada q enviar, es rapida)
            if (config?.messaging?.enableClientTrigger !== false) {
                fetch('/api/engine-campaigns?trigger=pwa', { method: 'POST', headers: { 'x-api-key': import.meta.env.VITE_API_KEY || '' } }).catch(() => {});
            }
        }, 10000);`);
    fs.writeFileSync("src/modules/client/pages/ClientHomePage.tsx", code);
    console.log("Ping added to ClientHomePage!");
} else {
    console.log("Ping already exists.");
}
