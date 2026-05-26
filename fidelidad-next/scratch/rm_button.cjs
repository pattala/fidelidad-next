const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const functionText = `
    const handleTestEmail = async () => {
        if (!config.messaging?.emailEnabled) return;
        const toastId = toast.loading('Enviando previsualización...');
        try {
            const html = EmailService.generateBrandedTemplate(config, 'Prueba de Diseño', 'Este es un mensaje de prueba para verificar cómo se ve tu marca en los correos electrónicos.');
            const res = await EmailService.sendEmail(config.messaging.whatsappPhoneNumber || 'test@test.com', 'Previsualización de Email', html);
            if (res.success) toast.success('Email enviado. Revisa tu bandeja de entrada.', { id: toastId });
            else toast.error('Error al enviar. Verifica la configuración.', { id: toastId });
        } catch (e) {
            toast.error('Error de conexión', { id: toastId });
        }
    };
`;

const buttonText = `
                                {/* Email Preview Button */}
                                {config.messaging?.emailEnabled && (
                                    <div className="flex justify-end pt-2">
                                        <button type="button" onClick={handleTestEmail} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition flex items-center gap-2">
                                            <Monitor size={16} /> Ver Previsualización de Email
                                        </button>
                                    </div>
                                )}
`;

content = content.replace(functionText, '');
content = content.replace(buttonText, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Removed legacy button successfully.');
