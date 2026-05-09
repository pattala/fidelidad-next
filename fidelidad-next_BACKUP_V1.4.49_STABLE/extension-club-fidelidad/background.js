// Background Service Worker - Puente Universal para evitar bloqueos CSP/CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "apiCall") {
        const { url, method, headers, body } = request.params;
        
        fetch(url, {
            method: method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : undefined
        })
        .then(async response => {
            const text = await response.text();
            let data;
            try { data = JSON.parse(text); } catch(e) { data = { text }; }
            sendResponse({ success: response.ok, data: data, status: response.status });
        })
        .catch(error => {
            console.error("[Background] API Error:", error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; // Mantiene el canal abierto para la respuesta asíncrona
    }
    // No respondemos a otros mensajes para no interferir con otras partes de la extensión
});
