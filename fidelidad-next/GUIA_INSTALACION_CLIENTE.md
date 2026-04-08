# 🚀 Guía RAMPET: Crear un Nuevo Cliente (Modo "A prueba de tontos")

Esta es tu "Receta de Cocina" maestra. Cada vez que consigas un cliente nuevo (Ej: "La Heladería"), debes seguir estos pasos EXACTAMENTE en este orden para crearle su propia página web sin romper nada más.

> [!TIP]
> **Regla de Oro**: Tu código de GitHub (`pattala/fidelidad-next`) es el "Plano Original". Nunca creas copias de ese plano, siempre usas el mismo. ¡Solo creas nuevos Firebase y nuevos Vercel!

---

## 🍳 Paso 1: Configurar su Base de Datos (Firebase)
*Aquí creamos la carpeta segura donde se guardarán los usuarios y puntos SOLO de este cliente.*

1. Ve a [Firebase Console](https://console.firebase.google.com/) y haz clic en **"Agregar proyecto"** (o "Crear un proyecto de Firebase nuevo").
2. Escribe el nombre del local (Ej: `franccesca-martinez`) y dale a Continuar.
3. Te preguntará si quieres habilitar **Google Analytics**. 
   * *Opción Recomendada:* Apaga el interruptor azul y dale a **Crear proyecto** (terminas más rápido).
   * *Si lo dejaste prendido:* Dale a Continuar, y en la siguiente pantalla elige **"Default Account for Firebase"** en la lista desplegable, y dale a **Crear proyecto**.
4. En el menú izquierdo busca **Authentication** (suele estar bajo "Seguridad" o búscalo directamente en la barra de búsqueda superior). Haz clic en "Comenzar" (Get Started), ve a "Correo electrónico/contraseña", habilítalo y dale a Guardar.
5. En el menú izquierdo ve a **Bases de datos y almacenamiento > Firestore** y dale a "Crear base de datos".
   * **Ubicación:** Selecciona siempre `southamerica-east1` (San Pablo) o la más cercana y dale a Siguiente.
   * **Configuración:** Déjalo marcado como **"Iniciar en modo de producción"** y dale al botón azul **Crear**.
6. Vamos a configurar la seguridad profesional: Ve a la pestaña **"Rules"** (Reglas) de Firestore, borra todo y pega estas reglas (reemplazan el `if true` por algo seguro):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isSignedIn() { return request.auth != null; }
       function isAdmin() {
         return isSignedIn() && (
           (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin') ||
           request.auth.token.email.matches('.*@admin\\.com') ||
           request.auth.token.email == 'pablo_attala@yahoo.com.ar'
         );
       }
       function isEditor() {
         return isSignedIn() && (isAdmin() || (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'editor'));
       }

       match /users/{userId} {
         allow read: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
         allow list: if (request.query.limit <= 1); 
         allow create: if isSignedIn() && request.auth.uid == userId;
         allow update: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
         allow delete: if isAdmin();
       }
       match /config/{document} { allow read: if true; allow write: if isAdmin(); }
       match /prizes/{prizeId} { allow read: if true; allow write: if isEditor(); }
       match /campanas/{campaignId} { allow read: if true; allow write: if isEditor(); }
       match /admins/{adminId} { allow read: if isSignedIn(); allow write: if isAdmin(); }
       // ... (ver código fuente para la lista completa de reglas)
     }
   }
   ```

### 🔑 1.1 Obtener los datos secretos de Firebase (Para Vercel)
Antes de irte de Firebase, necesitas recolectar TRES grupos de contraseñas. ¡Abre un Bloc de notas y cópialas!

*   **A) Las Llaves Web**: Haz clic en la "Tuerca" ⚙️ arriba a la izquierda > **Configuración del proyecto** > Pestaña **General**. Desplázate hacia abajo hasta la sección "Tus apps", y haz clic en el ícono de **`</>` (Web)** para crear una "app web". Ponle cualquier nombre y regístrala. Te mostrará un código lleno de datos como `apiKey`, `authDomain`, etc. Copia todos esos valorcitos a tu bloc de notas.
*   **B) La Llave Maestra (JSON)**: Haz clic en la "Tuerca" ⚙️ arriba a la izquierda > **Configuración del proyecto** > Pestaña **Cuentas de Servicio**. Dale al botón **"Generar nueva clave privada"**. Se descargará un archivo `.json`. Si lo abres, verás un código larguísimo.
*   **C) Llave de Notificaciones (VAPID)**: Ve a "Tuerca" ⚙️ > Pestaña **Cloud Messaging**. Baja a "Web configuration" y dale a "Generate Key Pair". Copia el código público.

### 📧 1.2 Obtener la Contraseña de Correo (SMTP_PASS)
*Para que el sistema pueda enviar notificaciones de puntos a los clientes, usaremos un Gmail.*
1. Entra a la cuenta de Google (Gmail) que usará el cliente para enviar correos.
2. Ve a la **Gestión de tu Cuenta de Google > Seguridad**.
3. Asegúrate de encender la **"Verificación en 2 pasos"** (2-Step Verification). Es obligatorio.
4. Una vez encendida, usa la barra superior "Buscar en la cuenta de Google" y busca: **"Contraseñas de aplicación"** (o "App passwords").
5. Créale una con el nombre "Vercel Beneficios" y te dará **un código de 16 letras** (Ej: `abcd efgh ijkl mnop`). Esa es tu clave para Vercel. Cópiala al bloc de notas.

---

## 🏗️ Paso 2: Construir su Página Web (Vercel)
*Aquí es donde usamos tu Código Original de GitHub y le metemos las llaves de la Heladería.*

1. Entra a [Vercel](https://vercel.com/) y haz clic en el botón negro **"Add New" -> "Project"**.
2. Te mostrará tus repositorios de GitHub. Debajo de `pattala/fidelidad-next`, haz clic en **"Import"**.
3. **PROJECT NAME:** Bórra el nombre automático que te sugiere y escríbele el nombre de tu cliente en minúsculas y separado por guiones (Ej: `heladeria-los-pinos`). 
   *(💡 ¡Alerta!: Este será el link definitivo de la aplicación `https://heladeria-los-pinos.vercel.app`, ¡así que escríbelo bien!)*
4. ⚠️ **MUY IMPORTANTE - FRAMEWORK PRESET:** Asegúrate de que la caja desplegable diga **`Vite`**. (A veces por error dice 'Other'. Si no lo cambias a Vite, te dará error 404).
5. 📂 **CONFIGURACIÓN DE CARPETA (ROOT DIRECTORY):**
   - Una vez que Vercel importe el proyecto, ve a **Settings > Build & Development**.
   - Busca el campo **"Root Directory"** y asegúrate de que esté **VACÍO** (o que diga `./`). 
   - Si por defecto Vercel puso `fidelidad-next`, **bórralo**. Esto es vital para que encuentre tu código ahora que está en la raíz.
6. **¡ALTO! No le des a Deploy todavía.**
6. Haz clic donde dice **"Environment Variables"** para desplegar el menú de variables secretas. Aquí es donde conectarás el GitHub con el Firebase de la Heladería. 

### ⚙️ Agrega ESTAS 16 Variables EXACTAMENTE
**🌟 TRUCO DE MAGIA PREMIUM**: En la carpeta original del proyecto dejé un archivo llamado **`PLANTILLA_VARIABLES.txt`**. 
1. Ábrelo, te aparecerá una lista con los 16 nombres vacíos.
2. Escríbele o pégale los valores a la derecha del signo igual (sin dejar espacios).
3. Selecciona y copia TODO el texto.
4. Pareséte en Vercel en la primera caja de texto vacía bajo "Environment Variables" y dale **Pegar (Ctrl+V)**. ¡Vercel armará los 16 renglones mágicamente!

*(💡 **Nota sobre PWA_URL**: Como Vercel recién te dará el link oficial al terminar el Deploy, puedes deducirlo tú mismo sabiendo que siempre será `https://el-nombre-que-le-pusiste-al-proyecto.vercel.app`. Ponlo así en la plantilla, o modifícalo después de hacer el Deploy).*

*(Si prefieres hacerlo una por una de forma manual, aquí tienes la lista):*

#### 🏷️ El Nombre del Local
| NAME (Escríbelo exacto) | VALUE (El Valor) | Ejemplo |
| :--- | :--- | :--- |
| `VITE_APP_NAME` | El nombre largo que irá en la pestaña de internet. | `Heladería Los Pinos` |
| `VITE_APP_SHORT_NAME` | Nombre cortito para el ícono en el celular. | `Los Pinos` |

#### 🔒 Claves del Sistema y Mails
| NAME | VALUE | Ejemplo |
| :--- | :--- | :--- |
| `VITE_API_KEY` | Invéntate una contraseña cualquiera (es para seguridad interna). | `helado_seguro_123` |
| `API_SECRET_KEY` | Escribe aquí **exactamente** la misma contraseña de arriba. | `helado_seguro_123` |
| `SMTP_USER` | Tu cuenta de Gmail o la del cliente (para enviar alertas). | `info@lospinos.com` |
| `SMTP_PASS` | La "Contraseña de Aplicación" de ese Gmail (Código de 16 letras, no tu password normal). | `abcd efgh ijkl mnop` |

#### 🔥 Las Llaves Web de Firebase (Las sacaste del Bloc de Notas Paso 1.1 - A)
| NAME | VALUE |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | El valor que decía `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | El valor que decía `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | El valor que decía `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET`| El valor que decía `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| El valor que decía `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | El valor que decía `appId` |
| `VITE_FIREBASE_MEASUREMENT_ID` | El valor que decía `measurementId` (A veces no viene, pon 'null' si no está) |

#### ⚠️ Los Permisos Especiales (Los sacaste del Paso 1.1 - B y C)
| NAME | VALUE |
| :--- | :--- |
| `VITE_VAPID_PUBLIC_KEY` | El código de Cloud messaging (El del Paso 1.1 - C) |
| `GOOGLE_CREDENTIALS_JSON` | **CRÍTICO:** Abre el archivo .json que descargaste, copia TODO el texto gigante, desde la primera `{` hasta la última `}` y pégalo aquí crudo. |
| `PWA_URL` | La dirección web que Vercel le va a dar a la app (Puedes editar esto después de hacer deploy). |

6. Una vez agregadas todas, haz clic en el botón grande y azul **"Deploy"**. En 2 minutos se creará la página.

---

## ⏰ Paso 3: El Despertador Automático (QStash)
*Para que los puntos de LA HELADERÍA se venzan todos los días aunque no abras la app.*

1. Ve a [Upstash QStash](https://console.upstash.com/qstash).
2. **Una sola cuenta para todos**: Pablo, puedes usar la misma cuenta de Upstash para todos tus clientes (Franccesca, La Heladería, etc.). Simplemente crearás un "Schedule" (Tarea) diferente para cada uno.
3. Ve a la pestaña **Schedules** > **"Create Schedule"** (Tarea Programada).
4. **URL**: Tomas la URL de tu página Vercel y le sumas la ruta de la API al final.
   - *Ejemplo para Franccesca:* `https://franccesca-martinez.vercel.app/api/engine-daily?mode=daily&trigger=qstash`
   - *Ejemplo para Fidelidad:* `https://fidelidad-next.vercel.app/api/engine-daily?mode=daily&trigger=qstash`
5. **Schedule**: Escribe `0 * * * *` (Significa que se ejecuta **cada 1 hora**, y el sistema internamente en su panel de control decide según el horario en qué momento enviar los WhatsApps usando ese pulso).
6. **Headers (Importantísimo)**:
   - Haz clic en **"Add Header"**.
   - Nombre: `x-api-key`
   - Valor: Lo que hayas puesto en `VITE_API_KEY` para ese cliente específico (Ej: `franccesca2024`).
7. **Dale a "Create"**. ¡Listo! Ese cliente ya tiene su despertador automático activo.

---

## 👑 Paso 4: Hacerte Dueño (Primer Ingreso)
*Por defecto todos son usuarios normales. Debes darte poder admin en el nuevo Firebase.*

1. Entra a la nueva página de la Heladería (la URL que te dio Vercel).
2. ¡Felicidades! Dirá "Heladería Los Pinos". **Regístrate con tu correo normal.**
3. Ve a tu Firebase Console > Base de Datos Firestore.
4. En la columna "users", busca tu correo y mira qué **ID de Documento** (serie de letras al azar) te asignó. Cópialo.
5. Ahí mismo, haz "Iniciar Colección" y ponle de nombre **`admins`**.
6. Como nombre del Documento, pega la serie de letras (ID) tuya.
7. Agrega un campo nuevo (`Field`), escribe `role`, selecciona tipo `string`, y en valor escribe `admin`.
8. Vuelve a la página de la Heladería y actualízala: ¡Aparecerá la corona dorada de Admin!

**¡Terminaste! El sistema del cliente es 100% independiente de tu Laboratorio y de tus otros clientes.**

---

## 🛠️ Resolución de problemas comunes

### 1. El Panel de Control se recarga infinitamente
Esto ha sido corregido en la versión actual del código. Asegúrate de estar usando la última versión de la rama principal (`main`). Si persiste, limpia el caché del navegador.

### 2. La pantalla se pone oscura/gris y no deja hacer nada
Esto sucedía por un bloqueo en el sistema de permisos de notificaciones del navegador. He añadido protecciones para que, si el navegador no permite o no soporta notificaciones, el sistema simplemente continúe sin bloquear la interfaz.

### 3. El botón de WhatsApp no abre nada
Los navegadores modernos bloquean los "popups" (ventanas emergentes). El sistema ahora usa un método de "clic simulado" que es mucho más robusto. Si aún falla, revisa que el cliente tenga un número de teléfono válido cargado.

### 4. No puedo crear campañas (Error de permisos)
Esto ocurre si no has pegado las **Reglas de Firestore** (Paso 1, punto 6) o si el usuario no tiene el rol `admin` o `editor` en el nuevo Firebase (Paso 4).

> [!IMPORTANT]
> **¿Debo copiar las reglas siempre?** Sí, en cada proyecto de Firebase que crees, copia y pega el bloque completo de reglas del Paso 1.6 de esta guía. Son las mismas para todos los clientes ya que el sistema detecta automáticamente a los administradores basados en la colección `admins` de cada base de datos.

### 5. ¿Cómo entrar al panel si no me deja con mi clave?
Si el acceso falla, revisa el Paso 4. Asegúrate que en la colección `admins` del Firestore, el **ID del documento** sea exactamente igual al ID de usuario que te asignó Firebase al registrarte.

---

## 📈 Estrategia de Ramas (Mantenimiento Seguro)

Para evitar que los experimentos en el **Laboratorio** rompan las páginas de tus clientes en producción, usamos este sistema de "doble filtro":

### 🏰 Rama `main` (Producción)
Esta es la versión estable. **Todos los clientes reales** (como Franccesca Martinez) deben estar conectados a esta rama en Vercel. 
- *Solo se toca cuando estamos 100% seguros de que los cambios funcionan.*

### 🧪 Rama `desarrollo` (Laboratorio)
Esta es tu mesa de trabajo. **Tu proyecto de Laboratorio** (el tuyo personal) debe estar conectado a esta rama en Vercel.
- *Aquí es donde hacemos pruebas, cambiamos el diseño y arreglamos errores.*

### 🔄 Cómo pasar cambios del Laboratorio a los Clientes
Cuando termines de probar algo en el Laboratorio y quieras que llegue a todos tus clientes:
1. Pídeme: *"Pasa los cambios de desarrollo a la rama main"*.
2. Yo haré un **Merge**, y en ese instante Vercel detectará el cambio en `main` y actualizará automáticamente todos los sitios de tus clientes. 

> [!TIP]
> De esta forma, puedes "romper" y arreglar cosas en tu entorno de desarrollo sin miedo a que tus clientes vean errores en vivo.

---

## 🧩 Extensión de Chrome

La extensión es la misma para todos los clientes (un único archivo `.zip` o carpeta). Lo que cambia es la configuración interna:

1. Al instalarla, haz clic en el icono de la extensión.
2. Ingresa los datos específicos del cliente:
   - **App Name**: El nombre del negocio.
   - **API URL**: La URL de Vercel de ese cliente (ej: `https://franccesca.vercel.app`).
   - **API Key**: El valor de `VITE_API_KEY` que configuraste para ese cliente.
3. Haz clic en **Guardar**.
