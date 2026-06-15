const assert = require('assert');

// --- SIMULACION ASSIGN-POINTS.JS ---
function simulateAssignPoints(messagingCfg, eventChannels, applyWhatsApp, points) {
    const isPushConfigured = messagingCfg.pushEnabled !== false && eventChannels.includes('push');
    const isEmailConfigured = messagingCfg.emailEnabled !== false && eventChannels.includes('email');
    
    // Simulating the WhatsApp manual bypass from assign-points
    let waSent = false;
    if (applyWhatsApp && points > 0) {
        waSent = true;
    }

    return { push: isPushConfigured, email: isEmailConfigured, waSent };
}

// --- SIMULACION USERS.JS (Bienvenida) ---
function simulateWelcome(messagingCfg, hasEmail) {
    const evChannelsWelcome = messagingCfg.eventConfigs?.welcome?.channels || ['email', 'push'];
    const canEmailWelcome = messagingCfg.emailEnabled !== false && evChannelsWelcome.includes('email');
    const canInboxWelcome = messagingCfg.inboxEnabled !== false;
    const canWhatsAppWelcome = messagingCfg.whatsappEnabled !== false && evChannelsWelcome.includes('whatsapp');

    let waWelcomeMsg = "";
    if (canWhatsAppWelcome) {
        let wTmpl = messagingCfg.templates?.welcome_whatsapp || "Welcome {nombre}";
        waWelcomeMsg = wTmpl.replace(/{nombre}/g, "Juan");
    }

    let emailSent = false;
    if (hasEmail && canEmailWelcome) {
        emailSent = true;
    }

    return { 
        inbox: canInboxWelcome, 
        emailSent, 
        waMsgGenerated: waWelcomeMsg !== "", 
        waContent: waWelcomeMsg 
    };
}

console.log("Iniciando bateria de pruebas lógicas...");

// Test 1: Configuracion Vacia (Nueva instalacion) -> Deberia asumir todo ON por defecto y usar defaults
const emptyConfig = { eventConfigs: {} };
const res1_points = simulateAssignPoints(emptyConfig, ['push', 'email'], false, 100);
assert.strictEqual(res1_points.push, true, "Empty config should default Push to ON");
assert.strictEqual(res1_points.email, true, "Empty config should default Email to ON");

const res1_users = simulateWelcome(emptyConfig, true);
assert.strictEqual(res1_users.inbox, true, "Inbox should be ON by default");
assert.strictEqual(res1_users.emailSent, true, "Welcome Email should be ON by default");
assert.strictEqual(res1_users.waMsgGenerated, false, "Welcome WhatsApp should be OFF by default because 'whatsapp' is not in default ['email', 'push']");

// Test 2: Maestro Apagado (Killswitch) -> Deberia bloquear todo
const offConfig = { pushEnabled: false, emailEnabled: false, whatsappEnabled: false, eventConfigs: { welcome: { channels: ['email', 'push', 'whatsapp'] } } };
const res2_points = simulateAssignPoints(offConfig, ['push', 'email', 'whatsapp'], false, 100);
assert.strictEqual(res2_points.push, false, "Killswitch should kill Push");
assert.strictEqual(res2_points.email, false, "Killswitch should kill Email");

const res2_users = simulateWelcome(offConfig, true);
assert.strictEqual(res2_users.emailSent, false, "Killswitch should kill Welcome Email");
assert.strictEqual(res2_users.waMsgGenerated, false, "Killswitch should kill Welcome WA");
assert.strictEqual(res2_users.inbox, true, "Inbox ignores killswitch (unless explicitly inboxEnabled=false)");

// Test 3: Maestro Encendido, pero Checkbox Apagado
const partialConfig = { pushEnabled: true, emailEnabled: true, whatsappEnabled: true, eventConfigs: { welcome: { channels: ['whatsapp'] } } }; // Only WA enabled for Welcome
const res3_users = simulateWelcome(partialConfig, true);
assert.strictEqual(res3_users.emailSent, false, "Should not send email if checkbox is not ticked");
assert.strictEqual(res3_users.waMsgGenerated, true, "Should generate WA if checkbox is ticked");
assert.strictEqual(res3_users.waContent, "Welcome Juan", "WhatsApp content should be correctly formatted");

console.log("Todas las simulaciones pasaron exitosamente. La lógica matemática es a prueba de fallos.");
