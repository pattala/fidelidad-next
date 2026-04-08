
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Colores ANSI
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log(`${bold}${blue}\n🚀 CONFIGURADOR AUTOMÁTICO DE CLIENTES RAMPET${reset}\n`);
    
    try {
        const firebaseProject = await ask(`${bold}1. Ingresa el Project ID de Firebase:${reset} `);
        if (!firebaseProject) throw new Error("Se requiere el Project ID.");

        console.log(`\n${blue}🔄 Conectando con Firebase...${reset}`);
        execSync(`firebase deploy --only firestore --project ${firebaseProject}`, { stdio: 'inherit' });

        console.log(`\n${bold}2. Configuración de Vercel${reset}`);
        execSync(`vercel link`, { stdio: 'inherit' });

        console.log(`\n${bold}3. Importación de Variables de Entorno${reset}`);
        const envPath = path.join(process.cwd(), 'PLANTILLA_VARIABLES.txt');
        
        if (!fs.existsSync(envPath)) {
            console.log(`${red}❌ No se encontró PLANTILLA_VARIABLES.txt.${reset}`);
        } else {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const entries = [];
            const lines = envContent.split(/\r?\n/);

            let currentKey = null;
            let currentValue = "";
            let isMultiline = false;

            for (let line of lines) {
                const trimmed = line.trim();
                if (!isMultiline) {
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    const firstEqual = line.indexOf('=');
                    if (firstEqual === -1) continue;
                    
                    const key = line.substring(0, firstEqual).trim();
                    const val = line.substring(firstEqual + 1).trim();
                    
                    if (val === '{') {
                        isMultiline = true;
                        currentKey = key;
                        currentValue = '{';
                    } else {
                        let cleanVal = val;
                        if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) cleanVal = cleanVal.slice(1, -1);
                        entries.push({ key, value: cleanVal });
                    }
                } else {
                    currentValue += '\n' + line;
                    if (trimmed === '}') {
                        isMultiline = false;
                        entries.push({ key: currentKey, value: currentValue });
                        currentKey = null;
                        currentValue = "";
                    }
                }
            }

            console.log(`${yellow}Se detectaron ${entries.length} variables en la plantilla.${reset}`);
            for (const entry of entries) {
                console.log(`${blue}📤 Subiendo ${entry.key}...${reset}`);
                const result = spawnSync('npx', ['vercel', 'env', 'add', entry.key, 'production', '--value', entry.value, '--yes', '--force'], { 
                    shell: true,
                    encoding: 'utf8' 
                });
                if (result.status === 0) console.log(`${green}✅ ${entry.key} ok.${reset}`);
            }
        }

        console.log(`\n${bold}${green}🎉 ¡CONFIGURACIÓN COMPLETADA!${reset}`);
        rl.close();
    } catch (error) {
        console.log(`\n${red}❌ ERROR: ${error.message}${reset}`);
        rl.close();
    }
}

main();
