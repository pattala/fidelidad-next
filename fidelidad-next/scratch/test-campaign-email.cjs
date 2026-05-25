const fs = require('fs');
const path = require('path');

// Cargar .env.local de forma manual en process.env
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
        if (!line || line.startsWith('#')) return;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[key] = val;
    });
    console.log("Loaded .env.local variables successfully.");
}

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { buildHtmlLayout } = require('../utils/emailLayout.js');

if (!admin.apps.length) {
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
    let creds;
    try {
        creds = JSON.parse(credsRaw);
    } catch(e) {
        creds = JSON.parse(credsRaw.replace(/\\n/g, '\n'));
    }
    admin.initializeApp({
        credential: admin.credential.cert(creds)
    });
}

const db = admin.firestore();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false }
});

async function run() {
    console.log("=== SIMULATING CAMPAIGN EMAIL BROADCAST ===");
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_PASS length:", process.env.SMTP_PASS?.length || 0);

    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data() || {};

    const title = "⚡ ¡OFERTA FLASH DE PRUEBA!";
    const body = "Esta es una campaña de prueba de la versión V.1.6.4 para validar los correos.";
    const url = "/";
    const PWA_URL = "https://fidelidad-next.vercel.app";

    const innerHtml = `<div style="color:#333"><h2 style="color:#6366f1;margin-top:0">${title}</h2><p style="font-size:16px;line-height:1.6">${body}</p>${url && url !== '/' ? `<p><a href="${PWA_URL}${url}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Ver Oferta</a></p>` : ''}</div>`;
    const htmlContent = buildHtmlLayout(innerHtml, config);

    const testEmail = "rampet2024@gmail.com";
    console.log(`Sending test campaign email to: ${testEmail}...`);

    try {
        const info = await transporter.sendMail({
            from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
            to: testEmail,
            subject: title,
            html: htmlContent
        });
        console.log("SUCCESS! Email sent successfully. Message ID:", info.messageId);
    } catch (err) {
        console.error("FAILED! SMTP sendMail Error:", err);
    }
}

run().catch(console.error);
