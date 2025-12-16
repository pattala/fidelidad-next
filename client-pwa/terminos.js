// ──────────────────────────────────────────────────────────────
// T&C Centralizado (Carga rápida e independiente)
// ──────────────────────────────────────────────────────────────

// Texto centralizado de los términos
const TERMS_CONTENT_HTML = `
  <p><strong>1. Generalidades:</strong> El programa de fidelización "Club RAMPET" es un beneficio exclusivo para nuestros clientes. La participación en el programa es gratuita e implica la aceptación total de los presentes términos y condiciones.</p>
  <p><strong>2. Consentimiento de comunicaciones y ofertas cercanas: </strong> Al registrarte y/o aceptar los términos, autorizás a RAMPET a enviarte comunicaciones transaccionales y promocionales (por ejemplo, avisos de puntos, canjes, promociones, vencimientos). Si activás la función “beneficios cerca tuyo”, la aplicación podrá usar los permisos del dispositivo y del navegador para detectar tu zona general con el único fin de mostrarte ofertas relevantes de comercios cercanos. Podés administrar o desactivar estas opciones desde los ajustes del navegador o del dispositivo cuando quieras.</p>   
  <p><strong>3. Acumulación de Puntos:</strong> Los puntos se acumularán según la tasa de conversión vigente establecida por RAMPET. Los puntos no tienen valor monetario, no son transferibles a otras personas ni canjeables por dinero en efectivo.</p>
  <p><strong>4. Canje de Premios:</strong> El canje de premios se realiza exclusivamente en el local físico y será procesado por un administrador del sistema. La PWA sirve como un catálogo para consultar los premios disponibles y los puntos necesarios. Para realizar un canje, el cliente debe presentar una identificación válida.</p>
  <p><strong>5. Validez y Caducidad:</strong> Los puntos acumulados tienen una fecha de caducidad que se rige por las reglas definidas en el sistema. El cliente será notificado de los vencimientos próximos a través de los canales de comunicación aceptados para que pueda utilizarlos a tiempo.</p>
  <p><strong>6. Modificaciones del Programa:</strong> RAMPET se reserva el derecho de modificar los términos y condiciones, la tasa de conversión, el catálogo de premios o cualquier otro aspecto del programa de fidelización, inclusive su finalización, en cualquier momento y sin previo aviso.</p>
`;

// Función global disponible inmediatmente
window.openTermsModal = function (showAcceptButton = false) {
  console.log('[T&C] Request (Clean Force Rebuild)...');

  // 1. Limpieza total: Si existe, borrarlo para asegurar que se cree fresco y al final del body
  const existing = document.getElementById('terms-modal');
  if (existing) existing.remove();

  // 2. Crear modal desde cero
  const m = document.createElement('div');
  m.id = 'terms-modal';
  // Z-Index Supremo y Fixed
  m.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:2147483647; background:rgba(0,0,0,0.5); align-items:center; justify-content:center;';

  // HTML directo
  m.innerHTML = `
    <div style="width:90%; max-width:600px; background:#fff; border-radius:12px; padding:20px; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="margin:0; font-size:1.2rem;">Términos y Condiciones</h3>
        <button id="close-terms-x" style="background:none; border:none; font-size:24px; cursor:pointer; padding:0 8px;">&times;</button>
      </div>
      <div id="terms-content-area" style="flex:1; overflow-y:auto; font-size:14px; line-height:1.5;"></div>
      <div style="margin-top:16px; text-align:right;">
         <button id="accept-terms-btn-modal" class="primary-btn" style="display:none; width:100%; padding:12px;">Aceptar y Continuar</button>
      </div>
    </div>
  `;
  document.body.appendChild(m); // Siempre al final del body

  // Wiring Simple
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  m.querySelector('#close-terms-x').onclick = () => m.remove();

  // 3. Inyectar contenido
  m.querySelector('#terms-content-area').innerHTML = TERMS_CONTENT_HTML;

  // 4. Botón Aceptar logic
  const btn = document.getElementById('accept-terms-btn-modal');
  if (btn) btn.style.display = showAcceptButton ? 'block' : 'none';

  // 5. Mostrar
  m.style.display = 'flex';
};

// Alias de compatibilidad
window.openTermsModalCatchAll = window.openTermsModal;
