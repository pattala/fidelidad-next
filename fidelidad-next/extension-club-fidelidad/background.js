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
            sendResponse({ success: response.ok, data: data, error: response.ok ? null : (data.error || `HTTP ${response.status}`) });
        })
        .catch(error => {
            console.error("[Background] Fetch Error:", error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; 
    }
    // Siempre responder algo para cerrar el canal si no es fetchAlerts
    sendResponse({ status: "ignored" });
    return false;
});
