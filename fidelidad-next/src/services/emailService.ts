import type { AppConfig } from '../types';

export const EmailService = {
    /**
     * Generates a branded HTML email template using the AppConfig.
     */
    generateBrandedTemplate(config: AppConfig, title: string, bodyContent: string): string {
        const { logoUrl, primaryColor, siteName } = config;

        // Fallback or validation
        const safeLogo = logoUrl || 'https://via.placeholder.com/150?text=Logo';
        const safeColor = primaryColor || '#3b82f6';

        // Social Links Logic
        const links: string[] = [];
        const contact = config.contact || {};
        const iconStyle = "width: 24px; height: 24px; vertical-align: middle; margin: 0 8px;";

        if (contact.whatsapp) {
            const num = contact.whatsapp.replace(/\D/g, '');
            links.push(`<a href="https://wa.me/${num}"><img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="WhatsApp" style="${iconStyle}" title="WhatsApp" /></a>`);
        }
        if (contact.instagram) {
            const url = contact.instagram.startsWith('http') ? contact.instagram : `https://instagram.com/${contact.instagram.replace('@', '')}`;
            links.push(`<a href="${url}"><img src="https://img.icons8.com/color/48/instagram-new--v1.png" alt="Instagram" style="${iconStyle}" title="Instagram" /></a>`);
        }
        if (contact.facebook) {
            links.push(`<a href="${contact.facebook}"><img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" style="${iconStyle}" title="Facebook" /></a>`);
        }
        if (contact.website) {
            links.push(`<a href="${contact.website}" style="text-decoration: none; color: ${safeColor}; font-weight: bold; font-size: 14px; vertical-align: middle; margin: 0 8px;">🌐 Web</a>`);
        }
        if (contact.email) {
            links.push(`<a href="mailto:${contact.email}" style="text-decoration: none; font-size: 24px; vertical-align: middle; margin: 0 8px;" title="Email">✉️</a>`);
        }

        let footerContent = links.length > 0 ? `<div style="margin-top: 20px; text-align: center;">${links.join('')}</div>` : '';

        if (contact.termsAndConditions) {
            footerContent += `<div style="margin-top: 15px; font-size: 11px; text-align: center;"><a href="${contact.termsAndConditions}" style="color: #9ca3af; text-decoration: underline;">Ver Términos y Condiciones</a></div>`;
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background-color: white; padding: 20px; text-align: center; border-bottom: 3px solid ${safeColor}; }
        .header img { height: 60px; max-width: 200px; object-fit: contain; }
        .content { padding: 30px; color: #374151; line-height: 1.6; }
        .h1 { color: #111827; font-size: 24px; font-weight: bold; margin-bottom: 16px; }
        .footer { background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
        .btn { display: inline-block; background-color: ${safeColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header with Logo -->
        <div class="header">
            <img src="${safeLogo}" alt="${siteName}" />
        </div>

        <!-- Main Content -->
        <div class="content">
            <div class="h1">${title}</div>
            <div>
                ${bodyContent.replace(/\n/g, '<br/>')}
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Enviado por <b>${siteName}</b></p>
            ${footerContent}
            <p style="margin-top: 10px;">Este es un mensaje automático, por favor no responder.</p>
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

            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
