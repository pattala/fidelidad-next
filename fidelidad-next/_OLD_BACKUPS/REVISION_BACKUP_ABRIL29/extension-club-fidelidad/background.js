// Background Service Worker para la extensión
// Maneja las peticiones API para evitar bloqueos por CSP (Content Security Policy)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchAlerts") {
        console.log("[Background] Fetching alerts from:", request.url);
        
        fetch(request.url, {
            headers: { 'x-api-key': request.apiKey }
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                sendResponse({ success: false, error: data.error || `HTTP ${response.status}` });
            } else {
                sendResponse({ success: true, data: data });
            }
        })
        .catch(error => {
            console.error("[Background] Fetch Error:", error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; 
    }
});
