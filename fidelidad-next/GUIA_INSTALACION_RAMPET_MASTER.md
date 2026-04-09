# 🚀 Guía Maestra de Instalación: RAMPET v3.0
**Manual de Despliegue Profesional e Independiente**

Este documento es la fuente de verdad definitiva para el despliegue del ecosistema RAMPET. Siga estos pasos para garantizar una instalación 100% aislada, segura y funcional para nuevos clientes.

---

## 📋 Requisitos Previos
1. **Cuenta en Google (Gmail)**: Para Firebase y SMTP.
2. **Cuenta en Vercel**: Hosting del Frontend y API.
3. **Cuenta en Upstash**: Para el motor automático (QStash).
4. **Dominio del Cliente**: (Opcional) Ej: `fidelidad.cliente.com`.

---

## 🛠️ Fase 1: Configuración de Firebase
1. **Crear Proyecto**: Vaya a [Firebase Console](https://console.firebase.google.com/).
2. **Configuración de la App (Web)**:
   - Registre una "Web App".
   - Copie el objeto `firebaseConfig` (lo necesitará para las variables `VITE_FIREBASE_*`).
3. **Cuentas de Servicio (CUIDADO - CRÍTICO)**:
   - Configuración del proyecto > Cuentas de servicio.
   - Haga clic en **"Generar nueva clave privada"**.
   - Descargue el JSON. **Este archivo completo será su variable `GOOGLE_CREDENTIALS_JSON`**.
4. **Cloud Messaging**:
   - Activa el SDK de Web Push.
   - Genera un par de llaves **VAPID**. La "Key Pública" será su `VITE_VAPID_PUBLIC_KEY`.

---

## 📧 Fase 2: Configuración de Correo (SMTP)
1. Use una cuenta de Gmail dedicada al cliente.
2. Activa **"Verificación en dos pasos"**.
3. Vaya a [Contraseñas de aplicaciones](https://myaccount.google.com/apppasswords).
4. Genere una contraseña para "Correo" y "Otro (RAMPET)".
5. **SMTP_USER**: Su email.
6. **SMTP_PASS**: La clave de 16 caracteres generada (sin espacios).

---

## 🤖 Fase 3: Motor Automático (QStash)
1. Cree un equipo/cuenta en [Upstash](https://console.upstash.com/qstash).
2. Copie las **Signing Keys** (Current y Next).
3. **Destinatario**: En el Panel de Administración del cliente (Sección Avanzado), verá la URL de destino dinámica. Cópiela y péguela en QStash como un "Scheduled Job" (Cron: `0 9 * * *` para las 9 AM).

---

## 📊 Tabla Maestra de Variables de Entorno (30 Obligatorias)

Configure estas variables en **Vercel > Settings > Environment Variables**.

| Categoría | Variable | Descripción / Ejemplo |
| :--- | :--- | :--- |
| **Identidad** | `VITE_APP_NAME` | Nombre comercial (ej: RAMPET Fidelidad) |
| **Identidad** | `VITE_APP_SHORT_NAME` | Nombre para ícono móvil (max 12 carac.) |
| **Seguridad** | `VITE_API_KEY` | Clave secreta compartida (ej: `rk_live_...`) |
| **Seguridad** | `API_SECRET_KEY` | **DEBE COINCIDIR** con `VITE_API_KEY` |
| **Seguridad** | `CORS_ALLOWED_ORIGINS` | `https://tu-dominio.vercel.app` |
| **Firebase (WEB)** | `VITE_FIREBASE_API_KEY` | De la consola de Firebase |
| **Firebase (WEB)** | `VITE_FIREBASE_AUTH_DOMAIN` | `proyecto-id.firebaseapp.com` |
| **Firebase (WEB)** | `VITE_FIREBASE_PROJECT_ID` | ID único del proyecto |
| **Firebase (WEB)** | `VITE_FIREBASE_STORAGE_BUCKET` | `proyecto-id.firebasestorage.app` |
| **Firebase (WEB)** | `VITE_FIREBASE_MESSAGING_SENDER_ID`| ID numérico de mensajería |
| **Firebase (WEB)** | `VITE_FIREBASE_APP_ID` | ID único de la App Web |
| **Firebase (WEB)** | `VITE_FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXX` (Opcional) |
| **Push (PWA)** | `VITE_VAPID_PUBLIC_KEY` | Llave pública de Cloud Messaging |
| **Backend (Admin)** | `GOOGLE_CREDENTIALS_JSON` | **Todo el contenido del JSON** de la llave privada |
| **Correo (SMTP)** | `SMTP_USER` | Email de envío (ej: `notificaciones@gmail.com`) |
| **Correo (SMTP)** | `SMTP_PASS` | Contraseña de aplicación de 16 dígitos |
| **Dominio** | `PWA_URL` | URL completa (ej: `https://app.com`) |
| **Upstash** | `QSTASH_CURRENT_SIGNING_KEY` | Desde el panel de Upstash |
| **Upstash** | `QSTASH_NEXT_SIGNING_KEY` | Llave de respaldo de Upstash |
| **Diseño** | `PUSH_ICON_URL` | Link a imagen cuadrada (512x512) |
| **Diseño** | `PUSH_BADGE_URL` | Link a ícono blanco/negro (96x96) |
| **Admin Setup** | `INITIAL_ADMIN_EMAIL` | Email del primer administrador (opcional) |
| **Admin Setup** | `INITIAL_ADMIN_PASSWORD` | Password del primer admin (opcional) |
| **WhatsApp** | `VITE_WHATSAPP_PHONE_ID` | (En desarrollo) Meta Phone ID |
| **WhatsApp** | `VITE_WHATSAPP_WABA_ID` | (En desarrollo) Meta Business ID |
| **WhatsApp** | `VITE_WHATSAPP_TOKEN` | (En desarrollo) Meta Access Token |
| **Reglas** | `DEFAULT_POINTS_BASE` | `100` (Default por cada $100) |
| **Reglas** | `DEFAULT_POINTS_VALUE` | `10` (Default $10 por punto) |
| **Backend** | `NODE_VERSION` | `20.x` (Configurar en Vercel) |
| **Backend** | `PROJECT_ROOT_DIR` | `fidelidad-next` |

---

## 🚨 Solución de Problemas (Troubleshooting)

### 1. El Panel de Control dice "Error de API"
- **Causa**: `VITE_API_KEY` y `API_SECRET_KEY` no coinciden.
- **Solución**: Asegúrese de que ambos tengan exactamente el mismo valor.

### 2. QStash no ejecuta el motor
- **Causa**: La URL de destino es incorrecta o las llaves de firma expiraron.
- **Solución**: Verifique en el Panel Avanzado > QStash que la URL listada coincida con la configurada en el Job de Upstash.

### 3. No llegan los correos
- **Causa**: Contraseña de aplicación incorrecta.
- **Solución**: Google no permite usar la clave normal de Gmail. Debe usar la **Contraseña de Aplicación** específica.

---

## 📤 Exportar a PDF
Para generar un PDF profesional a partir de este manual:
1. Abra este archivo en VS Code.
2. Presione `Ctrl+Shift+P` y busque **"Markdown: Export as PDF"** (requiere extensión Markdown PDF).
3. Obtendrá un documento limpio, con tablas y formato premium.

---
> [!NOTE]
> Esta guía ha sido optimizada para la versión 3.0 de RAMPET, asegurando la **independencia total** de cada instancia.
