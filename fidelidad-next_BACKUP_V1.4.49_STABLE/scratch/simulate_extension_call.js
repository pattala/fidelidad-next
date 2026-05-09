
async function run() {
    const apiUrl = "https://fidelidad-next.vercel.app";
    const apiKey = "Felipe01";

    const url = `${apiUrl}/api/engine-daily?mode=daily&trigger=extension`;
    console.log("Calling:", url);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
        });

        if (!res.ok) {
            console.error(`HTTP Error: ${res.status}`);
            const text = await res.text();
            console.error(text);
            return;
        }

        const data = await res.json();
        console.log("\n--- RESPUESTA DEL SERVIDOR ---");
        
        if (data.expirations?.list) {
            console.log(`Vencimientos encontrados: ${data.expirations.list.length}`);
            data.expirations.list.forEach(e => {
                console.log(`- ${e.name} (Vence: ${e.nextExpirationDate}, Puntos: ${e.points})`);
                if (e.breakdown) {
                    console.log(`  Itinerario: ${JSON.stringify(e.breakdown)}`);
                }
            });
        } else {
            console.log("No se devolvió lista de vencimientos.");
        }

        if (data.birthdays?.list) {
            console.log(`Cumpleaños encontrados: ${data.birthdays.list.length}`);
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

run().catch(console.error);
