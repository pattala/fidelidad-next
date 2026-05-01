/**
 * /utils/templates.js (ESM)
 * Utilidades compartidas para plantillas (push + email).
 */

export function sanitizePush(text = "") {
    // Quita saltos, etiquetas HTML y comprime espacios (ideal para push)
    return String(text)
        .replace(/\n|\r/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function applyBlocksAndVars(str, data = {}) {
    let out = String(str || "");

    // Bloques condicionales [BLOQUE_...][/BLOQUE_...]
    out = out.replace(/\[(BLOQUE_[A-Z0-9_]+)\]([\s\S]*?)\[\/\1\]/g, (_m, tag, inner) => {
        switch (tag) {
            case "BLOQUE_VENCIMIENTO":
                return (data.puntos_vencen && data.vencimiento_text) ? inner : "";
            case "BLOQUE_PUNTOS_BIENVENIDA":
                return (Number(data.puntos_ganados || 0) > 0 || Number(data.puntos || 0) > 0) ? inner : "";
            case "BLOQUE_CREDENCIALES_PANEL":
                return (data.email || data.creado_desde_panel) ? inner : "";
            case "BLOQUE_MENSAJE_PERSONAL":
                return (data.mensaje_opcional && String(data.mensaje_opcional).trim()) ? inner : "";
            default:
                return inner;
        }
    });

    // Si quedó tag suelto
    out = out.replace(/\[BLOQUE_VENCIMIENTO\]/g, "");

    // Reemplazo de {variables}
    out = out.replace(/\{(\w+)\}/g, (m, k) =>
        (data[k] !== undefined && data[k] !== null) ? String(data[k]) : m
    );

    return out;
}

/**
 * Lee una plantilla priorizando colección unificada `plantillas`
 * con fallback a colecciones legacy.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} templateId
 * @param {'push'|'email'} channel
 * @returns {Promise<{titulo: string, cuerpo: string}>}
 */
export async function resolveTemplate(db, templateId, channel) {
    // CRITICAL: Template ID Mapping (English Admin Panel UI vs Spanish Backend Logic)
    // Do not modify without verifying all API callers.
    const idMap = {
        'bienvenida': 'welcome',
        'puntos_sumados': 'pointsAdded',
        'canje_premio': 'redemption'
    };
    const mappedId = idMap[templateId] || templateId;

    // 1) Unificada (Cualquiera de los dos IDs)
    const candidates = [templateId];
    if (mappedId !== templateId) candidates.unshift(mappedId);

    for (const tid of candidates) {
        const snap = await db.collection("plantillas").doc(tid).get();
        if (snap.exists) {
            const d = snap.data() || {};
            const titulo = channel === "push"
                ? (d.titulo_push ?? d.titulo_email ?? "Notificación")
                : (d.titulo_email ?? d.titulo_push ?? "Notificación");
            const cuerpo = channel === "push"
                ? (d.cuerpo_push ?? d.cuerpo_email ?? "")
                : (d.cuerpo_email ?? d.cuerpo_push ?? "");
            return { titulo, cuerpo };
        }
    }

    // 2) Configuración General (Lo que edita el usuario en el Panel de Control)
    try {
        const configSnap = await db.collection('config').doc('general').get();
        if (configSnap.exists) {
            const config = configSnap.data();
            const templateText = config.messaging?.templates?.[mappedId];
            if (templateText) {
                // Títulos por defecto basados en el ID
                const defaultTitles = {
                    welcome: '¡Bienvenido! 👋',
                    pointsAdded: '¡Puntos Sumados! 💰',
                    redemption: '¡Canje Exitoso! 🎁',
                    campaign: config.siteName || 'Notificación'
                };
                return {
                    titulo: defaultTitles[mappedId] || 'Notificación',
                    cuerpo: templateText
                };
            }
        }
    } catch (err) {
        console.error("Error loading template from config/general:", err);
    }

    // 3) Legacy (fallback)
    if (channel === "push") {
        const s = await db.collection("plantillas_push").doc(templateId).get();
        if (s.exists) {
            const d = s.data() || {};
            return { titulo: d.titulo_push || "Notificación", cuerpo: d.cuerpo_push || "" };
        }
    } else {
        const s = await db.collection("plantillas_mensajes").doc(templateId).get();
        if (s.exists) {
            const d = s.data() || {};
            return { titulo: d.titulo || "Notificación", cuerpo: d.cuerpo || "" };
        }
    }

    return { titulo: "Notificación", cuerpo: "" };
}
