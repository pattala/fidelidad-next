import type { AppConfig } from '../types';
import { TimeService } from './timeService';

export const EmailService = {
    /**
     * Generates a branded HTML email template using the AppConfig.
     */
    generateBrandedTemplate(config: AppConfig, title: string, bodyContent: string): string {
        const { logoUrl, primaryColor, siteName } = config;

        // Fallback or validation
        const safeLogo = logoUrl || 'https://via.placeholder.com/150?text=Logo';
        const safeColor = primaryColor || '#0ea5e9'; // Using the same blue as backend for consistency
        const base = config.contact?.pwaUrl || (typeof window !== 'undefined' ? window.location.origin : '');

        const contact = config.contact || {};
        const termsUrl = contact.termsAndConditions || '#';
        const address = contact.address;
        const whatsapp = contact.whatsapp;

        const links: string[] = [];
        if (contact.website) {
            links.push(`<a href="${contact.website}" style="display:inline-block; margin: 0 5px; text-decoration: none;"><img src="https://img.icons8.com/ios-filled/50/0ea5e9/internet.png" width="24" height="24" alt="Web" title="Website"/></a>`);
        }
        if (contact.whatsapp) {
            const num = contact.whatsapp.replace(/\D/g, '');
            links.push(`<a href="https://wa.me/${num}" style="display:inline-block; margin: 0 5px; text-decoration: none;"><img src="https://img.icons8.com/color/48/whatsapp--v1.png" width="24" height="24" alt="WhatsApp" title="WhatsApp"/></a>`);
        }
        if (contact.instagram) {
            const url = contact.instagram.startsWith('http') ? contact.instagram : `https://instagram.com/${contact.instagram.replace('@', '')}`;
            links.push(`<a href="${url}" style="display:inline-block; margin: 0 5px; text-decoration: none;"><img src="https://img.icons8.com/color/48/instagram-new--v1.png" width="24" height="24" alt="Instagram" title="Instagram"/></a>`);
        }
        if (contact.facebook) {
            links.push(`<a href="${contact.facebook}" style="display:inline-block; margin: 0 5px; text-decoration: none;"><img src="https://img.icons8.com/color/48/facebook-new.png" width="24" height="24" alt="Facebook" title="Facebook"/></a>`);
        }
        if (contact.email) {
            links.push(`<a href="mailto:${contact.email}" style="display:inline-block; margin: 0 5px; text-decoration: none;"><img src="https://img.icons8.com/color/48/gmail-new.png" width="24" height="24" alt="Email" title="Email"/></a>`);
        }

        const socialContent = links.length > 0 ? `<div style="margin-top: 20px; text-align: center;">${links.join('')}</div>` : '';

        const whatsappNumberRow = whatsapp
            ? `<div style="margin-top: 15px; text-align: center; font-size: 14px; color: #64748b; font-weight: bold;">WhatsApp: ${whatsapp}</div>`
            : '';

        const addressBlock = address ? `
            <div style="margin-top: 20px; text-align: center;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">📍 ${address}</p>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" 
                   style="background-color: #f1f5f9; color: #475569; padding: 10px 20px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: bold; display: inline-block;">
                  Cómo llegar
                </a>
            </div>
        ` : '';

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteName}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
        .wrapper { background-color: #f0f2f5; padding: 40px 0; width: 100%; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { padding: 32px 32px 24px; text-align: center; }
        .header img { max-width: 120px; height: auto; border-radius: 12px; display: block; margin: 0 auto 12px; }
        .site-name { font-size: 18px; font-weight: bold; color: #1e293b; }
        .content { padding: 0 32px 32px; color: #4b5563; line-height: 1.6; font-size: 16px; text-align: left; }
        .h1 { color: #111827; font-size: 24px; font-weight: bold; margin-bottom: 16px; text-align: center; }
        .footer { background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; }
        .btn { display: inline-block; background-color: ${safeColor}; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div style="background:${safeColor};height:8px;"></div>
            <!-- Header with Logo and Name -->
            <div class="header">
                <img src="${safeLogo}" alt="${siteName}" />
                <div class="site-name">${siteName}</div>
            </div>
    
            <!-- Main Content -->
            <div class="content">
                <div class="h1">${title}</div>
                <div>
                    ${bodyContent.replace(/\n/g, '<br/>')}
                </div>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${base}/login" class="btn">Abrir App Web</a>
                </div>
            </div>
    
            <!-- Social Media Icons Section -->
            ${socialContent}
            ${whatsappNumberRow}
            ${addressBlock}
    
            <!-- Footer -->
            <div class="footer">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                    <a href="${termsUrl}" style="color:#64748b;text-decoration:underline;">Términos y Condiciones</a>
                </p>
                <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;">&copy; ${TimeService.now().getFullYear()} ${siteName}. Todos los derechos reservados.</p>
                <p style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;">Este correo fue enviado automáticamente por ${siteName}.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    },

    /**
     * Placeholder for sending functionality
     */
    async sendEmail(to: string, subject: string, htmlBody: string) {
        try {
            console.log(`[EmailService] Sending real email to ${to}:`, subject);

            const response = await fetch('/api/notifications?action=email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // @ts-ignore
                    'x-api-key': import.meta.env.VITE_API_KEY || ''
                },
                body: JSON.stringify({
                    to,
                    // We use a special ID to signal the backend to use the provided HTML directly
                    // This requires a corresponding update in api/send-email.js to handle 'manual_override'
                    templateId: 'manual_override',
                    templateData: {
                        htmlContent: htmlBody,
                        subject: subject
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error('[EmailService] Error response:', err);
                throw new Error(err.message || 'Error sending email');
            }

            console.log('[EmailService] Email sent successfully');
            return await response.json();
        } catch (error) {
            console.error('[EmailService] Failed to send:', error);
            throw error;
        }
    }
};
