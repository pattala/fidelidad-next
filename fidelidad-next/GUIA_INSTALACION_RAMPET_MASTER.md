# 🚀 Guía Maestra de Instalación: RAMPET v4.1 (Edición de Oro)
**Manual de Despliegue Profesional, Automatizado e Independiente**

Este documento es la fuente de verdad definitiva para el despliegue del ecosistema RAMPET. Siga estos pasos para garantizar una instalación 100% aislada, segura y funcional.

---

## 🏗️ Fase 0: Auditoría de Preparación (System Check)
Antes de comenzar, verifique que su entorno local tenga las herramientas necesarias. Abra una terminal y ejecute:

```bash
node -v      # Debe devolver v18+ 
git --version   # Debe estar instalado
firebase -V    # Firebase CLI
vercel -v      # Vercel CLI
```

---

## 🛠️ Fase 1: Infraestructura de Datos (Firebase)

### 1.1 Configuración Inicial
1. **Crear Proyecto**: En [Firebase Console](https://console.firebase.google.com/).
2. **Authentication**: Habilitar "Email/Password".
3. **Firestore**: Iniciar en "Modo Producción" (Región San Pablo `southamerica-east1` recomendada).

### 1.2 Reglas de Seguridad (Seguridad Granular)
Pestaña **Rules** de Firestore. Pegue este bloque para proteger los puntos de los socios:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid))
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

## 📖 Diccionario de Obtención de Keys (Paso a Paso)

Aquí se explica cómo obtener cada una de las variables requeridas en Vercel.

### A. Grupo Firebase Client (`VITE_FIREBASE_*`)
*   **Dónde**: Tuerca ⚙️ > Project Settings > General > Sección "Your Apps".
*   **Cómo**: Si no hay una app, dale a `Add App` (ícono `</>`). Registra el nombre.
*   **Qué copiar**: En el bloque de código que aparece, verás `apiKey`, `authDomain`, etc. Cópialos uno por uno a su variable correspondiente.

### B. Grupo Admin SDK (`GOOGLE_CREDENTIALS_JSON`)
*   **Donde**: Tuerca ⚙️ > Project Settings > Service Accounts.
*   **Cómo**: Clic en botón "Generate New Private Key" > Generate Key.
*   **Qué copiar**: Se descargará un archivo `.json`. Abre ese archivo con un bloc de notas, copia **TODO** el contenido (incluyendo las llaves `{ }`) y pégalo tal cual en el valor de la variable en Vercel.

### C. Grupo Push (`VITE_VAPID_PUBLIC_KEY`)
*   **Dónde**: Tuerca ⚙️ > Project Settings > Cloud Messaging.
*   **Cómo**: Baja hasta "Web Push certificates" > Clic en "Generate Key Pair".
*   **Qué copiar**: Copia la cadena larga de texto bajo la columna "Key pair".

### D. Grupo Correo (`SMTP_USER` y `SMTP_PASS`)
*   **Dónde**: Configuración de tu cuenta de Google (Gmail).
*   **Cómo**:
    1. Activa "Seguridad" > "Verificación en 2 pasos".
    2. Busca (arriba en el buscador de la cuenta) "Contraseñas de aplicaciones".
    3. Nombre de la App: "RAMPET".
*   **Qué copiar**: Google te dará un código de **16 letras**. Ese es tu `SMTP_PASS`. Tu `SMTP_USER` es simplemente tu email de Gmail.

### E. Grupo Automatización QStash (`QSTASH_*`)
*   **Dónde**: [Upstash Console](https://console.upstash.com/qstash).
*   **Cómo**: Crea una cuenta gratuita y ve a la pestaña QStash.
*   **Qué copiar**: En la página principal verás `Current Signing Key` y `Next Signing Key`. Cópialas a Vercel.

### F. Grupo Seguridad Interna (`VITE_API_KEY` y `API_SECRET_KEY`)
*   **Cómo**: Estas las inventas tú. Puede ser cualquier palabra larga y compleja (ej: `rampet_security_3344_x`).
*   **IMPORTANTE**: Ambas deben tener el **MISMO VALOR** exacto para que el frontend pueda hablar con el backend.

### G. 📱 Nota sobre WhatsApp
*   **¿Por qué no hay variables de WhatsApp?**: El sistema detecta automáticamente si el número está configurado en el panel administrativo. No es necesario cargarlo como variable de entorno, lo que da flexibilidad total al cliente para cambiarlo sin tocar código.

---

## 🤖 Fase 2: Automatización con Script Bootstrap
Para no cargar estas 30 variables a mano en Vercel:

1. Edite el archivo `PLANTILLA_VARIABLES.txt` con los valores obtenidos en el Diccionario anterior.
2. Ejecute en su PC:
   ```bash
   node scripts/bootstrap-client.js
   ```
3. El script subirá todo a Vercel y configurará el proyecto automáticamente.

---

## 🚀 Fase 3: Despliegue y Verificación
1. **Root Directory**: Asegúrese de que en Vercel sea `fidelidad-next`.
2. **URL dinámica**: Una vez desplegado, vaya a **Avanzado** en el panel admin y verá la URL de QStash lista para copiar.

### ✅ Checklist Final de Calidad
- [ ] ¿El logo de la instancia es el correcto?
- [ ] ¿Los botones de "Copiar URL" en Configuración devuelven la URL del dominio actual?
- [ ] ¿Los correos de invitación llegan con el nombre del cliente?
- [ ] ¿El simulador de fecha funciona sin afectar a otros clientes?

---
> [!NOTE]
> **Exportación**: Este manual ha sido optimizado para ser exportado como PDF desde VS Code (`Markdown PDF: Export`).

