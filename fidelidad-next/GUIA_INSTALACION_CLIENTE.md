# 🛡️ Manual de Despliegue e Instalación: Ecosistema RAMPET
**Versión:** 2.5 | **Estado:** Estable (Producción) | **Actualizado:** Abril 2026

---

## 📋 Resumen Ejecutivo
Este documento constituye la guía maestra para la implementación de instancias independientes del sistema de fidelización **RAMPET**. Cada nuevo cliente requiere una infraestructura aislada para garantizar la seguridad de los datos y el rendimiento óptimo.

### Índice de Navegación
1. [Configuración de Infraestructura de Datos (Firebase)](#1-configuración-de-infraestructura-de-datos-firebase)
2. [Configuración de Mensajería (Gmail SMTP)](#2-configuración-de-mensajería-gmail-smtp)
3. [Despliegue de Aplicación Web (Vercel)](#3-despliegue-de-aplicación-web-vercel)
4. [Automatización de Tareas (Upstash QStash)](#4-automatización-de-tareas-upstash-qstash)
5. [Automatización con Script Bootstrap](#5-automatización-con-script-bootstrap)
6. [Gestión de Roles y Privilegios](#6-gestión-de-roles-y-privilegios)
7. [PWA y Extensión de Chrome](#7-pwa-y-extensión-de-chrome)
8. [Resolución de Problemas (Troubleshooting)](#8-resolución-de-problemas-troubleshooting)

---

## 1. Configuración de Infraestructura de Datos (Firebase)
*El núcleo del sistema reside en Firebase. Siga estos pasos para inicializar el contenedor de datos del cliente.*

### 🛠️ Paso 1.1: Inicialización
1.  **Creación**: Acceda a [Firebase Console](https://console.firebase.google.com/) y cree un nuevo proyecto.
2.  **Ubicación**: Región **`southamerica-east1` (San Pablo)**.
3.  **Authentication**: Habilite el método "Email/Password". 
4.  **Firestore**: Inicie en "Production Mode".

### 🔑 Paso 1.2: Obtención de Credenciales (3 grupos críticos)
-   **A) API Keys de la Web**: Tuerca ⚙️ > Project Settings > General > "Tus apps" > Ícono `</>`. Registre la app y copie el objeto `firebaseConfig`.
-   **B) Service Account (Llave Maestra)**: Tuerca ⚙️ > Project Settings > Service Accounts > "Generate new private key". Descargue el archivo `.json`.
-   **C) VAPID (Notificaciones)**: Tuerca ⚙️ > Cloud Messaging > "Web push certificates" > "Generate Key Pair". Copie la Key pública.

### 🔒 Paso 1.3: Reglas de Seguridad de Firestore
Pestaña **Rules**. Reemplace el contenido por el siguiente bloque que protege los puntos y datos sensibles:

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

## 2. Configuración de Mensajería (Gmail SMTP)
*Necesario para que el sistema envíe comprobantes de puntos e invitaciones.*

1.  Habilite **"Verificación en 2 pasos"** en la cuenta de Google.
2.  Busque **"Contraseñas de aplicación"** (App Passwords).
3.  Cree una llamada "RAMPET Vercel".
4.  Obtenga la clave de **16 caracteres** (Ej: `xxxx yyyy zzzz wwww`). Úsela como valor para `SMTP_PASS`.

---

## 3. Despliegue de Aplicación Web (Vercel)
*Proceso de construcción del frontend y las APIs.*

### ⚙️ Parámetros de Build
Configure estos campos exactamente en **Settings > Build & Development**:

| Parámetro | Valor Requerido | Nota |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | No use 'Other' o dará error 404. |
| **Root Directory** | `fidelidad-next` | Ubicación real del código en el repo. |

### 🔑 Environment Variables (Las 16 Magníficas)
Copie el contenido de **`PLANTILLA_VARIABLES.txt`** y péguelo directamente en Vercel para ahorrar tiempo.

| Variable | Fuente |
| :--- | :--- |
| `VITE_APP_NAME` | Branding del cliente |
| `VITE_API_KEY` | Llave secreta (inventada, igual que `API_SECRET_KEY`) |
| `GOOGLE_CREDENTIALS_JSON` | Contenido del archivo .json bajado en el Paso 1.2-B |
| `VITE_VAPID_PUBLIC_KEY` | Paso 1.2-C |
| `SMTP_PASS` | El código de 16 letras de Gmail (Paso 2) |

---

## 4. Automatización de Tareas (Upstash QStash)
*Configura el "despertador" que procesa vencimientos automáticamente.*

1.  **URL**: `https://TU-CLIENTE.vercel.app/api/engine-daily?mode=daily&trigger=qstash`
2.  **Cron Expression**: `0 * * * *` (Verifica cada hora para garantizar ejecución).
3.  **Headers**:
    -   Key: `x-api-key`
    -   Value: El valor de su `VITE_API_KEY`.

---

## 5. Automatización con Script Bootstrap
*Si prefieres no cargar las 16 variables a mano, usa nuestra herramienta de terminal.*

1.  Asegúrese de tener el archivo `PLANTILLA_VARIABLES.txt` completo localmente.
2.  Abra una terminal en la carpeta del proyecto y ejecute:
    ```bash
    node scripts/bootstrap-client.js
    ```
3.  El script te pedirá el **Project ID** y se encargará de vincular Vercel y subir todas las variables automáticamente.

---

## 6. Gestión de Roles y Privilegios
*Cómo convertirte en Administrador Maestro.*

1.  Regístrese en el sitio del cliente con su email.
2.  En Firestore > Colección `users`, busque su documento y copie el ID.
3.  Cree una colección **`admins`** y use ese ID para el documento.
4.  Agregue el campo `role: "admin"` y `status: "active"`.

---

## 7. PWA y Extensión de Chrome
*La herramienta para el punto de venta.*

### 📱 PWA (Celular)
Entre a la URL del cliente desde Chrome/Safari y elija **"Instalar Aplicación"** o **"Añadir a pantalla de inicio"**.

### 🧩 Extensión
1. Cargue la carpeta de la extensión en Chrome `chrome://extensions`.
2. Configure la **API URL** del cliente (Ej: `https://lospinos.vercel.app`).
3. Ingrese la **API Key** que configuró en Vercel.

---

## 8. Resolución de Problemas (Troubleshooting)

### 🔴 Error: "Domain not allowed by project"
**Solución:** Ingrese a Firebase > Authentication > Settings > Authorized Domains y añada la URL de Vercel (Ej: `franccesca.vercel.app`). **Sin esto, no funcionan las invitaciones.**

### 🔴 Error 404 al navegar a /admin
**Solución:** Verifique en Vercel que el **Root Directory** sea `fidelidad-next` y el framework sea `Vite`.

### 🔴 No llegan los correos electrónicos
**Solución:** Revise que `SMTP_PASS` sea la clave de 16 letras. No use su clave de Gmail normal, Google la bloqueará.

### 🔴 Puntos que no vencen solos
**Solución:** Verifique en Upstash que el Header `x-api-key` coincida exactamente con la variable de Vercel.

---
> [!IMPORTANT]
> **Sincronización Segura**: Todo cambio nuevo debe probarse en el **Laboratorio** (Rama `desarrollo`) antes de pedir un Merge a la rama `main` (Producción), que es la que usan todos tus clientes.
