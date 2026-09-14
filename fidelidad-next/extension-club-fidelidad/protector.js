// Protector de teclado (Carga en document_start para ganarle al POS)
window.addEventListener('keydown', handleKey, true);
window.addEventListener('keyup', handleKey, true);
window.addEventListener('keypress', handleKey, true);

function handleKey(e) {
    const isFromExtension = e.composedPath().some(el => el.id === 'cf-shadow-host');
    if (isFromExtension) {
        e.stopImmediatePropagation();
    }
}
