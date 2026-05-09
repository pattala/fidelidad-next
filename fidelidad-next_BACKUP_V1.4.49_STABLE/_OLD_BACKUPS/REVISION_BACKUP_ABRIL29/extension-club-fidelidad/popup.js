
document.addEventListener('DOMContentLoaded', () => {
    const appNameInput = document.getElementById('appName');
    const apiUrlInput = document.getElementById('apiUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('save');
    const status = document.getElementById('status');

    // Cargar actuales
    chrome.storage.local.get(['appName', 'apiUrl', 'apiKey'], (res) => {
        if (res.appName) appNameInput.value = res.appName;
        if (res.apiUrl) apiUrlInput.value = res.apiUrl;
        if (res.apiKey) apiKeyInput.value = res.apiKey;
    });

    saveBtn.onclick = () => {
        const appName = appNameInput.value.trim();
        const apiUrl = apiUrlInput.value.trim().replace(/\/$/, ""); // Quitar barra final
        const apiKey = apiKeyInput.value.trim();

        chrome.storage.local.set({ appName, apiUrl, apiKey }, () => {
            status.innerText = '✅ ¡Guardado! Recarga la página del facturador.';
            setTimeout(() => {
                status.innerText = '';
            }, 3000);
        });
    };
});
