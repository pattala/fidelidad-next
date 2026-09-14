// Protector V2.12

function protectKey(e) {
    if (e.composedPath().some(el => el.id === 'cf-shadow-host')) {
        // Neutralizar preventDefault para que el POS no pueda bloquear el tipeo nativo
        e.preventDefault = function() {};
        // Frenar la propagacion para que el POS no ejecute sus listeners de atajos de teclado
        e.stopPropagation();
    }
}

// Proteger SOLO eventos de teclado. (Si bloqueamos el mouse, rompemos la UI de la extension)
window.addEventListener('keydown', protectKey, true);
window.addEventListener('keyup', protectKey, true);
window.addEventListener('keypress', protectKey, true);
window.addEventListener('input', protectKey, true);

// Proxy de Event.target para engañar al POS (cuando el click sale del Shadow DOM, el POS lee el target)
try {
    const originalTarget = Object.getOwnPropertyDescriptor(Event.prototype, 'target');
    Object.defineProperty(Event.prototype, 'target', {
        get: function() {
            const t = originalTarget.get.call(this);
            // Si el POS cree que hicimos click en el contenedor vacio (DIV), le decimos que en realidad estamos en un INPUT
            if (t && t.id === 'cf-shadow-host' && t.shadowRoot) {
                return t.shadowRoot.activeElement || t;
            }
            return t;
        }
    });
} catch(e) {}

// Proxy de document.activeElement para que el POS crea que estamos enfocados en un input normal
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
