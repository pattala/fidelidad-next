import fetch from 'node-fetch';

async function run() {
    console.log("🚀 Enviando petición HTTP POST para ejecutar el Motor de Campañas en producción...");
    
    const url = "https://fidelidad-next.vercel.app/api/engine-campaigns?trigger=manual&ignoreDeduplication=true";
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'Felipe01'
            }
        });
        
        console.log(`Status de Respuesta: ${response.status} ${response.statusText}`);
        
        const bodyText = await response.text();
        console.log("Cuerpo de Respuesta:");
        try {
            console.log(JSON.stringify(JSON.parse(bodyText), null, 2));
        } catch {
            console.log(bodyText);
        }
    } catch (e) {
        console.error("❌ Error enviando la petición HTTP:", e);
    }
}

run();
