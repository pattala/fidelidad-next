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
6. Vamos a "Engañar" a la seguridad por ahora para poder probar: Ve a la pestaña **"Rules"** (Reglas) de Firestore y pon todo en `true` así:
   ```javascript
   rules_version = '2';
   service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }
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
3. Ponle nombre al proyecto (Ej: `app-heladeria`).
4. ⚠️ **MUY IMPORTANTE - FRAMEWORK PRESET:** Asegúrate de que la caja desplegable diga **`Vite`**. (A veces por error dice 'Other'. Si no lo cambias a Vite, te dará error 404).
5. **¡ALTO! No le des a Deploy todavía.**
6. Haz clic donde dice **"Environment Variables"** para desplegar el menú de variables secretas. Aquí es donde conectarás el GitHub con el Firebase de la Heladería. 

### ⚙️ Agrega ESTAS 16 Variables EXACTAMENTE
**🌟 TRUCO DE MAGIA PREMIUM**: En la carpeta original del proyecto dejé un archivo llamado **`PLANTILLA_VARIABLES.txt`**. 
1. Ábrelo, te aparecerá una lista con los 16 nombres vacíos.
2. Escríbele o pégale los valores a la derecha del signo igual (sin dejar espacios).
3. Selecciona y copia TODO el texto.
4. Pareséte en Vercel en la primera caja de texto vacía bajo "Environment Variables" y dale **Pegar (Ctrl+V)**. ¡Vercel armará los 16 renglones mágicamente!

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
2. Ve a la pestaña **Schedules** > **"Create Schedule"** (Tarea Programada).
3. **URL**: Tomas la URL de tu página Vercel y le sumas la ruta de la API al final.
   - *Ejemplo:* `https://franccesca-martinez.vercel.app/api/engine-daily?mode=daily&trigger=qstash`
4. **Schedule**: Escribe `0 * * * *` (Significa que se ejecuta **cada 1 hora**, y el sistema internamente en su panel de control decide según el horario en qué momento enviar los WhatsApps usando ese pulso).
5. **Headers**:
   - Nombre: `x-api-key`
   - Valor: Lo que hayas puesto en `VITE_API_KEY` (Ej: `helado_seguro_123`).

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
