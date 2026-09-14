// Protector V2.11

function protectEvent(e) {
    if (e.composedPath().some(el => el.id === 'cf-shadow-host')) {
        e.preventDefault = function() {};
        e.stopPropagation();
    }
}

// Proteger eventos de teclado
window.addEventListener('keydown', protectEvent, true);
window.addEventListener('keyup', protectEvent, true);
window.addEventListener('keypress', protectEvent, true);
window.addEventListener('input', protectEvent, true);

// Proteger eventos de mouse para evitar que el POS robe el foco al hacer click
window.addEventListener('mousedown', protectEvent, true);
window.addEventListener('mouseup', protectEvent, true);
window.addEventListener('click', protectEvent, true);
window.addEventListener('pointerdown', protectEvent, true);
window.addEventListener('pointerup', protectEvent, true);

// Prevenir robo de foco
function handleFocus(e) {
    if (e.relatedTarget && e.relatedTarget.id === 'cf-shadow-host') {
        e.stopPropagation();
    }
}
window.addEventListener('blur', handleFocus, true);
window.addEventListener('focusout', handleFocus, true);

try {
    const originalTarget = Object.getOwnPropertyDescriptor(Event.prototype, 'target');
    Object.defineProperty(Event.prototype, 'target', {
        get: function() {
            const t = originalTarget.get.call(this);
            if (t && t.id === 'cf-shadow-host' && t.shadowRoot) {
                return t.shadowRoot.activeElement || t;
            }
            return t;
        }
    });
} catch(e) {}

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
