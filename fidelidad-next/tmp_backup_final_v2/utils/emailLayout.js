/**
 * /utils/emailLayout.js (ESM)
 * Genera el layout HTML estándar para los correos electrónicos del Club.
 */

export function buildHtmlLayout(innerHtml, config = {}) {
  const base = config.contact?.pwaUrl || process.env.PWA_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fidelidad-next.vercel.app');
  const logo = config.logoUrl || process.env.PUSH_ICON_URL || `${base}/images/mi_logo.png`;
  const siteName = config.siteName || 'Club Fidelidad';
  const terms = config.contact?.termsAndConditions || process.env.URL_TERMINOS_Y_CONDICIONES || `${base}/profile`;
  const primaryColor = config.primaryColor || '#0ea5e9';

  const facebook = config.contact?.facebook;
  const instagram = config.contact?.instagram;
  const whatsapp = config.contact?.whatsapp;
  const website = config.contact?.website;
  const address = config.contact?.address;

  // Social Icons grouping
  const icons = [];
  if (facebook) icons.push(`<a href="${facebook}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="32" height="32" alt="FB"></a>`);
  if (instagram) icons.push(`<a href="${instagram.startsWith('http') ? instagram : 'https://instagram.com/' + instagram}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="32" height="32" alt="IG"></a>`);
  if (whatsapp) icons.push(`<a href="https://wa.me/${whatsapp.replace(/\D/g, '')}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" width="32" height="32" alt="WA"></a>`);
  if (website) icons.push(`<a href="${website}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" width="32" height="32" alt="WEB"></a>`);

  const socialIconsRow = icons.length > 0
    ? `<tr><td style="padding: 0 32px 16px; text-align: center;">${icons.join('')}</td></tr>`
    : '';

  const whatsappNumberRow = whatsapp
    ? `<tr><td style="padding: 0 32px 32px; text-align: center; font-family: sans-serif; font-size: 14px; color: #64748b; font-weight: bold;">WhatsApp: ${whatsapp}</td></tr>`
    : '';

  const addressBlock = address ? `
      <tr><td style="padding: 0 32px 32px; text-align: center;">
        <p style="margin: 0 0 16px 0; font-family: sans-serif; font-size: 14px; color: #64748b;">
          📍 ${address}
        </p>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" 
           style="background-color: #f1f5f9; color: #475569; padding: 10px 20px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: bold; display: inline-block;">
          Cómo llegar
        </a>
      </td></tr>
    ` : '';

  return `<!doctype html>
    <html lang="es">
      <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${siteName}</title></head>
      <body style="background:#f0f2f5;padding:0;margin:0;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;color:#333;">
        <table width="100%" cellspacing="0" cellpadding="0" style="background:#f0f2f5;padding:40px 0;">
          <tr><td align="center">
            <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              <tr><td style="background:${primaryColor};height:8px;"></td></tr>
              <tr><td style="padding:32px 32px 24px;text-align:center;">
                  <img src="${logo}" alt="${siteName}" style="max-width:120px;height:auto;border-radius:12px;display:block;margin:0 auto 12px;"/>
                  <div style="font-size:18px;font-weight:bold;color:#1e293b;">${siteName}</div>
              </td></tr>
              <tr><td style="padding:0 32px 32px;font-size:16px;line-height:1.6;text-align:left;color:#4b5563;">${innerHtml}</td></tr>
              
              ${socialIconsRow}
              ${whatsappNumberRow}
              ${addressBlock}
  
              <tr><td style="background-color:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 16px 0;font-size:14px;">
                  <a href="${base}/login" style="display:inline-block;padding:10px 20px;background-color:${primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Abrir App Web</a>
                </p>
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  <a href="${terms}" style="color:#64748b;text-decoration:underline;">Términos y Condiciones</a>
                </p>
                <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;">&copy; ${new Date().getFullYear()} ${siteName}. Todos los derechos reservados.</p>
              </td></tr>
            </table>
            <p style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;max-width:400px;">
              Este correo fue enviado automáticamente por ${siteName}.
            </p>
          </td></tr>
        </table>
      </body>
    </html>`;
}
