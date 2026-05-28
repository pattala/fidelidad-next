# 🚀 Guía Maestra de Instalación: RAMPET v4.1 (Edición de Oro)
**Manual de Despliegue Profesional, Automatizado e Independiente**

Este documento es la fuente de verdad definitiva para el despliegue del ecosistema RAMPET. Siga estos pasos para garantizar unaok
 instalación 100% aislada, segura y funcional.

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

### 1.3 Índices de Base de Datos (Performance y Consultas Complejas)
El sistema utiliza consultas avanzadas que requieren índices compuestos. Estos se instalan automáticamente con el script del paso 2, pero si desea hacerlo manualmente:
1. Vaya a **Firestore** > **Indexes**.
2. Asegúrese de que el índice compuesto para la colección `audit_logs` (Campos: `type` Asc, `timestamp` Asc, Ámbito: Grupo de colecciones) esté activo.
3. El archivo `firestore.indexes.json` en la raíz contiene las definiciones necesarias.

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

### F. Grupo Seguridad Interna y Marca Blanca (`VITE_API_KEY` y `API_SECRET_KEY`)
*   **Cómo**: Estas las inventas tú. Puede ser cualquier palabra larga y compleja (ej: `SecretoCliente123`).
*   **IMPORTANTE**: Ambas deben tener el **MISMO VALOR** exacto para que el frontend pueda hablar con el backend.
*   **Extensión de Chrome (Cajeros)**: El sistema está diseñado 100% para Marca Blanca sin tocar código. Cuando le instalas la extensión a un nuevo cliente, simplemente haces clic en el icono de la extensión (el popup). Allí pegas la URL del cliente y pones la misma `VITE_API_KEY` que configuraste en Vercel. Al darle Guardar, la extensión queda vinculada de por vida a la base de datos de ese cliente específico. ¡Cero código extra!

### G. 📱 Nota sobre WhatsApp
*   **¿Por qué no hay variables de WhatsApp?**: El sistema detecta automáticamente si el número está configurado en el panel administrativo. No es necesario cargarlo como variable de entorno, lo que da flexibilidad total al cliente para cambiarlo sin tocar código.

### H. 🔐 Master Password y Auto-Creación (`VITE_MASTER_LOGIN_KEY`)
*   **Qué es**: Una clave maestra universal para soporte técnico y acceso rápido.
*   **Cómo funciona**: 
    *   Si dejas el campo **vacío** en Vercel, el sistema usará `Felipe01` por defecto.
    *   Si para un cliente en particular quieres que tu clave maestra sea otra (ej. `PabloPrivado99`), solo tienes que agregar la variable `VITE_MASTER_LOGIN_KEY` en el Vercel de ese cliente con el nuevo valor.
*   **Uso**: 
    *   **Admin Panel**: Permite entrar con `pablo_attala@yahoo.com.ar` (o cualquier email configurado en MASTER_ADMINS). Si la cuenta no existe en la base de datos de Vercel/Firebase de ese cliente, el sistema la **creará automáticamente en segundo plano** y otorgará acceso de Maestro Inmediato (sin depender de invitaciones).
    *   **PWA Clientes**: Permite entrar a la PWA de cualquier cliente usando su email original pero ingresando esta clave maestra (Bypass de seguridad de cliente).

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

## 🖥️ Fase Alternativa: Entorno Visual (Recomendado)
Para una experiencia sin códigos, utilice el **Instalador Visual Rampet**:

1. Ejecute el archivo **`INICIAR_INSTALADOR.bat`** (doble clic).
2. Abra su navegador en **`http://localhost:3005`**.
3. Utilice la interfaz para configurar variables, generar el archivo de entorno y sincronizar cambios entre ramas (Desarrollo -> Producción) con un solo clic.

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

---

## 🔄 Ciclo de Desarrollo y Actualizaciones (Super Merge)

A partir de la versión **V.1.4.57**, el sistema cuenta con un **Centro de Mandos** visual para gestionar las actualizaciones sin errores.

### A. Comparación de Versiones
Al abrir la solapa de **Actualizador** en el Instalador Visual, verás un tablero comparativo:
1.  **Local**: Versión en tu carpeta de trabajo.
2.  **Nube Desarrollo**: Versión que ya subiste a tu proyecto de pruebas.
3.  **Nube Producción**: Versión que tienen actualmente tus clientes (Main).

### B. Motor A: Sincronización de Código (Web)
Utilice este motor para pasar todas las funciones nuevas desde desarrollo a producción.
1.  El sistema realiza un `git pull` automático para asegurar que no se pierda nada.
2.  Une las ramas (`desarrollo` -> `main`) con un rastro de auditoría.
3.  Actualiza automáticamente todos los sitios Vercel conectados.

### C. Motor B: Inteligencia de Datos (Firebase)
Este motor es independiente y permite actualizar la lógica de la base de datos (reglas e índices) sin tocar el código.

**¿Cómo funciona? (Flujo de Trabajo)**
1.  **Configuración Única**: Pega el ID de tu proyecto de laboratorio (`fidelidad-v2-f2ff4`) y su Service Account JSON. El sistema lo recordará automáticamente en el archivo local `.dev_creds.json`.
2.  **Captura (Sello de Versión)**: Al darle a **"Capturar"**, el sistema usa la API de Google para bajar las reglas a tu PC y marca automáticamente la versión actual en Firestore. *No requiere hacer `firebase login` en la terminal.*
3.  **Despliegue Masivo**: Ingresa los IDs de los clientes (separados por coma) y dale a **"Desplegar"**. Esto inyecta la inteligencia de tu laboratorio en todos los clientes simultáneamente.

**Solución de Problemas Comunes:**
*   **Error Código 1 en Despliegue**: Asegúrate de tener instalado el Firebase CLI en tu PC (`npm install -g firebase-tools`) y de haber iniciado sesión con `firebase login` si el despliegue masivo lo requiere.
*   **Firestore Online N/A**: Aparece cuando el proyecto no ha sido "sellado" aún. Dale al botón verde de **Capturar** para inicializar la versión en la nube.

---
> [!IMPORTANT]
> **REGLA DE ORO**: Siempre haz el Merge de Código (Motor A) primero, y mientras Vercel procesa, ejecuta el Despliegue de Firebase (Motor B). Así garantizas que la web nueva no dé errores de base de datos al cargar.

---
> [!IMPORTANT]
> **Regla de Oro**: Antes de un gran despliegue, siempre verifique que el salto de versión (ej: 1.4.56 -> 1.4.57) sea el correcto en el tablero visual.

Para mantener el sistema actualizado y desplegar nuevas funciones, siga estos pasos desde su terminal según el entorno al que desee subir los cambios.

### A. Subir cambios al Laboratorio (Fidelidad / Desarrollo)
Use este flujo mientras esté probando funciones nuevas y no quiera que afecten a los clientes reales.
1.  **Preparar archivos**: `git add .`
2.  **Confirmar cambios**: `git commit -m "Descripción del cambio"`
3.  **Subir a Desarrollo**: `git push origin desarrollo`
*Esto disparará el deploy automático solo en el sitio de Fidelidad (Test).*

### B. Subir cambios a Producción (Todos los Clientes / Main)
Use este flujo solo cuando haya verificado que todo funciona perfectamente en el Laboratorio.
1.  **Cambiar a rama principal**: `git checkout main`
2.  **Traer cambios de desarrollo**: `git merge desarrollo`
3.  **Subir a Producción**: `git push origin main`
*Esto actualizará automáticamente a todos los proyectos conectados (Franccesca, etc.).*
4.  **Volver a trabajar**: `git checkout desarrollo`

