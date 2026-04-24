// Background Service Worker para la extensión
// Maneja las peticiones API para evitar bloqueos por CSP (Content Security Policy)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchAlerts") {
        fetch(request.url, {
            headers: {
                'x-api-key': request.apiKey
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error("[Background] Fetch Error:", error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; // Indica que la respuesta será asíncrona
    }
});
