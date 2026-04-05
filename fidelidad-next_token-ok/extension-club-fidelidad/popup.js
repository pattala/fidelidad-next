
document.addEventListener('DOMContentLoaded', () => {
    const apiUrlInput = document.getElementById('apiUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('save');
    const status = document.getElementById('status');

    // Cargar actuales
    chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
        if (res.apiUrl) apiUrlInput.value = res.apiUrl;
        if (res.apiKey) apiKeyInput.value = res.apiKey;
    });

    saveBtn.onclick = () => {
        const apiUrl = apiUrlInput.value.trim().replace(/\/$/, ""); // Quitar barra final
        const apiKey = apiKeyInput.value.trim();

        chrome.storage.local.set({ apiUrl, apiKey }, () => {
            status.innerText = '✅ ¡Guardado! Recarga la página del facturador.';
            setTimeout(() => {
                status.innerText = '';
            }, 3000);
        });
    };
});
