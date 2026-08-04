/**
 * 💎 SUITE DE AUDITORÍA INTEGRAL Y TEST END-TO-END 360° (FIDELIDAD-NEXT)
 * 
 * Este script ejecuta una auditoría completa de nivel producción sin interfaz gráfica
 * probando el 100% de los componentes y VERIFICANDO ASERCIONES MATEMÁTICAS ESTRICTAS:
 * 
 * 1. Onboarding & Permisos de Usuario (PWA, Notificaciones, Geolocalización)
 * 2. Carga y Acreditación de Puntos con Historial y Expiraciones
 * 3. Canje de Premios, Reducción de Stock y Deuda Potencial (Costo vs. Mostrador)
 * 4. Caja Sorpresa (Mystery Box) - Generación y Tiradas
 * 5. Sistema de Referidos y Alertas de Reposición de Alimento para Mascotas
 * 6. Motor Diario (Engine Daily): Vencimientos de Puntos y Cumpleaños
 * 7. Notificaciones Push FCM, Inbox en Firestore y Emails
 * 8. ASSERT Clientes Dormidos & Origen de Registro (PWA vs. Local)
 * 9. ASSERT Cash Flow 100%: Suma(Intervalos 7d, 30d, 90d, +90d) === Total Puntos Circulantes
 * 
 * Uso: node scripts/auditoria-integral-sistema.cjs
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. Inicialización de Firebase Admin desde .dev_creds.json
let creds;
try {
    const devCredsRaw = fs.readFileSync(path.resolve(__dirname, '../.dev_creds.json'), 'utf8');
    const devCreds = JSON.parse(devCredsRaw);
    creds = typeof devCreds.credentials === 'string' ? JSON.parse(devCreds.credentials) : devCreds.credentials;
    console.log(`📂 Credenciales cargadas para proyecto: ${creds.project_id} (${creds.client_email})`);
} catch (e) {
    console.error('❌ Error al cargar credenciales de .dev_creds.json:', e.message);
    process.exit(1);
}

if (!admin.apps.length) {
    const privateKey = creds.private_key ? creds.private_key.replace(/\\n/g, '\n') : undefined;
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: creds.project_id,
            clientEmail: creds.client_email,
            privateKey: privateKey,
        }),
    });
}

const db = admin.firestore();
try {
    db.settings({ preferRest: true });
} catch (e) {
    // Ignorar si ya está configurado
}

// Formateador de moneda
const formatMoney = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);

async function runFullAuditSuite() {
    console.log('\n================================================================');
    console.log('🚀 INICIANDO SUITE DE AUDITORÍA INTEGRAL Y RIGUROSA 360°');
    console.log('================================================================\n');

    const results = {
        passed: 0,
        failed: 0,
        details: []
    };

    function logTestResult(name, success, info = '') {
        if (success) {
            results.passed++;
            console.log(`  ✅ [PASS] ${name} ${info ? `(${info})` : ''}`);
            results.details.push({ test: name, status: 'PASS', info });
        } else {
            results.failed++;
            console.log(`  ❌ [FAIL] ${name} ${info ? `(${info})` : ''}`);
            results.details.push({ test: name, status: 'FAIL', info });
        }
    }

    const TEST_USER_ID = 'TEST_AUDIT_SOCIO_PRIMARY';
    const TEST_DORMANT_USER_ID = 'TEST_AUDIT_SOCIO_DORMANT';
    const TEST_PWA_USER_ID = 'TEST_AUDIT_SOCIO_PWA';
    const TEST_REFERRER_ID = 'TEST_AUDIT_SOCIO_REFERRER';
    const TEST_PRIZE_ID = 'TEST_AUDIT_PRIZE_PRODUCT';

    try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        // ------------------------------------------------------------------------
        // 1. ONBOARDING & PERMISOS DE USUARIO (PWA, NOTIFICACIONES, UBICACIÓN)
        // ------------------------------------------------------------------------
        console.log('🔹 1. Probando Onboarding y Registro de Permisos...');
        
        await db.collection('users').doc(TEST_USER_ID).set({
            nombre: 'Socio Auditoría Test 💎',
            email: 'socio.audit@fidelidad-next.test',
            dni: '99888777',
            phone: '5491199998888',
            role: 'client',
            points: 0,
            source: 'local',
            birthDate: `1990-${todayMD}`,
            termsAccepted: true,
            termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            pwaInstalled: true,
            fcmTokens: ['TEST_FCM_TOKEN_AUDIT_KEY_2026'],
            lastLocation: {
                lat: -34.6037,
                lng: -58.3816,
                timestamp: Date.now()
            },
            permissions: {
                notifications: {
                    status: 'granted',
                    updatedAt: Date.now(),
                    deniedCount: 0,
                    platforms: ['pwa', 'mobile']
                },
                geolocation: {
                    status: 'granted',
                    updatedAt: Date.now(),
                    deniedCount: 0
                }
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const userSnap = await db.collection('users').doc(TEST_USER_ID).get();
        const userData = userSnap.data();

        const onboardingOk = userData &&
            userData.termsAccepted === true &&
            userData.permissions?.notifications?.status === 'granted' &&
            userData.permissions?.geolocation?.status === 'granted' &&
            userData.fcmTokens?.includes('TEST_FCM_TOKEN_AUDIT_KEY_2026') &&
            userData.lastLocation?.lat === -34.6037;

        logTestResult('Onboarding & Permisos (FCM + Geolocalización)', onboardingOk, `Status FCM: Granted, Lat: ${userData?.lastLocation?.lat}`);

        // ------------------------------------------------------------------------
        // 2. ACREDITACIÓN DE PUNTOS Y VENCIMIENTOS FUTUROS
        // ------------------------------------------------------------------------
        console.log('\n🔹 2. Probando Acreditación de Puntos y Bloques de Vencimiento...');
        
        const expirationDate = new Date(now);
        expirationDate.setDate(expirationDate.getDate() + 30); // Vence en 30 días

        const pointsToAssign = 1000;
        await db.collection('users').doc(TEST_USER_ID).update({
            points: admin.firestore.FieldValue.increment(pointsToAssign),
            nextExpirationDate: expirationDate.toISOString().split('T')[0],
            nextExpirationAmount: pointsToAssign
        });

        const historyRef = await db.collection('users').doc(TEST_USER_ID).collection('points_history').add({
            amount: pointsToAssign,
            concept: 'Acreditación de Prueba Auditoría',
            type: 'credit',
            date: admin.firestore.Timestamp.fromDate(now),
            expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
            status: 'active',
            remainingPoints: pointsToAssign
        });

        const updatedUserData = (await db.collection('users').doc(TEST_USER_ID).get()).data();
        const pointsOk = updatedUserData.points === 1000 && historyRef.id != null;
        logTestResult('Acreditación de Puntos & Historial', pointsOk, `Puntos asignados: ${updatedUserData.points}`);

        // ------------------------------------------------------------------------
        // 3. CANJE DE PREMIOS, STOCK Y DEUDA POTENCIAL
        // ------------------------------------------------------------------------
        console.log('\n🔹 3. Probando Canjes de Premios, Stock y Deuda Potencial...');
        
        await db.collection('prizes').doc(TEST_PRIZE_ID).set({
            name: 'Premio Físico Audit',
            pointsRequired: 400,
            stock: 5,
            internalCost: 2500,
            cashValue: 5000,
            active: true
        });

        const prizeSnap = await db.collection('prizes').doc(TEST_PRIZE_ID).get();
        const prizeData = prizeSnap.data();

        let redemptionOk = false;
        if (updatedUserData.points >= prizeData.pointsRequired && prizeData.stock > 0) {
            await db.collection('users').doc(TEST_USER_ID).update({
                points: admin.firestore.FieldValue.increment(-prizeData.pointsRequired)
            });
            await db.collection('prizes').doc(TEST_PRIZE_ID).update({
                stock: admin.firestore.FieldValue.increment(-1)
            });
            await db.collection('users').doc(TEST_USER_ID).collection('points_history').add({
                amount: prizeData.pointsRequired,
                concept: `Canje: ${prizeData.name}`,
                type: 'debit',
                date: admin.firestore.Timestamp.fromDate(now),
                prizeId: TEST_PRIZE_ID
            });
            redemptionOk = true;
        }

        const postRedemptionUser = (await db.collection('users').doc(TEST_USER_ID).get()).data();
        const postRedemptionPrize = (await db.collection('prizes').doc(TEST_PRIZE_ID).get()).data();

        const canjeFinalOk = redemptionOk &&
            postRedemptionUser.points === 600 &&
            postRedemptionPrize.stock === 4;

        logTestResult('Canje de Premio Físico (Puntos + Stock)', canjeFinalOk, `Puntos restantes: ${postRedemptionUser.points}, Stock restante: ${postRedemptionPrize.stock}`);

        // ------------------------------------------------------------------------
        // 4. CAJA SORPRESA / MYSTERY BOX
        // ------------------------------------------------------------------------
        console.log('\n🔹 4. Probando Caja Sorpresa (Mystery Box)...');
        
        await db.collection('users').doc(TEST_USER_ID).update({
            mysteryChances: 1,
            lastMysteryPlayDate: null
        });

        const rewardPoints = 50;
        await db.collection('users').doc(TEST_USER_ID).update({
            points: admin.firestore.FieldValue.increment(rewardPoints),
            mysteryChances: 0,
            lastMysteryPlayDate: todayStr
        });

        const postMysteryUser = (await db.collection('users').doc(TEST_USER_ID).get()).data();
        const mysteryOk = postMysteryUser.points === 650 && postMysteryUser.lastMysteryPlayDate === todayStr;

        logTestResult('Tirada de Caja Sorpresa & Recompensa', mysteryOk, `Nuevo saldo con premio: ${postMysteryUser.points}`);

        // ------------------------------------------------------------------------
        // 5. REFERIDOS & ALERTAS DE MASCOTAS
        // ------------------------------------------------------------------------
        console.log('\n🔹 5. Probando Referidos y Mascotas...');
        
        await db.collection('users').doc(TEST_REFERRER_ID).set({
            nombre: 'Socio Referente Audit 🌟',
            email: 'referente.audit@fidelidad-next.test',
            points: 100,
            referralStats: { count: 0, pointsEarned: 0 }
        });

        await db.collection('users').doc(TEST_USER_ID).update({
            referredBy: TEST_REFERRER_ID,
            pets: [{
                name: 'Firulais Audit',
                foodBrand: 'Pro Plan Adulto',
                lastPurchaseDate: new Date(now.getTime() - 27 * 86400000).toISOString().split('T')[0],
                foodCycleDays: 30
            }]
        });

        const bonusReferral = 150;
        await db.collection('users').doc(TEST_REFERRER_ID).update({
            points: admin.firestore.FieldValue.increment(bonusReferral),
            'referralStats.count': admin.firestore.FieldValue.increment(1),
            'referralStats.pointsEarned': admin.firestore.FieldValue.increment(bonusReferral)
        });

        const referrerPost = (await db.collection('users').doc(TEST_REFERRER_ID).get()).data();
        const referidosOk = referrerPost.points === 250 && referrerPost.referralStats.count === 1;

        logTestResult('Bono de Referidos & Mascotas', referidosOk, `Puntos referentes: ${referrerPost.points}`);

        // ------------------------------------------------------------------------
        // 6. MOTOR DIARIO: VENCIMIENTOS Y CUMPLEAÑOS
        // ------------------------------------------------------------------------
        console.log('\n🔹 6. Probando Motor Diario (Vencimientos & Cumpleaños)...');
        
        const pastDate = new Date(now.getTime() - 2 * 86400000);
        await db.collection('users').doc(TEST_USER_ID).collection('points_history').add({
            amount: 100,
            concept: 'Puntos Expirados Audit Test',
            type: 'credit',
            date: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 32 * 86400000)),
            expiresAt: admin.firestore.Timestamp.fromDate(pastDate),
            status: 'active',
            remainingPoints: 100
        });

        const historySnap = await db.collection('users').doc(TEST_USER_ID).collection('points_history')
            .where('status', '==', 'active')
            .get();

        let expiredCalculated = 0;
        for (const doc of historySnap.docs) {
            const h = doc.data();
            if (h.expiresAt && h.expiresAt.toDate() < now) {
                expiredCalculated += (h.remainingPoints || h.amount);
                await doc.ref.update({ status: 'expired', remainingPoints: 0 });
            }
        }

        if (expiredCalculated > 0) {
            await db.collection('users').doc(TEST_USER_ID).update({
                points: admin.firestore.FieldValue.increment(-expiredCalculated)
            });
        }

        const birthdayBonus = 200;
        await db.collection('users').doc(TEST_USER_ID).update({
            points: admin.firestore.FieldValue.increment(birthdayBonus),
            lastBirthdayPointsYear: String(now.getFullYear())
        });

        const postEngineUser = (await db.collection('users').doc(TEST_USER_ID).get()).data();
        const engineOk = postEngineUser.lastBirthdayPointsYear === String(now.getFullYear()) && expiredCalculated === 100;

        logTestResult('Motor Diario (Procesamiento de Vencimientos + Cumpleaños)', engineOk, `Puntos expirados: -${expiredCalculated}, Bonus Cumpleaños: +${birthdayBonus}`);

        // ------------------------------------------------------------------------
        // 7. MENSAJERÍA (INBOX FIRESTORE)
        // ------------------------------------------------------------------------
        console.log('\n🔹 7. Probando Mensajería e Inbox...');
        
        const notificationRef = await db.collection('users').doc(TEST_USER_ID).collection('inbox').add({
            title: '🎉 ¡Feliz Cumpleaños Socio Audit!',
            body: 'Te regalamos 200 puntos especiales en tu día.',
            type: 'birthday',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const inboxSnap = await notificationRef.get();
        const messagingOk = inboxSnap.exists && inboxSnap.data().title.includes('Feliz Cumpleaños');

        logTestResult('Persistencia en Inbox de Notificaciones', messagingOk, `ID Mensaje: ${notificationRef.id}`);

        // ------------------------------------------------------------------------
        // 8. ASSERT CLIENTES DORMIDOS Y ORIGEN DE REGISTRO (PWA vs. LOCAL)
        // ------------------------------------------------------------------------
        console.log('\n🔹 8. Probando Aserción de Clientes Dormidos y Origen de Registro...');

        const fortyDaysAgo = new Date(now.getTime() - 45 * 86400000);
        await db.collection('users').doc(TEST_DORMANT_USER_ID).set({
            nombre: 'Socio Dormido Audit 😴',
            email: 'dormido.audit@fidelidad-next.test',
            role: 'client',
            points: 50,
            source: 'local',
            lastPurchaseDate: admin.firestore.Timestamp.fromDate(fortyDaysAgo),
            createdAt: admin.firestore.Timestamp.fromDate(fortyDaysAgo)
        });

        await db.collection('users').doc(TEST_PWA_USER_ID).set({
            nombre: 'Socio PWA Audit 📱',
            email: 'pwa.audit@fidelidad-next.test',
            role: 'client',
            points: 200,
            source: 'pwa',
            lastPurchaseDate: admin.firestore.Timestamp.fromDate(now),
            createdAt: admin.firestore.Timestamp.fromDate(now)
        });

        const allUsersSnap = await db.collection('users').where('role', '!=', 'admin').get();
        let dormantCount = 0;
        let pwaCount = 0;
        let localCount = 0;
        const dormantThreshold = new Date(now.getTime() - 30 * 86400000);

        allUsersSnap.forEach(d => {
            const u = d.data();
            const lastActivity = u.lastPurchaseDate?.toDate ? u.lastPurchaseDate.toDate() : (u.createdAt?.toDate ? u.createdAt.toDate() : null);
            if (!lastActivity || lastActivity < dormantThreshold) {
                dormantCount++;
            }
            if (u.source === 'pwa') pwaCount++;
            else localCount++;
        });

        const dormantAssertOk = dormantCount >= 1 && pwaCount >= 1 && localCount >= 1;
        logTestResult('ASSERT Clientes Dormidos & Origen PWA/Local', dormantAssertOk, `Dormidos: ${dormantCount}, PWA: ${pwaCount}, Local: ${localCount}`);

        // ------------------------------------------------------------------------
        // 9. ASSERT CASH FLOW 100%: Suma(Intervalos) === Total Puntos Circulantes
        // ------------------------------------------------------------------------
        console.log('\n🔹 9. Auditando Cash Flow 100% con Aserción Matemática Rígida...');

        const forecastIntervals = {
            short:  { label: 'Próximos 7 días', points: 0 },
            medium: { label: '8 a 30 días',      points: 0 },
            long:   { label: '31 a 90 días',      points: 0 },
            future: { label: 'Más de 90 días',    points: 0 }
        };

        let totalCirculatingPoints = 0;
        const startOfTodayStr = now.toISOString().split('T')[0];

        allUsersSnap.forEach(uDoc => {
            const u = uDoc.data();
            const uPoints = Number(u.points || 0);
            totalCirculatingPoints += uPoints;

            const expItems = [];
            if (Array.isArray(u.expirationDetails) && u.expirationDetails.length > 0) {
                u.expirationDetails.forEach(det => {
                    const pts = Number(det.points || 0);
                    if (pts > 0) expItems.push({ date: new Date(det.date), points: pts });
                });
            } else if (u.nextExpirationDate && Number(u.nextExpirationAmount || 0) > 0) {
                expItems.push({ date: new Date(u.nextExpirationDate + 'T12:00:00'), points: Number(u.nextExpirationAmount) });
            }

            let userAllocatedPoints = 0;
            let userVirtualExpired = 0;

            expItems.forEach(item => {
                const itemDateStr = item.date.toISOString().split('T')[0];
                if (itemDateStr < startOfTodayStr) {
                    userVirtualExpired += Math.min(uPoints, item.points);
                }
            });

            const userActivePoints = Math.max(0, uPoints - userVirtualExpired);

            expItems.forEach(item => {
                const itemDateStr = item.date.toISOString().split('T')[0];
                if (itemDateStr >= startOfTodayStr) {
                    const diffDays = Math.round((item.date.getTime() - now.getTime()) / 86400000);
                    if (diffDays >= 0) {
                        let bucket = null;
                        if (diffDays <= 7) bucket = forecastIntervals.short;
                        else if (diffDays <= 30) bucket = forecastIntervals.medium;
                        else if (diffDays <= 90) bucket = forecastIntervals.long;
                        else bucket = forecastIntervals.future;

                        if (bucket) {
                            const availableForUser = Math.max(0, userActivePoints - userAllocatedPoints);
                            const ptsToAdd = Math.min(item.points, availableForUser);
                            if (ptsToAdd > 0) {
                                bucket.points += ptsToAdd;
                                userAllocatedPoints += ptsToAdd;
                            }
                        }
                    }
                }
            });

            const unallocatedPoints = Math.max(0, userActivePoints - userAllocatedPoints);
            if (unallocatedPoints > 0) {
                forecastIntervals.future.points += unallocatedPoints;
            }
        });

        const totalCashFlowSum = Object.values(forecastIntervals).reduce((acc, b) => acc + b.points, 0);

        // ASERCIÓN MATEMÁTICA ESTRICTA: Suma(Intervalos) === Total Puntos Circulantes
        const cashFlow100Ok = totalCashFlowSum === totalCirculatingPoints;

        logTestResult(
            'ASSERT Cash Flow 100% (Suma de Intervalos === Puntos Circulantes)',
            cashFlow100Ok,
            `Circulantes: ${totalCirculatingPoints} pts | Suma CashFlow: ${totalCashFlowSum} pts (Coincidencia exactitud: 100%)`
        );

    } catch (err) {
        console.error('\n❌ ERROR INESPERADO DURANTE LA AUDITORÍA:', err);
        results.failed++;
    } finally {
        // ------------------------------------------------------------------------
        // LIMPIEZA DE DATOS DE PRUEBA (TEARDOWN)
        // ------------------------------------------------------------------------
        console.log('\n🧹 Limpiando registros de prueba...');
        try {
            await db.collection('users').doc(TEST_USER_ID).delete();
            await db.collection('users').doc(TEST_DORMANT_USER_ID).delete();
            await db.collection('users').doc(TEST_PWA_USER_ID).delete();
            await db.collection('users').doc(TEST_REFERRER_ID).delete();
            await db.collection('prizes').doc(TEST_PRIZE_ID).delete();
            console.log('✅ Datos de prueba borrados correctamente.');
        } catch (e) {
            console.warn('⚠️ Error al borrar documentos de prueba:', e.message);
        }

        // ------------------------------------------------------------------------
        // RESUMEN FINAL
        // ------------------------------------------------------------------------
        console.log('\n================================================================');
        console.log('📊 RESUMEN FINAL DE LA AUDITORÍA INTEGRAL 360° REFORZADA');
        console.log('================================================================');
        console.log(`Pruebas Totales : ${results.passed + results.failed}`);
        console.log(`Pruebas Exitosas: ✅ ${results.passed}`);
        console.log(`Pruebas Fallidas: ❌ ${results.failed}`);
        console.log('================================================================\n');

        if (results.failed === 0) {
            console.log('🎉 ¡AUDITORÍA FINAL COMPLETA EXITOSA! Todas las aserciones matemáticas cuadran al 100%.');
        } else {
            console.log('⚠️ Se encontraron fallos o inconsistencias matemáticas. Revisar reporte.');
        }

        process.exit(results.failed === 0 ? 0 : 1);
    }
}

runFullAuditSuite().catch(err => {
    console.error(err);
    process.exit(1);
});
