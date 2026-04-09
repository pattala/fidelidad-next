# 🚀 Guía Maestra de Instalación: RAMPET v4.0 (Edición Definitiva)
**Manual de Despliegue Profesional, Automatizado e Independiente**

---

## 📋 Resumen del Ecosistema
Esta guía es el recurso definitivo para desplegar instancias aisladas de RAMPET. Siga estos pasos para garantizar que cada cliente tenga su propia base de datos, sistema de mensajería y automatización sin cruces de datos.

---

## 🏗️ Fase 0: Auditoría de Preparación (System Check)
Antes de comenzar, verifique que su entorno local tenga las herramientas necesarias. Abra una terminal (PowerShell o CMD) y ejecute:

```bash
# Verificar Node.js (Requerido para el script de automatización)
node -v

# Verificar Git (Requerido para descargar el código)
git --version

# Verificar Firebase CLI (Requerido para subir reglas)
firebase --version

# Verificar Vercel CLI (Requerido para vincular el proyecto)
vercel --version
```
> [!TIP]
> Si algún comando falla, descargue la herramienta correspondiente antes de continuar.

---

## 🛠️ Fase 1: Infraestructura de Datos (Firebase)

### 1.1 Configuración Inicial
1.  **Crear Proyecto**: En [Firebase Console](https://console.firebase.google.com/).
2.  **Authentication**: Habilite el método "Email/Password".
3.  **Firestore**: Inicie en "Modo Producción" y elija la región más cercana a sus clientes.

### 1.2 Reglas de Seguridad (Restaurado)
Vaya a la pestaña **Rules** y pegue este bloque exactamente:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() && (
        (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin') ||
        request.auth.token.email.matches('.*@admin\\.com')
      );
    }
    match /users/{userId} {
      allow read: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
    }
    match /{path=**}/admins/{adminId} { allow read, write: if isAdmin(); }
    match /config/{document} { allow read: if true; allow write: if isAdmin(); }
    match /prizes/{id} { allow read: if true; allow write: if isAdmin(); }
    match /campanas/{id} { allow read: if true; allow write: if isAdmin(); }
  }
}
```

---

## 📧 Fase 2: Configuración SMTP (Gmail)
1. Active la **Verificación en 2 pasos** en su cuenta de Gmail.
2. Genere una **Contraseña de Aplicación** (App Password).
3. Guarde la clave de 16 caracteres. Esta será su variable `SMTP_PASS`.

---

## 🤖 Fase 3: Automatización Superior (Bootstrap Script)
*No cargue las 30 variables a mano. Use nuestra herramienta de inyección masiva.*

1. Complete su archivo `PLANTILLA_VARIABLES.txt` localmente con los datos del nuevo cliente.
2. En la terminal, dentro de la carpeta del proyecto, ejecute:
   ```bash
   node scripts/bootstrap-client.js
   ```
3. El script le pedirá el **Project ID** de Firebase y realizará lo siguiente:
   - Vinculará su cuenta de Vercel.
   - Creará el proyecto en Vercel si no existe.
   - **Subirá las 30 variables de entorno automáticamente.**
   - Desplegará las reglas de Cloud Firestore.

---

## 📊 Fase 4: Tabla Maestra de Variables (Sanitizada)

| Categoría | Variable | Valor / Origen |
| :--- | :--- | :--- |
| **Identidad** | `VITE_APP_NAME` | Nombre Comercial (Ej: Franccesca Martinez) |
| **Identidad** | `VITE_APP_SHORT_NAME` | Nombre corto PWA |
| **Seguridad** | `VITE_API_KEY` | Clave secreta (Inventada, ej: `sec_123...`) |
| **Seguridad** | `API_SECRET_KEY` | **IDÉNTICA** a `VITE_API_KEY` |
| **Firebase** | `VITE_FIREBASE_API_KEY` | Firebase Config |
| **Firebase** | `VITE_FIREBASE_AUTH_DOMAIN` | `proyecto.firebaseapp.com` |
| **Firebase** | `VITE_FIREBASE_PROJECT_ID` | Tu Project ID |
| **Firebase** | `VITE_FIREBASE_STORAGE_BUCKET`| `proyecto.firebasestorage.app` |
| **Firebase** | `VITE_FIREBASE_MESSAGING_SENDER_ID`| ID Numérico |
| **Firebase** | `VITE_FIREBASE_APP_ID` | App ID único |
| **Firebase** | `VITE_FIREBASE_MEASUREMENT_ID` | G-XXXXXXXX (Opcional) |
| **Notif.** | `VITE_VAPID_PUBLIC_KEY` | Firebase Cloud Messaging VAPID |
| **Backend** | `GOOGLE_CREDENTIALS_JSON` | Contenido completo del JSON (Paso 1.2-B) |
| **Email** | `SMTP_USER` | Su cuenta de Gmail |
| **Email** | `SMTP_PASS` | La clave de 16 dígitos (Paso 2) |
| **Deploy** | `PWA_URL` | URL final (Ej: `https://franccesca.vercel.app`) |
| **Deploy** | `PROJECT_ROOT_DIR` | `fidelidad-next` |
| **Deploy** | `NODE_VERSION` | `20.x` |
| **QStash** | `QSTASH_CURRENT_SIGNING_KEY`| De Upstash Dashboard |
| **QStash** | `QSTASH_NEXT_SIGNING_KEY` | De Upstash Dashboard |

---

## 🖼️ Fase 5: Referencia Visual y Troubleshooting

### Verificación de Build en Vercel
Asegúrese de que el **Root Directory** sea `fidelidad-next` para evitar errores 404.
![Build Settings](file:///C:/Users/pablo/.gemini/antigravity/brain/9368840e-5c6b-4677-9fd8-5d8413c58f34/fix_vercel_root_dir_1775636159174.webp)

### QStash dinámico (Nuevo)
En el Panel Avanzado del Administrador, ahora verá la URL dinámica. Cópiela directamente desde allí para evitar errores de escritura. No apunte a `fidelidad-next` si está configurando un nuevo cliente.

---

## 🚨 Troubleshooting Común

- **Error de Dominios**: Si las invitaciones fallan, añada el dominio de Vercel en Firebase Authentication > Settings > Authorized Domains.
- **Error JSON**: Si `GOOGLE_CREDENTIALS_JSON` da error al iniciar, verifique que no falten comillas al copiar el contenido del archivo JSON.

---
> [!IMPORTANT]
> **Exportación a PDF**: Para entregar este manual al cliente, abra este archivo en VS Code y use la extensión **Markdown PDF** (`Ctrl+Shift+P > Markdown PDF: Export`).
