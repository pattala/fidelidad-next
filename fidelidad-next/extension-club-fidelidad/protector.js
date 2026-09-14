// Protector de teclado avanzado (Carga en document_start)

window.addEventListener('keydown', handleKey, true);
window.addEventListener('keyup', handleKey, true);
window.addEventListener('keypress', handleKey, true);

function handleKey(e) {
    if (e.composedPath().some(el => el.id === 'cf-shadow-host')) {
        e.stopPropagation(); // stopPropagation como en V1.89
    }
}

window.addEventListener('blur', handleFocus, true);
window.addEventListener('focusout', handleFocus, true);

function handleFocus(e) {
    if (e.relatedTarget && e.relatedTarget.id === 'cf-shadow-host') {
        e.stopPropagation();
    }
}

try {
    const originalActiveElement = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement');
    Object.defineProperty(document, 'activeElement', {
        get: function() {
            const active = originalActiveElement.get.call(this);
            if (active && active.id === 'cf-shadow-host' && active.shadowRoot) {
                return active.shadowRoot.activeElement || active;
            }
            return active;
        }
    });
} catch (err) {}
