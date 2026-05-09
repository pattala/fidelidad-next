import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3005;

app.use(express.json());
// Servir estáticos del instalador
app.use('/installer', express.static(path.join(__dirname, 'public/installer')));

// Endpoint de prueba
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor del instalador listo.' });
});

// Endpoint: Instalación (Escribe plantilla y ejecuta bootstrap)
app.post('/api/install', (req, res) => {
    const vars = req.body;
    
    // Configurar Headers para Stream en vivo
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        // 1. Construir el contenido de PLANTILLA_VARIABLES.txt
        let fileContent = `# 📝 PLANTILLA DE CONFIGURACIÓN GENERADA VISUALMENTE\n\n`;
        
        fileContent += `VITE_APP_NAME=${vars.appName || 'NOMBRE_CLIENTE'}\n`;
        fileContent += `VITE_APP_SHORT_NAME=${vars.appShortName || 'CORTO'}\n\n`;
        fileContent += `# --- Seguridad ---\n`;
        fileContent += `VITE_API_KEY=${vars.apiKey || ''}\n`;
        fileContent += `API_SECRET_KEY=${vars.apiKey || ''}\n`;
        fileContent += `VITE_MASTER_LOGIN_KEY=${vars.masterKey || 'Felipe01'}\n`;
        fileContent += `VITE_ENABLE_PET_MODULE=${vars.enablePetModule ? 'true' : 'false'}\n\n`;
        fileContent += `# --- Correo (Gmail) ---\n`;
        fileContent += `SMTP_USER=${vars.smtpUser || ''}\n`;
        fileContent += `SMTP_PASS=${vars.smtpPass || ''}\n\n`;
        fileContent += `# --- Firebase SDK ---\n`;
        fileContent += `VITE_FIREBASE_API_KEY=${vars.fbApiKey || ''}\n`;
        fileContent += `VITE_FIREBASE_AUTH_DOMAIN=${vars.fbAuthDomain || ''}\n`;
        fileContent += `VITE_FIREBASE_PROJECT_ID=${vars.fbProjectId || ''}\n`;
        fileContent += `VITE_FIREBASE_STORAGE_BUCKET=${vars.fbStorageBucket || ''}\n`;
        fileContent += `VITE_FIREBASE_MESSAGING_SENDER_ID=${vars.fbSenderId || ''}\n`;
        fileContent += `VITE_FIREBASE_APP_ID=${vars.fbAppId || ''}\n`;
        fileContent += `VITE_FIREBASE_MEASUREMENT_ID=${vars.fbMeasurementId || ''}\n\n`;
        fileContent += `# --- Notificaciones ---\n`;
        fileContent += `VITE_VAPID_PUBLIC_KEY=${vars.vapidKey || ''}\n\n`;
        
        // Formatear JSON Credentials de forma multilinea
        fileContent += `# --- JSON Service Account ---\n`;
        if (vars.fbCredentialsJson) {
            fileContent += `GOOGLE_CREDENTIALS_JSON=${vars.fbCredentialsJson}\n\n`;
        } else {
            fileContent += `GOOGLE_CREDENTIALS_JSON={\n  "type": "service_account"\n}\n\n`;
        }
        
        fileContent += `# --- Automatización (Upstash) ---\n`;
        fileContent += `QSTASH_CURRENT_SIGNING_KEY=${vars.qstashCurrent || ''}\n`;
        fileContent += `QSTASH_NEXT_SIGNING_KEY=${vars.qstashNext || ''}\n\n`;

        fileContent += `# --- URL Vercel ---\n`;
        fileContent += `PWA_URL=${vars.pwaUrl || ''}\n`;

        // Escribir archivo
        const templatePath = path.join(__dirname, 'PLANTILLA_VARIABLES.txt');
        fs.writeFileSync(templatePath, fileContent, 'utf8');
        res.write("✅ Archivo PLANTILLA_VARIABLES.txt generado con éxito.\n");

        res.write("🚀 Iniciando despliegue hacia Firebase y Vercel...\n");
        res.write("⚠️ RECUERDA COMPLETAR EL LOGIN DE VERCEL SI ES REQUERIDO.\n\n");

        // Ejecutar bootstrap-client.js de forma no-interactiva (parcheando inputs si es necesario)
        // Como el script pide el project_id por readline, podemos enviárselo por stdin
        const proc = spawn('node', ['scripts/bootstrap-client.js'], { shell: true });

        // Pasar el Project ID al stdin para responder la primera pregunta
        proc.stdin.write(`${vars.fbProjectId}\n`);

        proc.stdout.on('data', (data) => {
            res.write(data.toString());
        });

        proc.stderr.on('data', (data) => {
            res.write(`❌ ERROR: ${data.toString()}`);
        });

        proc.on('close', (code) => {
            res.write(`\n\n🎉 Proceso terminado con código de salida: ${code}\n`);
            res.end();
        });

    } catch (error) {
        res.write(`❌ ERROR CRÍTICO: ${error.message}\n`);
        res.end();
    }
});

// Endpoint: Sincronización Git (Desarrollo -> Main)
app.post('/api/git-sync', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    res.write("🔄 Iniciando flujo de actualización de código...\n");

    const commands = [
        { cmd: 'git', args: ['checkout', 'main'] },
        { cmd: 'git', args: ['merge', 'desarrollo', '-m', '"Merge automático desde instalador visual"'] },
        { cmd: 'git', args: ['push', 'origin', 'main'] },
        { cmd: 'git', args: ['checkout', 'desarrollo'] }
    ];

    let currentIdx = 0;

    const runNextCommand = () => {
        if (currentIdx >= commands.length) {
            res.write("\n✨ ¡Sincronización Git completada con éxito! Rama 'desarrollo' restaurada.\n");
            return res.end();
        }

        const step = commands[currentIdx];
        res.write(`\n👉 Ejecutando: ${step.cmd} ${step.args.join(' ')}\n`);

        const proc = spawn(step.cmd, step.args, { shell: true });

        proc.stdout.on('data', (data) => res.write(data.toString()));
        proc.stderr.on('data', (data) => res.write(data.toString()));

        proc.on('close', (code) => {
            if (code !== 0) {
                res.write(`\n❌ Error ejecutando comando (Código ${code}). Deteniendo flujo.\n`);
                return res.end();
            }
            currentIdx++;
            runNextCommand();
        });
    };

    runNextCommand();
});

// Ruta por defecto: Redirigir al frontend
app.get('/', (req, res) => {
    res.redirect('/installer');
});

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`💻 Entorno Visual Rampet iniciado.`);
    console.log(`🔗 Abre tu navegador en: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
    
    // Intentar abrir el navegador automáticamente en Windows
    const startCmd = process.platform === 'win32' ? 'start' : 'open';
    spawn(startCmd, [`http://localhost:${PORT}/installer`], { shell: true }).unref();
});
