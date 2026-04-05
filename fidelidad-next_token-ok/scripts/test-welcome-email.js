import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// Script para probar rápidamente ambos casos de los correos de bienvenida
// Se asume que el backend local o el de Vercel está corriendo
const LOCAL_URL = 'http://localhost:3000/api/notifications?action=email';
const SECRET_KEY = process.env.VITE_API_KEY || process.env.API_SECRET_KEY || 'test1234';

// Datos de prueba (Usa tu correo real para ver cómo llega)
const testEmail = 'pablo@example.com'; // <--- CAMBIAR POR TU CORREO DE PRUEBA
const userName = 'Pablo Pruebas';

async function testWelcomeEmail(withPoints) {
    const points = withPoints ? 500 : 0;
    console.log(`\n======================================================`);
    console.log(`Prueba: Correo de Bienvenida ${withPoints ? 'CON' : 'SIN'} Puntos (${points} pts)`);
    console.log(`Destino: ${testEmail}`);
    console.log(`======================================================`);

    const payload = {
        to: testEmail,
        templateId: 'bienvenida',      // El ID del template configurado en Admin
        templateData: {
            numero_socio: Math.floor(Math.random() * 10000),
            nombre: userName,
            puntos: points // Mock data si el template usa variables
        },
        executor: 'system_test'
    };

    try {
        const response = await fetch(LOCAL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SECRET_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.ok) {
            console.log(`✅ ¡Éxito! Correo enviado. Message ID: ${data.messageId || 'N/A'}`);
        } else {
            console.error(`❌ Error del servidor:`, data.error);
        }
    } catch (e) {
        console.error(`❌ Error haciendo el fetch:`, e.message);
        console.log(`Asegúrate de tener la app corriendo en 'localhost:3000' (npm run dev)`);
    }
}

async function run() {
    // Escenario 1: Con puntos de bienvenida
    await testWelcomeEmail(true);

    // Escenario 2: Sin puntos de bienvenida
    // await testWelcomeEmail(false); 
}

run();
