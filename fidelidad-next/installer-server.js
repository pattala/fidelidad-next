import express from 'express';
import { spawn } from 'child_process';
import admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3005;

let lastEnvData = null; // Almacena las últimas variables para exportar

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
        { cmd: 'git', args: ['pull', 'origin', 'main'] },
        { cmd: 'git', args: ['merge', 'desarrollo', '--no-ff', '-m', '"Merge automático desde instalador visual"'] },
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


// Endpoint: Consultar cambios en Firebase
app.get('/api/firebase-diff', (req, res) => {
    const proc = spawn('git', ['diff', 'origin/main...desarrollo', '--name-only'], { shell: true });
    let output = '';
    
    proc.stdout.on('data', (data) => output += data.toString());
    proc.on('close', (code) => {
        if (code === 0) {
            const files = output.split('\n').map(f => f.trim()).filter(Boolean);
            const rulesChanged = files.some(f => f.includes('firestore.rules'));
            const indexesChanged = files.some(f => f.includes('firestore.indexes.json'));
            res.json({ rulesChanged, indexesChanged });
        } else {
            res.status(500).json({ error: 'Git diff failed' });
        }
    });
});

// Endpoint: Obtener versiones comparativas
app.get('/api/versions', async (req, res) => {
    console.log("🔍 Consultando versiones...");
    try {
        const pkgLocal = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const versionLocal = pkgLocal.version;

        // Intentar obtener versiones de ramas remotas
        const getRemoteVersion = (branch) => {
            return new Promise(async (resolve) => {
                // Probamos dos rutas: una relativa al repo y otra directa
                const pathsToTry = [`fidelidad-next/package.json`, `package.json` ];
                let finalVersion = 'N/A';

                for (const p of pathsToTry) {
                    const success = await new Promise((res) => {
                        console.log(`👉 Probando: git show ${branch}:${p}`);
                        const proc = spawn('git', ['show', `${branch}:${p}`], { shell: true });
                        let output = '';
                        proc.stdout.on('data', (data) => output += data.toString());
                        proc.on('close', (code) => {
                            if (code === 0) {
                                try {
                                    const pkg = JSON.parse(output);
                                    finalVersion = pkg.version;
                                    res(true);
                                } catch (e) { res(false); }
                            } else { res(false); }
                        });
                    });
                    if (success) break;
                }
                
                console.log(finalVersion !== 'N/A' ? `✅ ${branch}: ${finalVersion}` : `❌ ${branch}: No encontrado`);
                resolve(finalVersion);
            });
        };

        // Ejecutar un fetch previo para estar al día
        console.log("📡 Sincronizando con GitHub (git fetch)...");
        const fetchProc = spawn('git', ['fetch', 'origin'], { shell: true });
        
        fetchProc.on('close', async (code) => {
            if (code !== 0) console.log("⚠️ Advertencia: git fetch falló.");
            
            const versionMain = await getRemoteVersion('origin/main');
            const versionDesarrollo = await getRemoteVersion('origin/desarrollo');
            
            // Extensión
            let extVersionLocal = 'N/A';
            try {
                const extManifestLocal = JSON.parse(fs.readFileSync(path.join(__dirname, 'extension-club-fidelidad', 'manifest.json'), 'utf8'));
                extVersionLocal = extManifestLocal.version || 'N/A';
            } catch(e) {}

            const getRemoteExtVersion = (branch) => {
                return new Promise(async (resolve) => {
                    const pathsToTry = [`fidelidad-next/extension-club-fidelidad/manifest.json`, `extension-club-fidelidad/manifest.json`];
                    let finalVersion = 'N/A';
                    for (const p of pathsToTry) {
                        const success = await new Promise((res) => {
                            const proc = spawn('git', ['show', `${branch}:${p}`], { shell: true });
                            let output = '';
                            proc.stdout.on('data', (data) => output += data.toString());
                            proc.on('close', (code) => {
                                if (code === 0) {
                                    try {
                                        const pkg = JSON.parse(output);
                                        finalVersion = pkg.version;
                                        res(true);
                                    } catch (e) { res(false); }
                                } else { res(false); }
                            });
                        });
                        if (success) break;
                    }
                    resolve(finalVersion);
                });
            };

            const extVersionMain = await getRemoteExtVersion('origin/main');
            const extVersionDesarrollo = await getRemoteExtVersion('origin/desarrollo');

            // Buscar versión del ZIP
            let zipVersionLocal = 'N/A';
            try {
                const files = fs.readdirSync(path.join(__dirname, 'public/download'));
                const zipFile = files.find(f => f.startsWith('Integrador_Beneficios') && f.endsWith('.zip'));
                if (zipFile) {
                    const match = zipFile.match(/_V([\d.]+)\.zip$/);
                    if (match) zipVersionLocal = match[1];
                    else if (zipFile === 'Integrador_Beneficios.zip') zipVersionLocal = 'Sin número';
                }
            } catch(e) {}

            const getRemoteZipVersion = (branch) => {
                return new Promise((resolve) => {
                    const proc = spawn('git', ['ls-tree', '-r', branch, '--name-only'], { shell: true });
                    let output = '';
                    proc.stdout.on('data', (data) => output += data.toString());
                    proc.on('close', (code) => {
                        if (code === 0) {
                            const lines = output.split('\n');
                            const zipFile = lines.find(f => f.includes('public/download/Integrador_Beneficios') && f.endsWith('.zip'));
                            if (zipFile) {
                                const match = zipFile.match(/_V([\d.]+)\.zip$/);
                                if (match) return resolve(match[1]);
                                return resolve('Sin número');
                            }
                        }
                        resolve('N/A');
                    });
                });
            };

            const zipVersionMain = await getRemoteZipVersion('origin/main');
            const zipVersionDesarrollo = await getRemoteZipVersion('origin/desarrollo');

            res.json({
                local: versionLocal,
                main: versionMain,
                desarrollo: versionDesarrollo,
                extLocal: `Cod: ${extVersionLocal} | Zip: ${zipVersionLocal}`,
                extMain: `Cod: ${extVersionMain} | Zip: ${zipVersionMain}`,
                extDesarrollo: `Cod: ${extVersionDesarrollo} | Zip: ${zipVersionDesarrollo}`
            });
        });

    } catch (error) {
        console.log(`❌ ERROR CRÍTICO: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Capturar Reglas de Desarrollo
app.post('/api/firebase/capture-rules', async (req, res) => {
    const { projectId, credentials } = req.body;
    if (!projectId || !credentials) return res.status(400).send("Faltan datos de conexión.");

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write(`📥 Capturando reglas desde el proyecto: ${projectId} (vía API)...\n`);

    try {
        // 1. AUTENTICACIÓN
        const auth = new GoogleAuth({
            credentials: JSON.parse(credentials),
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const token = tokenResponse.token;

        // 2. OBTENER RELEASES (Para encontrar el ruleset actual)
        const releasesUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`;
        const releasesRes = await fetch(releasesUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const releasesData = await releasesRes.json();

        if (!releasesData.releases) {
            throw new Error("No se encontraron despliegues de reglas en este proyecto.");
        }

        // Buscar el release de firestore
        const firestoreRelease = releasesData.releases.find(r => r.name.includes('cloud.firestore'));
        if (!firestoreRelease) throw new Error("No se encontró release de Firestore.");

        // 3. OBTENER EL CONTENIDO DEL RULESET
        const rulesetUrl = `https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`;
        const rulesetRes = await fetch(rulesetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const rulesetData = await rulesetRes.json();

        if (!rulesetData.source || !rulesetData.source.files) {
            throw new Error("No se pudo leer el contenido del ruleset.");
        }

        const rulesContent = rulesetData.source.files[0].content;

        // 4. GUARDAR LOCALMENTE
        fs.writeFileSync(path.join(__dirname, 'firestore.rules'), rulesContent, 'utf8');
        res.write("✅ Reglas capturadas y guardadas en firestore.rules.\n");

        // 5. SELLAR VERSIÓN EN FIRESTORE
        res.write("🏷️ Sincronizando etiqueta de versión en Firestore...\n");
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const version = pkg.version;

        const appName = `sync-${Date.now()}`;
        const firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(credentials)),
            projectId: projectId
        }, appName);

        const db = firebaseApp.firestore();
        await db.collection('config').doc('general').set({ 
            appVersion: version,
            lastSync: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.write(`✅ Versión ${version} marcada en Firestore.\n`);
        await firebaseApp.delete();

    } catch (error) {
        res.write(`❌ ERROR CRÍTICO: ${error.message}\n`);
    }
    res.end();
});

// Endpoint: Desplegar Reglas a Producción
app.post('/api/firebase/deploy-rules', (req, res) => {
    const { projectIds } = req.body;
    if (!projectIds || !Array.isArray(projectIds)) return res.status(400).send("Falta lista de Project IDs.");

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write(`🚀 Iniciando despliegue masivo de reglas a ${projectIds.length} proyectos...\n`);

    let currentIdx = 0;

    const deployNext = () => {
        if (currentIdx >= projectIds.length) {
            res.write("\n✨ Despliegue masivo completado.\n");
            return res.end();
        }

        const pid = projectIds[currentIdx].trim();
        if (!pid) { currentIdx++; return deployNext(); }

        res.write(`\n👉 Desplegando en: ${pid}...\n`);
        const proc = spawn('firebase', ['deploy', '--only', 'firestore:rules,firestore:indexes', '--project', pid], { shell: true });

        proc.stdout.on('data', (data) => res.write(data.toString()));
        proc.stderr.on('data', (data) => res.write(data.toString()));

        proc.on('close', (code) => {
            if (code === 0) res.write(`✅ Éxito en ${pid}\n`);
            else res.write(`❌ Error en ${pid} (Código ${code})\n`);
            currentIdx++;
            deployNext();
        });
    };

    deployNext();
});

// Endpoint: Consultar Versión en Firestore (Online)
app.post('/api/firebase/check-version', async (req, res) => {
    const { projectId, credentials } = req.body;
    if (!projectId || !credentials) return res.status(400).send("Faltan datos de conexión.");

    try {
        const appName = `check-${Date.now()}`;
        const firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(credentials)),
            projectId: projectId
        }, appName);

        const db = firebaseApp.firestore();
        const doc = await db.collection('config').doc('general').get();
        const data = doc.exists ? doc.data() : {};
        
        const onlineVersion = data.appVersion || 'N/A';
        
        await firebaseApp.delete();
        res.json({ version: onlineVersion });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Limpiar Base de Datos (Wipe)
app.post('/api/firebase/wipe-data', async (req, res) => {
    const { projectId, credentials, options, confirmText } = req.body;
    if (!projectId || !credentials) return res.status(400).send("Faltan datos de conexión.");
    if (confirmText !== 'BORRAR') return res.status(400).send("Falta confirmación de seguridad.");

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.write(`🗑️ Iniciando limpieza de datos en el proyecto: ${projectId}...\n`);

    try {
        const appName = `wipe-${Date.now()}`;
        const firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(credentials)),
            projectId: projectId
        }, appName);

        const db = firebaseApp.firestore();

        // Helper para borrar en lotes
        const deleteByQueryPaged = async (makeQuery, label) => {
            let count = 0;
            while (true) {
                const snap = await makeQuery().get();
                if (snap.empty) break;
                const batch = db.batch();
                snap.docs.forEach(d => {
                    batch.delete(d.ref);
                    count++;
                });
                await batch.commit();
            }
            if (count > 0) res.write(`✅ [${label}] ${count} documentos eliminados.\n`);
            return count;
        };

        const deleteUserSubcollections = async (docId) => {
            const subs = ["geo_raw", "points_history", "inbox", "notifications", "interacciones", "visit_history", "transactions", "tokens", "expiration_cache"];
            for (const sub of subs) {
                await deleteByQueryPaged(() => db.collection(`users/${docId}/${sub}`).limit(500), `Subcolección ${sub}`);
            }
        };

        // 1. Usuarios y sus historiales
        if (options.wipeUsers) {
            res.write(`\n⏳ Buscando usuarios para eliminar...\n`);
            const usersRefs = await db.collection("users").listDocuments();
            let deletedCount = 0;
            const uidsToPurgeAuth = [];

            for (const docRef of usersRefs) {
                const snap = await docRef.get();
                const data = snap.data();

                // Proteger administradores
                if (snap.exists && ["admin", "editor", "viewer"].includes(data?.role)) {
                    continue;
                }

                const authUID = data?.authUID || data?.uid || (snap.exists ? snap.id : null);
                if (authUID) uidsToPurgeAuth.push(authUID);

                await deleteUserSubcollections(docRef.id);
                await docRef.delete();
                deletedCount++;
            }
            res.write(`✅ Usuarios eliminados de Firestore: ${deletedCount}\n`);

            if (uidsToPurgeAuth.length > 0) {
                res.write(`⏳ Eliminando usuarios de Firebase Authentication...\n`);
                let authPurged = 0;
                for (let i = 0; i < uidsToPurgeAuth.length; i += 1000) {
                    const chunk = uidsToPurgeAuth.slice(i, i + 1000);
                    try {
                        await firebaseApp.auth().deleteUsers(chunk);
                        authPurged += chunk.length;
                    } catch (e) {
                        res.write(`⚠️ Advertencia al purgar Auth: ${e.message}\n`);
                    }
                }
                res.write(`✅ Usuarios purgados de Authentication: ${authPurged}\n`);
            }
            
            // También borrar transacciones y redenciones root
            await deleteByQueryPaged(() => db.collection('transactions').limit(500), 'transactions globales');
            await deleteByQueryPaged(() => db.collection('redemptions').limit(500), 'redemptions globales');
        }

        // 2. Sorteos (Cajas Sorpresa)
        if (options.wipeMysteryBoxes) {
            res.write(`\n⏳ Eliminando sorteos y cajas sorpresa...\n`);
            await deleteByQueryPaged(() => db.collection('mystery_box_chances').limit(500), 'mystery_box_chances');
        }

        // 3. Auditoría y Avisos
        if (options.wipeAudit) {
            res.write(`\n⏳ Eliminando registros de auditoría y avisos del sistema...\n`);
            await deleteByQueryPaged(() => db.collection('audit_logs').limit(500), 'audit_logs');
        }

        res.write(`\n✨ ¡Limpieza completada con éxito!\n`);
        await firebaseApp.delete();

    } catch (error) {
        res.write(`\n❌ ERROR CRÍTICO: ${error.message}\n`);
    }
    res.end();
});

// Endpoint: Cargar Credenciales Guardadas
app.get('/api/firebase/load-creds', (req, res) => {
    const credsPath = path.join(__dirname, '.dev_creds.json');
    if (fs.existsSync(credsPath)) {
        const data = fs.readFileSync(credsPath, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.json({ projectId: 'fidelidad-next', credentials: '' });
    }
});

// Endpoint: Guardar Credenciales
app.post('/api/firebase/save-creds', (req, res) => {
    const { projectId, credentials } = req.body;
    const credsPath = path.join(__dirname, '.dev_creds.json');
    fs.writeFileSync(credsPath, JSON.stringify({ projectId, credentials }, null, 2), 'utf8');
    res.json({ status: 'ok' });
});

// Endpoint: Obtener lista de proyectos de Vercel
app.get('/api/vercel/projects', async (req, res) => {
    try {
        const proc = spawn('vercel', ['project', 'ls', '--format', 'json'], { shell: true });
        let output = '';
        proc.stdout.on('data', data => output += data.toString());
        proc.on('close', code => {
            if (code === 0) {
                // Vercel a veces imprime warnings de NODE_TLS antes del JSON, buscamos el primer '{'
                const match = output.match(/\{[\s\S]*\}/);
                if (match) {
                    try {
                        const parsed = JSON.parse(match[0]);
                        const projects = parsed.projects.map(p => p.name);
                        res.json({ projects });
                    } catch (e) {
                        res.status(500).json({ error: "No se pudo parsear el JSON de Vercel." });
                    }
                } else {
                    res.status(500).json({ error: "Formato inesperado de Vercel CLI." });
                }
            } else {
                res.status(500).json({ error: "Fallo al listar proyectos." });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint: Consultar Variables Vercel
app.post('/api/vercel/env', async (req, res) => {
    const { projectName, environment } = req.body;
    if (!projectName) return res.status(400).send("Falta nombre del proyecto");

    const targetEnv = environment || 'production';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.write(`🔍 Consultando variables para: ${projectName} (${targetEnv})...\n`);

    const vercelDir = path.join(__dirname, '.vercel');
    const backupDir = path.join(__dirname, '.vercel_backup_temp');
    const envFile = path.join(__dirname, '.env.vercel.tmp');

    try {
        // 1. Backup de .vercel si existe para no molestar el entorno de desarrollo del usuario
        if (fs.existsSync(vercelDir)) {
            if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
            fs.renameSync(vercelDir, backupDir);
        }

        // 2. Link
        res.write(`🔗 Vinculando a Vercel...\n`);
        await new Promise((resolve, reject) => {
            const proc = spawn('vercel', ['link', '--project', projectName, '--yes'], { shell: true });
            proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Fallo al vincular proyecto. Verifica que el nombre sea correcto.`)));
        });

        // 3. Pull env (Producción explícitamente)
        res.write(`📥 Descargando variables de entorno (${targetEnv})...\n`);
        await new Promise((resolve, reject) => {
            const proc = spawn('vercel', ['env', 'pull', '.env.vercel.tmp', '--environment', targetEnv, '--yes'], { shell: true });
            proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Fallo al descargar variables.`)));
        });

        // 4. Leer archivo y parsear
        if (fs.existsSync(envFile)) {
            const envContent = fs.readFileSync(envFile, 'utf8');
            res.write(`\n✅ ¡Variables obtenidas con éxito!\n`);
            res.write(`========================================================\n\n`);
            
            const lines = envContent.split('\n');
            let count = 0;
            let currentVariables = [];
            
            lines.forEach(line => {
                if (line.trim() && !line.startsWith('#')) {
                    const idx = line.indexOf('=');
                    if(idx !== -1){
                        const key = line.substring(0, idx);
                        let value = line.substring(idx + 1);
                        // Limpiar comillas si tiene
                        if(value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
                        res.write(`🔑 ${key.padEnd(35, ' ')} = ${value}\n`);
                        currentVariables.push({ key, value });
                        count++;
                    }
                }
            });
            
            lastEnvData = { projectName, env: targetEnv, variables: currentVariables };
            
            if(count === 0) res.write("No hay variables configuradas en este proyecto.\n");
            res.write(`\n========================================================\n`);
        } else {
            res.write(`\n❌ Error: No se encontró el archivo de variables.`);
        }

    } catch (err) {
        res.write(`\n❌ ERROR: ${err.message}\n`);
    } finally {
        // Limpieza y Restauración
        if (fs.existsSync(envFile)) fs.unlinkSync(envFile);
        if (fs.existsSync(vercelDir)) fs.rmSync(vercelDir, { recursive: true, force: true });
        if (fs.existsSync(backupDir)) fs.renameSync(backupDir, vercelDir);
        
        res.write(`\n✨ Auditoría terminada.\n`);
        res.end();
    }
});

// Endpoint: Exportar Variables a CSV
app.get('/api/vercel/env-export', (req, res) => {
    if (!lastEnvData) {
        return res.status(404).send("No hay datos para exportar. Haz una consulta primero.");
    }
    
    // Generar contenido CSV
    let csv = "Variable,Valor\n";
    lastEnvData.variables.forEach(v => {
        // Escapar comillas dobles para CSV
        const safeValue = v.value.replace(/"/g, '""');
        csv += `"${v.key}","${safeValue}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="variables_${lastEnvData.projectName}_${lastEnvData.env}.csv"`);
    res.send(csv);
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
