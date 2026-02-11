// background.js - Club Fidelidad
// Este script corre en el navegador y no tiene problemas de CORS
console.log("🚀 [Club Fidelidad] Service Worker iniciado");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'API_CALL') {
        const { url, method, headers, body } = request.params;

        fetch(url, {
            method: method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : undefined
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errData => {
                        sendResponse({ ok: false, error: errData.message || response.statusText });
                    }).catch(() => {
                        sendResponse({ ok: false, error: `Error HTTP: ${response.status}` });
                    });
                }
                return response.json().then(data => sendResponse({ ok: true, data }));
            })
            .catch(error => {
                console.error("❌ Error en Proxy API:", error);
                sendResponse({ ok: false, error: error.message });
            });

        return true; // Mantener canal abierto para respuesta asincrónica
    }
    // No devolvemos true para otros mensajes, cerrando el canal inmediatamente
});
