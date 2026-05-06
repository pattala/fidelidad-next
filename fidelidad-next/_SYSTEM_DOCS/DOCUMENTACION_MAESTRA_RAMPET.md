# 💎 DOCUMENTACIÓN MAESTRA RAMPET (V.1.4.6)

> Este documento consolida toda la inteligencia técnica y operativa del sistema.

---



--- SECTION: REGLAS_DESARROLLO.md ---

# Reglas de Desarrollo - Proyecto Club Fidelidad

Este documento contiene las pautas obligatorias para el desarrollo y mantenimiento del proyecto.

## 1. Flujo de Git y Ramas
- **Rama de Trabajo**: Solo se deben realizar y subir (push) cambios a la rama `desarrollo`.
- **Rama Main**: Está estrictamente prohibido subir cambios directamente a `main` o mergear `desarrollo` a `main` sin autorización expresa previa del usuario después de verificar que la versión en desarrollo es estable.

## 2. Protocolo de Cambios
- **Explicación Previa**: Antes de realizar cualquier modificación en el código, el asistente debe explicar detalladamente qué se va a cambiar y por qué.
- **Autorización**: No se deben aplicar cambios hasta recibir el permiso explícito ("OK", "proceder", etc.), a menos que el usuario indique específicamente que se pueden realizar los cambios "de una" para una tarea concreta.
- **Propuestas**: Siempre se debe priorizar la propuesta de soluciones antes de la ejecución.

## 3. Filosofía de Desarrollo ("No Innovar")
- **Mantener la Estabilidad**: Se debe evitar "innovar" o agregar funcionalidades no solicitadas que puedan alterar el comportamiento actual del sistema sin previo aviso.
- **Proponer antes que Ejecutar**: Si se detecta una mejora potencial o una nueva tecnología, se debe **proponer** primero. No se debe implementar nada nuevo que no haya sido solicitado o validado.

## 4. Documentación y Estilo
- **Comentarios**: Mantener los comentarios existentes en el código.
## 5. Gestión de Versiones
- **Incremento Obligatorio**: Con cada subida (push) que incluya mejoras o correcciones, se DEBE incrementar el número de versión (V.X.X.X).
- **Visibilidad**: El número de versión debe actualizarse en todas las etiquetas visuales de la interfaz (Sidebar, Header, etc.) para que el usuario pueda verificar que está viendo la última versión desplegada. Siempre debe ser visible para el usuario.




--- SECTION: GUIA_INSTALACION_RAMPET_MASTER.md ---

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

### F. Grupo Seguridad Interna (`VITE_API_KEY` y `API_SECRET_KEY`)
*   **Cómo**: Estas las inventas tú. Puede ser cualquier palabra larga y compleja (ej: `rampet_security_3344_x`).
*   **IMPORTANTE**: Ambas deben tener el **MISMO VALOR** exacto para que el frontend pueda hablar con el backend.

### G. 📱 Nota sobre WhatsApp
*   **¿Por qué no hay variables de WhatsApp?**: El sistema detecta automáticamente si el número está configurado en el panel administrativo. No es necesario cargarlo como variable de entorno, lo que da flexibilidad total al cliente para cambiarlo sin tocar código.

### H. 🔐 Master Password (`VITE_MASTER_LOGIN_KEY`)
*   **Qué es**: Una clave maestra universal para soporte técnico.
*   **Cómo funciona**: 
    *   Si dejas el campo **vacío** en Vercel, el sistema usará `Felipe01` por defecto.
    *   Si quieres una clave personalizada, agrégala en Vercel con el nombre `VITE_MASTER_LOGIN_KEY`.
*   **Uso**: Permite entrar al Admin Panel con `pablo_attala@yahoo.com.ar` y a cualquier PWA de cliente usando su email + esta clave.

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

## 🔄 Ciclo de Desarrollo y Actualizaciones (Git Workflow)

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





--- SECTION: MANUAL_DE_USO.md ---

# 📘 Manual Operativo Integral - Sistema de Fidelización

Este documento es la guía definitiva para la operación, configuración y estrategia del sistema de fidelización.

---

## 📑 Índice de Contenidos

1. [Introducción al Ecosistema](#1-introducción-al-ecosistema)
2. [Estrategia Financiera: El Valor del Punto](#2-estrategia-financiera-el-valor-del-punto)
3. [Operación Diaria: Gestión de Clientes](#3-operación-diaria-gestión-de-clientes)
4. [Masterclass de Campañas y Promociones](#4-masterclass-de-campañas-y-promociones)
5. [Mensajería y Enlaces Externos](#5-mensajería-y-enlaces-externos)
6. [Solución de Problemas](#6-solución-de-problemas)
7. [Gestión de Roles y Permisos](#7-gestión-de-roles-y-permisos)
8. [Mantenimiento Avanzado: Reset Maestro](#8-mantenimiento-avanzado-reset-maestro)
9. [Anexo: Automatización con la Extensión](#9-anexo-automatización-con-la-extensión)
10. [Guía de Migración: Cambio de URL y Dominio](#10-guía-de-migración-cambio-de-url-y-dominio)
11. [Motor de Notificaciones y Auditoría](#11-motor-de-notificaciones-y-auditoría)
12. [Estrategia de Métricas Avanzadas (Insights)](#12-estrategia-de-métricas-avanzadas-insights)
13. [Actualizaciones y Mantenimiento Visual](#13-actualizaciones-y-mantenimiento-visual)

---

## 1. 🌐 Introducción al Ecosistema

El sistema se compone de dos partes vivas:
1.  **Panel de Administración (Usted):** Donde configura las reglas, carga puntos y controla el dinero.
2.  **App de Clientes (PWA):** Lo que ven sus usuarios en el celular. Allí consultan saldo, ven el catálogo y reciben notificaciones.

---

## 2. 💰 Estrategia Financiera: El Valor del Punto

Esta es la configuración más crítica del sistema, ubicada en **Configuración > Valor del Punto**. Determina si su programa es rentable o si está perdiendo dinero.

### ¿Manual o Automático?
El sistema ofrece dos formas de calcular cuánto "vale" realmente un punto y, por ende, cuánto dinero debe "reservar" usted para pagar los canjes futuros (El Pasivo/Deuda).

#### A. Método Manual (Recomendado para empezar)
Usted define arbitrariamente cuánto vale el punto.
*   **Ejemplo:** Configura que **$1000 pesos de venta = 1 punto**.
*   **Ventaja:** Es predecible. Usted sabe que dar 1 punto le "cuesta" un porcentaje fijo de su venta.
*   **Uso:** Ideal si sus precios de productos son estables.

#### B. Método Promedio (Avanzado / Protección de Márgenes)
El sistema calcula el valor del punto basándose en **el costo real de sus premios actuales**.
*   **Fórmula:** `Costo del Premio / Puntos Requeridos = Valor Real del Punto`.
    *   *Ejemplo:* Si una "Cafetera" le cuesta a usted `$50.000` y pide `5000 puntos` por ella, cada punto vale `$10`.

*   **Ventaja:** Si la inflación sube el costo de los premios, el sistema le avisará que su "deuda" en puntos ha aumentado.
*   **El Semáforo del Dashboard:**
    *   Si configura Manual, el Dashboard comparará ambos valores.
    *   🟢 **Verde (Cobertura OK):** Si usted cobra el punto más caro de lo que le cuesta el premio. (Está ganando margen).
    *   🔴 **Naranja (Desfasaje):** Si el premio es más caro que lo que usted está "ahorrando" por punto. **Alerta:** Debe subir la cantidad de puntos requeridos para el canje o cambiar el premio.

---

## 3. 👥 Operación Diaria: Gestión de Clientes

### Paso a Paso: Alta de Cliente
1.  Botón **"+ Nuevo Cliente"**.
2.  **Teléfono:** Fundamental ingresarlo con formato internacional o local completo (ej. 11...), ya que este número alimenta el link de WhatsApp.
3.  **DNI:** Actúa como llave única para que no se dupliquen personas.

### Paso a Paso: Carga de Puntos y Lógica
Aquí ocurre la magia de la fidelización.
1.  Localice al cliente y presione **Asignar Puntos** (Icono Moneda).
2.  **Fecha de Compra:**
    *   Si deja "Hoy", el sistema grabará la **hora exacta actual**. Esto es vital para que el historial cronológico sea coherente.
    *   Si elige una fecha pasada, se grabará a las 12:00 del mediodía de esa fecha.
3.  **Monto ($):** Ingrese cuánto gastó el cliente (ej. $25.000).
4.  **Lógica Interna:**
    *   El sistema divide `Monto / Valor del Punto`. (ej. 25.000 / 100 = 250 puntos).
    *   Luego consulta si hay **Campañas Activas** (ver sección 4) y suma los bonos automáticamente.
    *   Finalmente calcula el **Vencimiento** según las reglas escalonadas (ej. "Si suma más de 5000, vencen en 1 año, sino en 3 meses").

### Paso a Paso: Canje de Premios (FIFO)
El cliente quiere usar sus puntos.
1.  Botón **Canjear** (Icono Regalo).
2.  Seleccione el premio. Si el stock está en 0, el sistema bloqueará el canje.
3.  **Lógica FIFO (First-In, First-Out):**
    *   El sistema NO descuenta puntos del total genérico.
    *   Busca las cargas de puntos más viejas del cliente que aún tengan saldo.
    *   Descuenta de esas cargas específicas.
    *   **¿Por qué?** Para beneficiar al cliente consumiendo primero los puntos que están más cerca de vencerse.
    *   En el historial verá: *"Se usaron 100 puntos (50 del día 1/1 y 50 del día 5/1)".*

---

## 4. 🚀 Masterclass de Campañas y Promociones

Las campañas son reglas automáticas que se activan según el día o la fecha. No necesita activarlas manualmente cada vez.
Vaya a **Campañas > Nueva Campaña**.

### Tipo 1: Multiplicadores (X)
*   **Objetivo:** Incentivar compras en días flojos.
*   **Configuración:**
    *   *Tipo:* "Multiplicador".
    *   *Valor:* "2" (para Doble), "3" (para Triple).
    *   *Días:* Seleccione "Martes".
*   **Resultado:** Si un cliente gasta $100 (1 punto base), el sistema le dará automáticamente **2 puntos**.
*   **Mensaje al Cliente:** En la PWA verá "¡Puntos Dobles Hoy!".

### Tipo 2: Bonos Fijos (+)
*   **Objetivo:** Premiar la visita, sin importar el gasto.
*   **Configuración:**
    *   *Tipo:* "Fijo".
    *   *Valor:* "50".
    *   *Días:* "Sábado".
*   **Resultado:** Cualquier compra ese día suma sus puntos normales **MÁS 50 puntos de regalo**. Ideal para eventos o cumpleaños del negocio.

---

## 5. 💬 Mensajería y Enlaces Externos

El sistema no envía los WhatsApps por sí mismo (para evitar bloqueos de Meta/Facebook), sino que genera **Enlaces Inteligentes**.

### Cómo funciona el motor de WhatsApp
1.  Usted configura una "Plantilla" en Configuración (ej. "Hola {nombre}, sumaste {puntos}!").
2.  Cuando carga puntos, el sistema detecta si está en PC o Celular.
3.  Abre automáticamente `api.whatsapp.com/send...` con el mensaje ya escrito y el número del cliente precargado.
4.  Usted solo presiona "Enviar" en su WhatsApp.

**Tip Pro:** En esos mensajes puede incluir el link a su PWA (`su-negocio.app`) para que el cliente entre a ver su saldo inmediatamente.

---

## 6. 🛠️ Solución de Problemas

### 1. "Borré un canje pero el saldo no coincide"
El sistema está diseñado para recalcular todo. Si elimina un movimiento del historial (con el tacho de basura rojo), el sistema hace la operación inversa automáticamente (si borra un canje, le devuelve los puntos al cliente; si borra una carga, se los quita).

### 2. "Tengo datos basura o pruebas viejas"
En el modal de historial, abajo a la izquierda, use el botón rojo **"Resetear Todo"**.
*   **Cuidado:** Esto borra ABSOLUTAMENTE TODO el historial de ese cliente y pone su saldo en 0. Úselo solo para limpiar datos de prueba o errores graves de contabilidad.

### 3. "La PWA no muestra los canjes"
Asegúrese de que el cliente tiene conexión a internet y ha actualizado la página. Los canjes aparecen en rojo con el signo negativo (-).

---

## 7. 🔐 Gestión de Roles y Permisos

El sistema cuenta con un esquema de seguridad basado en roles para asegurar que cada miembro del equipo acceda solo a lo que necesita para su función.

### Jerarquía de Roles

#### A. Administrador (admin)
Es el nivel más alto de acceso. Recomendado solo para dueños o gerentes generales.
*   **Permisos Especiales:**
    *   Gestión de Configuración (Valor del punto, expiración, branding).
    *   Gestión de Equipo (Invitar/eliminar otros administradores).
    *   Uso del Simulador de Fecha para pruebas de vencimiento.

#### B. Operador (editor)
Ideal para encargados de local o personal administrativo.
*   **Permisos:** Gestión de Clientes, Premios, Campañas y Notificaciones.
*   **Restricciones:** No puede entrar a "Configuración" ni gestionar otros usuarios.

#### C. Solo Ver (viewer)
Ideal para auditorías o pasivistas que necesitan consultar datos sin modificarlos.
*   **Permisos:** Puede navegar por todas las pantallas (excepto configuración).
*   **Restricciones:** No puede realizar ninguna acción que altere la base de datos (Guardar, Eliminar, Nuevo).

---

## 8. 🔴 Mantenimiento Avanzado: Reset Maestro

Ubicado en **Configuración > Avanzado**, el Reset Maestro es una herramienta de "limpieza profunda".

*   **SOCIOS TOTAL**: ⚠️ **Eliminación Definitiva.** Borra todos los clientes y sus cuentas.
*   **SOCIOS HISTORIAL**: **Limpieza de Saldos.** Mantiene a los clientes pero vacía sus puntos.
*   **AUDIT TOTAL**: Borra el libro de auditoría de acciones del personal.

> [!CAUTION]
> **Estas acciones son irreversibles.** Requiere escribir `RESET` para confirmar.

---

## 9. 🤖 Anexo: Automatización con la Extensión

La extensión de Chrome automatiza la captura del total y la resta de descuentos en sistemas como **Sky Facturación**.

### Lógica de Detección de Descuentos
La extensión busca las palabras **DESCUENTO, PROMO, COMBO, BONIF** en la descripción de cada fila para identificar descuentos y restarlos del total base de puntos.

---

## 10. 🌐 Guía de Migración: Cambio de URL y Dominio

1.  **Firebase:** Autorizar el nuevo dominio en *Authentication > Settings*.
2.  **Vercel:** Agregar el nuevo dominio en la pestaña *Domains*.
3.  **Configuración:** Actualizar la "URL de la App" en el panel de administración.

---

## 11. ⏱️ Motor de Notificaciones y Auditoría

El sistema registra de forma minuciosa y estricta todas las acciones automáticas y manuales en la pantalla **Auditoría**.

### Gatillos de Ejecución y Origen
En la columna de cada registro verá exactamente quién disparó el proceso:
*   **`Sistema (QStash)`**: Procesos disparados automáticamente de madrugada o por eventos del reloj interno.
*   **`Ejecución Manual (Admin)`**: Ejecución forzada al presionar botones en el tablero por un administrador.
*   **`[Nombre del Admin]`**: Ediciones específicas a la base de datos (premios, configuración, carga manual de puntos).
*   **`Ejecución (Extensión)`**: Acciones originadas desde la extensión de Chrome.

### Diccionario de Mensajes de Auditoría

A continuación, se listan todos los mensajes de estado y qué significan:

#### 1. Casos con Novedades (Procesamiento Activo)
| Proceso (Tipo) | Título Principal | Detalle Desplegable |
| :--- | :--- | :--- |
| **Vencimientos** | `Revisión finalizada: 2 procesados, 230 pts restados.` | Nombre del socio, cantidad restada y canales notificados (Inbox/Push/Email). |
| **Cumpleaños** | `Proceso de Cumpleaños: 1 socio detectado hoy.` | Nombre del cumpleañero y adjudicación asignada. |
| **Alertas PetShop** | `Alertas PetShop: 1 aviso enviado hoy.` | Nombre del socio, mascota y alimento correspondiente. |
| **Campañas** | `Difusión automática: Promo 2x1` | Cantidad total de socios alertados por Push/Email. |

#### 2. Días sin Novedades (Casos en Cero)
Cuando el sistema escanea y no encuentra acciones necesarias, no da error, sino que deja estos marcadores explícitos:
| Proceso (Tipo) | Título Principal | Detalle Desplegable |
| :--- | :--- | :--- |
| **Vencimientos** | `Revisión ejecutada: 0 registros para procesar hoy.` | ⚙️ PROCESO DE SISTEMA: Todo al día. No se requirieron acciones. |
| **Cumpleaños** | `Revisión ejecutada: 0 cumpleañeros detectados hoy.` | ⚙️ PROCESO DE SISTEMA: Ningún socio cumple años en la fecha. |
| **Alertas PetShop**| `Alertas PetShop: 0 avisos necesarios hoy.` | ⚙️ PROCESO DE SISTEMA: No se encontraron alertas pendientes de envío hoy. |

#### 3. Auditoría de Mantenimiento Manual
| Acción | Título de Ejemplo |
| :--- | :--- |
| **Crear Premio** | `Premio creado: "Voucher 15% OFF"` |
| **Canjear** | `Canje de Premio para María García` |
| **Regalar Puntos**| `Carga Manual a María García` |

### 🚨 Botones de Ejecución Manual
En la sección de Auditoría, existen botones para disparar procesos manualmente que son fundamentales (sobre todo si usa el Simulador de Fechas):

*   **Botón Rosa (Cumpleaños):** Fuerza la lectura manual de los cumplen hoy, reparte premios y archiva la notificación.  
*   **Botón Naranja (Vencimientos):** Fuerza la revisión de los vencimientos diarios calculados, resta los puntos maduros y archiva la notificación preventiva.

> [!TIP]
> Si dispara los motores **manualmente** desde la pestaña de Auditoría, el sistema pasará por alto los controles estándar de reloj y operará inmediatamente según la fecha que tenga seteada en el simulador.

### 🛡️ Muro de Contención: Control de Duplicidad

El sistema posee un mecanismo estricto para evitar que los procesos envíen correos, mensajes o resten puntos múltiples veces en un mismo día por error de sistema o doble click. Existen dos lugares donde usted interactúa con esta barrera:

1. **En la Configuración General (Panel > Ajustes):** Aquí encuentra el control **Maestro**. Si está activado (Verde), el motor automático de QStash (el que se dispara a la madrugada) está bloqueado por el "Muro". Esto garantiza que si el robot se despierta dos veces el mismo día, la segunda vez rebote pacíficamente.
2. **En la Pantalla de Auditoría (El Switch de Duplicidad):** Este botón rojo/verde **es exactamente la misma variable** que el anterior, pero puesto aquí para su comodidad. Al disparar pruebas manuales, lo usará de la siguiente forma:
   - **Verde (Seguro):** Protegerá las acciones manuales. Si usted aprieta el botón Rosa (Cumpleaños) dos veces seguidas, la segunda fallará discretamente.
   - **Rojo (Ignorarla temporalmente):** Suaviza el escudo temporalmente y le permite a usted (como administrador) presionar los motores múltiples veces en el mismo día. Esto es exclusivo y obligatorio cuando usa el **Simulador de Fechas** y necesita viajar en el tiempo simulando múltiples cierres de mes en una sola tarde de trabajo.

### 🌐 11.b El Simulador Integral (V.1.4.5)

A partir de la versión **1.4.5**, el simulador de fecha ya no es solo visual, sino **Integral**. Esto significa que afecta a:
*   **Métricas y Gráficos:** Los filtros de "Últimos 30 días" y "Hoy" se desplazan con tu fecha simulada. Si viajas al futuro, verás cómo se proyectan los datos.
*   **Canjes y FIFO:** El sistema valida la vigencia de los premios y la caducidad de los puntos basándose en tu fecha simulada.
*   **Escudo de Duplicidad:** El bloqueo de "Ya se ejecutó hoy" ahora entiende tu fecha simulada. Puedes correr el motor para "Mañana" y luego para "Pasado Mañana" en la misma sesión sin que el sistema te bloquee.
*   **Historial y Auditoría:** Todos los registros (carga de puntos, canjes, logs) se graban con la marca de tiempo de tu simulación para mantener la coherencia del historial.

---

## 12. 🚀 Optimización y Performance

Para mantener la PWA rápida y ágil en todos los dispositivos móviles, se recomienda seguir estos estándares al cargar contenido:

### 🖼️ Estándar de Imágenes
*   **Formato:** Utilizar preferentemente **WebP** para fotografías y **SVG** para logos o iconos. El formato WebP reduce el peso hasta un 70% comparado con el JPG tradicional.
*   **Peso Máximo Sugerido:** 
    *   **Logos e Iconos:** < 40KB
    *   **Premios y Promociones:** < 100KB
    *   **Banners Principales:** < 200KB
*   **Dimensiones:** No es necesario cargar imágenes de más de 1200px de ancho. Los celulares optimizan mejor archivos pequeños.

### ⏱️ Carga Diferida (Lazy Loading)
El sistema ha sido optimizado con **Carga Inteligente**. Esto significa que el código pesado de administración (gráficos, métricas, reportes) no es descargado por los celulares de tus socios. Solo vos, cuando entres como Administrador, descargarás esos componentes adicionales.

---

## 13. 🚀 Actualizaciones y Mantenimiento Visual (Rampet Installer)

Para facilitar el mantenimiento sin necesidad de conocimientos técnicos avanzados en Git, el sistema incluye un **Entorno Visual de Gestión**.

### Cómo iniciar
1. Localice el archivo **`INICIAR_INSTALADOR.bat`** en la carpeta raíz.
2. Ejecútelo y navegue a **`http://localhost:3005`**.

### Funciones Principales
*   **Sincronizar Código:** Pasa los cambios probados en el Laboratorio (desarrollo) al sitio oficial (main) de forma segura.
*   **Editor de Variables:** Permite cambiar nombres, claves de API y configuraciones de Firebase desde un formulario visual.
*   **Despliegue Maestro:** Ejecuta el proceso de instalación completo hacia Vercel y Firebase.

---

## 12. 📊 Estrategia de Métricas Avanzadas (Insights)

El sistema no solo cuenta puntos, sino que analiza la salud de tu negocio a través de 4 pilares estratégicos diseñados para la toma de decisiones:

### A. Ticket Promedio y Comparativa de Eficiencia
*   **Qué mide:** El gasto medio por cliente en cada compra.
*   **Análisis Estratégico:** El sistema compara el ticket actual contra el histórico. 
    *   **Ticket Sube:** Tu estrategia de "Upselling" (vender productos más caros o packs ahorro) está funcionando.
    *   **Ticket Baja pero la Gente Sube:** Estás masificando la base. Es una estrategia de volumen, pero ten cuidado con no saturar la operación por tickets muy pequeños.

### B. Relación Tráfico vs. Ingresos (Gente vs. Dinero)
*   **Vista Tráfico:** Cuántas transacciones reales hubo (registros con gasto mayor a $0).
*   **Vista Dinero:** Cuánto volumen de pesos ingresó al negocio.
*   **Para qué sirve:** Para detectar las **"Horas Pico de Valor"**. A veces tienes menos gente a las 14:00hs pero gastan el triple que los que vienen a las 10:00hs. Esto te ayuda a decidir horarios de personal o promociones flash.

### C. Índice de Salud de la Base (Retención)
*   **Inscripciones:** Clientes nuevos que se sumaron al club este mes.
*   **Dormidos:** Clientes que no registran compras hace más de 60/90 días.
*   **Meta:** Tu tasa de "Nuevos" siempre debe ser mayor a la de "Dormidos" para que el negocio sea sano y esté en crecimiento constante.

### D. Pasivo Contingente y Vencimientos
*   **Qué mide:** Cuánto dinero "le debes" a tus clientes en premios si todos vinieran a canjear hoy. Es tu deuda técnica en fidelización.
*   **Proyección de Vencimientos:** El Dashboard te avisará cuántos puntos están por expirar en los próximos 30 días.
*   **Acción Recomendada:** Si ves una ola de vencimientos próxima, es el momento ideal para lanzar una campaña: *"¡Tus puntos vencen pronto! Ven a canjearlos hoy"*. Esto genera tráfico inmediato al local sin costo de publicidad.

---





--- SECTION: RAMPET_SOPORTE_TECNICO_MASTER.md ---

# 💎 RAMPET: Manual Técnico y Operativo Maestro

Este documento es el **Cerebro Central** del sistema RAMPET. Aquí se consolida toda la información necesaria para instalar, operar, mantener y escalar la plataforma de fidelización.

---

## 🏗️ 1. Arquitectura y Stack Tecnológico
RAMPET es un ecosistema moderno desacoplado:
- **Frontend**: React 18 + Vite + Tailwind CSS (PWA Responsiva).
- **Backend (Serverless)**: Vercel Functions (Node.js).
- **Base de Datos**: Google Firebase Firestore (NoSQL).
- **Autenticación**: Firebase Auth.
- **Notificaciones**: Firebase Cloud Messaging (FCM) + Nodemailer (Gmail).
- **Automatización**: Upstash QStash (Cron Jobs) + Motor interno `engine-daily`.

---

## 🛠️ 2. Guía Maestra de Instalación
Siga estos pasos para desplegar una nueva instancia (ej. un nuevo cliente).

### 2.1 Preparación de Credenciales
Debe obtener las siguientes llaves (ver `GUIA_INSTALACION_RAMPET_MASTER.md` para detalles):
1. **Firebase Config**: (API Key, Auth Domain, etc.)
2. **Admin SDK**: Archivo JSON de la cuenta de servicio (Google Credentials).
3. **VAPID Keys**: Para notificaciones Push.
4. **SMTP**: Usuario y Contraseña de Aplicación de Gmail.
5. **API Secret**: Una clave inventada para seguridad Backend-Frontend.

### 2.2 Despliegue Automatizado
1. Complete el archivo `PLANTILLA_VARIABLES.txt` con los datos obtenidos.
2. Ejecute el script de automatización:
   ```bash
   node scripts/bootstrap-client.js
   ```
   *Este script inyectará las ~30 variables en Vercel y preparará el proyecto.*

---

## 🐾 3. Módulo Petshop (Opcional)
Implementado para permitir una gestión especializada de mascotas y alimento.

### 3.1 Activación
- **Vía Código**: Variable de entorno `VITE_ENABLE_PET_MODULE=true`.
- **Vía Panel Admin**: Configuración > Pestaña **Avanzado** > Toggle **Módulo Petshop**.

### 3.2 Funcionalidades
- **Ficha de Mascotas**: Los clientes pueden registrar nombre, raza, edad y marca de alimento desde su perfil.
- **Visualización Admin**: En **Clientes**, el administrador ve iconos de 🐾 indicando las mascotas de cada socio.
- **Alertas de Alimento (Automatizadas)**:
  - **Lógica**: Se calcula según la `frecuencia` y la `última compra`.
  - **Acción Admin**: Al sumar puntos, el administrador puede marcar el check "Reposición de Alimento" para resetear el cronómetro.
  - **Envío**: El motor diario envía un mensaje (Push/Email) el día que se estima que el alimento se termina.

---

## 💰 4. Gestión Financiera y Puntos
RAMPET no solo suma números, gestiona una **deuda técnica (Pasivo)**.

### 4.1 Valor del Punto
- **Manual**: Usted define cuántos pesos es 1 punto.
- **Promedio**: El sistema calcula el valor real según el costo de sus premios.
- **Semáforo Dashboard**: 🟢 Indica ganancia. 🔴 Indica que sus premios están muy baratos respecto al valor del punto.

### 4.2 Lógica FIFO (Vencimientos)
Los puntos no son infinitos. El sistema usa **First-In First-Out**:
- Se consumen primero los puntos más viejos.
- Esto garantiza que los puntos con vencimiento próximo se usen antes, beneficiando al cliente y reduciendo el pasivo del negocio.

---

## 🚀 5. Motor de Automatización (Daily Engine)
El sistema "está vivo" gracias a `api/engine-daily.js`.

**Tareas Diarias:**
1. **Cumpleaños**: Saludo automático y acreditación de bono regalo (configurable).
2. **Vencimientos**: Procesa puntos vencidos y notifica a los que vencen en los próximos 15 días.
3. **Petshop**: Envía avisos de reposición de alimento.

**Configuración del Cron:**
Vaya a **Configuración > Avanzado** y copie la URL de ejecución. Péguela en Upstash QStash para que se ejecute todos los días a las 09:00 AM.

---

## 🔄 6. Ciclo de Desarrollo (Git Workflow)
**IMPORTANTE**: Nunca trabaje directamente sobre `main`.

1. **Laboratorio (`desarrollo`)**: Suba aquí para probar en el sitio de test.
   ```bash
   git push origin desarrollo
   ```
2. **Producción (`main`)**: Cuando el test sea exitoso, fusione a main para actualizar a TODOS los clientes.
   ```bash
   git checkout main
   git merge desarrollo
   git push origin main
   ```

---

## 🆘 7. Solución de Problemas Comunes
- **WhatsApp no envía**: Verifique que el número del cliente en la ficha no tenga símbolos (+ o -). Debe ser solo números.
- **No llegan correos**: La "Contraseña de Aplicación" de Google puede haber expirado o la cuenta de Gmail tiene el espacio lleno.
- **Error CORS en el Engine**: El motor debe ejecutarse desde el mismo dominio o con el `API_SECRET_KEY` correcto en los headers.

---
*RAMPET Master Documentation - Última Actualización: Mayo 2026 (V.1.4.5)*




--- SECTION: GUIA_DE_PRUEBAS_EXHAUSTIVAS.md ---

# 💎 GUÍA DE PRUEBAS MAESTRA (RAMPET PWA)

¡Bienvenido a la guía final! Esta versión está diseñada para ser clara, visual y fácil de seguir. 

> [!IMPORTANT]
> **REGLA DE ORO:** Para cada prueba, usa un **Socio Nuevo**. Si ya lo usaste para una prueba, crea otro para que los contadores estén en cero.

---

## ⚙️ PASO 0: CONFIGURACIÓN MÍNIMA
Antes de tocar nada, asegúrate de que en el **Panel Admin > Mensajería**, los valores sean:
*   **Máx. Intentos PC:** 2  
*   **Máx. Intentos Gloria:** 2  
*   **Re-suscripción:** 30 DÍAS  

---

## 📂 ESCENARIO 1: Registro desde el PANEL ADMIN
*Uso: Cuando tú mismo das de alta al cliente y luego él entra a curiosear.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **1.1** | 🛠️ **Panel Admin** | Ve a **Clientes** -> Botón **+ Nuevo** -> Créalo. | Socio creado con éxito. |
| **1.2** | 💻 **PWA (PC)** | Inicia sesión con ese nuevo socio. | **BUM:** Aparece el **Banner Azul**. |
| **1.3** | 💻 **PWA (PC)** | Haz clic en **"QUIZÁS LUEGO"**. | El banner se va. |
| **1.4** | 💻 **PWA (PC)** | Pulsa **F5** (Refrescar). | **SILENCIO:** No vuelve a salir. |
| **1.5** | 🛠️ **Panel Admin** | Búscalo en la lista y súmale **100 puntos**. | Puntos sumados. |
| **1.6** | 💻 **PWA (PC)** | Mira la pantalla del socio. | **SILENCIO:** No sale nada (Espera el ciclo). |
| **1.7** | 💻 **PWA (PC)** | **Cierra la pestaña**, abre una nueva y logueate. | **BUM:** Re-aparece el **Banner Azul** (Intento 2). |
| **1.8** | 💻 **PWA (PC)** | Haz clic en **"QUIZÁS LUEGO"**. | Desaparece. Agotaste los intentos normales. |
| **1.9** | 🛠️ **Panel Admin** | Súmale otros **100 puntos**. | Puntos sumados. |
| **1.10**| 💻 **PWA (PC)** | Mira la pantalla del socio. | **¡TRIUNFO! Aparece el Momento de Gloria.** |

---

## 📂 ESCENARIO 2: Registro desde la PWA (Computadora)
*Uso: Cuando el cliente llega a tu web y se registra solo.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **2.1** | 💻 **PWA (PC)** | Pulsa **"REGISTRATE"** -> Sigue los pasos -> Acepta Términos. | Entras al Home directamente. |
| **2.2** | 💻 **PWA (PC)** | No toques nada, espera 2 segundos. | **BUM:** Aparece el **Banner Azul**. |
| **2.3** | 💻 **PWA (PC)** | Pulsa **"SÍ, ME INTERESA"** (Damos permisos). | Permisos activados. Contador resetea a 0. |
| **2.4** | 🛠️ **Panel Admin** | Búscalo y súmale **100 puntos**. | Puntos sumados. |
| **2.5** | 💻 **PWA (PC)** | Mira la pantalla del socio. | **¡NUEVO OBJETIVO!** Sale Gloria para **INSTALAR APP**. |

---

## 📂 ESCENARIO 3: Registro desde el CELULAR
*Uso: Cuando el cliente usa su teléfono.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **3.1** | 📱 **PWA (Móvil)** | Registra un socio nuevo desde el celular. | Llegas al Home del celular. |
| **3.2** | 📱 **PWA (Móvil)** | Mira la pantalla. | Aparece el **Banner Azul**. |
| **3.3** | 📱 **PWA (Móvil)** | Pulsa **"QUIZÁS LUEGO"**. | Desaparece. |
| **3.4** | 📱 **PWA (Móvil)** | Cierra y vuelve a abrir la App. | **SILENCIO:** No sale nada (Espera 24hs). |
| **3.5** | 🛠️ **Panel Admin** | En **Mensajería** -> **Simulador de Fecha** -> Pon **+2 días**. | Reloj adelantado. |
| **3.6** | 📱 **PWA (Móvil)** | Abre la App de nuevo en el celular. | **BUM:** El banner azul vuelve a salir. |

---

## 📂 ESCENARIO 4: El Respeto al "NO, GRACIAS"
*Para comprobar que no somos pesados.*

| Paso | ¿Donde estoy? | ¿Qué hago? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **4.1** | 💻 **PWA** | En cualquier banner, pulsa el botón **"NO, GRACIAS"**. | Cartel de "Ok, te respetamos por 30 días". |
| **4.2** | 🛠️ **Panel Admin** | Haz lo que quieras: suma puntos, quita puntos... | Lo que sea. |
| **4.3** | 💻 **PWA** | Mira la pantalla. | **SILENCIO TOTAL.** No sale nada por un mes. |

---

> [!TIP]
> **¿Todo listo?** Elige un Escenario y empieza. Si tienes dudas en un paso, ¡pregúntame!




--- SECTION: E2E_MASTER_TEST_GUIDE.md ---

# 🏆 Guía Maestra de Pruebas E2E: "Paso a Paso" (Versión Ultra-Detallada)

Esta guía asegura que verifiquemos no solo el saldo, sino la **infraestructura de comunicación** (Push, Email, Inbox, WhatsApp).

---

## � PASO A: Registro Autónomo (Desde la PWA)
*Objetivo: Verificar que un cliente pueda registrarse solo y recibir sus premios iniciales sin intervención del admin.*

1.  **Acceso:** Abre la PWA en una ventana normal (evita incógnito para los permisos) o usa un **Perfil de Chrome diferente**. Pulsa en **"Registrarme"**.
2.  **Paso 1 (Datos Personales):**
    *   Completa: Nombre, Celular, DNI, Fecha de Nacimiento, Email y Contraseña.
    *   **Acción:** Dale a "Continuar".
3.  **Paso 2 (Dirección y Legales):**
    *   Selecciona: Provincia -> Partido -> Localidad.
    *   Completa: Calle, Altura, Piso/Depto y CP.
    *   **Acción:** Tilda "Acepto los Términos y Condiciones". (Puedes pulsar en el link para ver que se abra el modal de legales).
    *   **Finalizar:** Dale a **"Finalizar Registro"**.
4.  **Espera (Pantalla de Procesamiento):**
    *   **Resultado esperado:** Debe aparecer una pantalla blanca/morada con un círculo girando y el mensaje "Procesando Registro...".
5.  **Entrada al Home:**
    *   **Resultado esperado:** Tras unos segundos, entras al Home directamente.
    *   **Welcome Bonus:** Si configuraste puntos de bienvenida, el saldo debe decir `Puntos: X`.
    *   **Popups de Permisos:** A los **3 segundos**, aparecerán los modales de Notificaciones y Ubicación (Ver PASO 0b para detalles).
6.  **Verificación Multi-Canal:**
    *   **Email:** El cliente recibe el "Email de Bienvenida" al instante.
    *   **Inbox (PWA):** En el ícono de la campanita debe haber un mensaje saludando y confirmando los puntos de regalo.
    *   **Audit Log (Admin):** Debe aparecer el evento `user_mgmt` con los detalles del nuevo socio.

---

## �🛠️ PASO 0: El "Nacimiento" del Socio y su Token Push
*Importante: Si el socio no se loguea al menos una vez en la PWA, el sistema no tiene su "dirección" (Token) para mandarle notificaciones Push.*

1.  **Panel Admin:** Ve a **Socios** -> **Nuevo Socio**.
    *   Email: `test_pablo@ejemplo.com` | DNI: `12345678`.
2.  **PWA (Primer Login):** Abre la PWA en una pestaña de incógnito o en tu celular.
    *   Inicia sesión con ese email y DNI.
3. **Verificación Técnica (Admin/Socio):**
    *   **Audit Log:** En el Panel Admin -> Logs de Sistema, busca `user_mgmt`. Debe decir "Cliente registrado".
    *   **Email (Socio):** Revisa el correo del socio. Debe haber recibido un **Email de Bienvenida** con su número de socio y puntos de regalo (si aplica).
    *   **WhatsApp (Socio):** Si se cargó el teléfono y está activo el canal, se abrirá/enviará un mensaje de bienvenida.
    *   **Resultado esperado:** En la sección técnica/perfil debe decir "Push Token: [SI]" (o verás una cadena larga de texto). ¡Ahora el socio ya puede recibir mensajes!

---

## 📍 PASO 0b: Los Mensajes de Bienvenida (Popups de Permisos)
*Objetivo: Verificar que el sistema pida permiso para avisar y ubicarse de forma amigable.*

1.  **Gatillo:** Quédate en el **Home** de la PWA recién abierta.
2.  **Espera:** Espera **3 segundos** sin hacer nada.
3. **Verificación Técnica:**
    *   **Audit Log:** Debe aparecer el registro de creación (`user_mgmt`).
    *   **Email (Socio):** El socio recibe el **Email de Bienvenida** automáticamente.
    *   **Firestore:** El documento en `users` tiene `source: 'pwa'`.
    *   **Aparición:** Debe aparecer el modal de **Notificaciones** (morado con una campana).
    *   **Acción:** Dale a "Sí, avisar de premios". El navegador te pedirá permiso real -> Dale a **PERMITIR**.
    *   **Siguiente Modal:** Inmediatamente debe aparecer el modal de **Ubicación** (verde con un pin).
    *   **Acción:** Dale a "Activar ahora". El navegador te pedirá permiso de ubicación -> Dale a **PERMITIR**.
    *   **Final:** El modal desaparece y recibes un toast de "Ubicación activada".

---

## 📍 PASO 0c: Configuración de Itinerancia (Vencimientos) y Seguridad
*   **Acción:** Ir a **Panel Admin -> Configuración -> Reglas del Juego**.
*   **Configuración:** Activar "Repetir Avisos" (Itinerancia) y poner intervalo en `1` día para pruebas rápidas.
*   **Configuración Extra:** Ir a pestaña **Avanzado** y verificar que "Control de Ejecución Diaria" esté DESACTIVADO si vas a hacer varias pruebas el mismo día (Modo Test).
*   **Resultado Esperado:** Al guardar, el sistema permitirá re-enviar avisos de vencimiento aunque los puntos no hayan cambiado, siempre que pase el intervalo (o siempre si el control diario está off).

---

## 🏁 ESCENARIO 1: La "Carta de Puntos" (Extensión de Chrome)
*Objetivo: Verificar que la extensión detecta el total y muestra las promociones vigentes al elegir un socio.*

1.  **Preparación:** Abre tu sistema de facturación en la pestaña donde aparece el Total a pagar ($).
2.  **Detección:** 
    *   **Resultado esperado:** Debe aparecer el botón flotante de **"Sumar Puntos"** (o el panel ya abierto si detectó el monto automáticamente).
3.  **Búsqueda de Socio:** Escribe `12345678` en el buscador de la extensión.
    *   **Resultado esperado:** Debe encontrar a "test_pablo". Selecciónalo.
4.  **Verificación de "Carta de Puntos":** 
    *   **Resultado esperado:** Al seleccionar al socio, se debe ver su saldo actual (0) y, más abajo, la sección **"Aplicar Promociones / Bonus"** con la lista de campañas activas (la "Carta de Puntos").
    *   **Detalle:** Verifica que si hay una Campaña Flash activa, aparezca con el rayo `⚡ FLASH` y su respectivo cronómetro/label.
5.  **Acción:** Asegúrate que el monto sea correcto y dale al botón **"Asignar Puntos"**.
    *   **Resultado esperado (UI):** El panel dice "Cargando..." y luego muestra el cartel de éxito verde.
    *   **WhatsApp:** Si el checkbox de WhatsApp estaba activo, debe abrirse la pestaña de WhatsApp Web con el mensaje pre-cargado.

---

## 📱 ESCENARIO 2: Verificación Multi-Canal (Post-Venta)
*Objetivo: Ver que los 4 canales de comunicación se activen tras la acción de la extensión.*

1.  **Resultados tras el Paso Anterior:**
    *   **Canal 1 (Push - Cliente):** Notificación inmediata. 
        *   **Verificación de Logo:** Asegúrate de que el logo del club se vea grande y nítido, no como un "planeta" genérico o un ícono pequeño del sistema.
    *   **Canal 2 (Inbox - Cliente):** En la PWA -> Campanita, aparece el mensaje detallado.
    *   **Canal 3 (Email - Cliente):** Llega el correo a `test_pablo@ejemplo.com`.
    *   **Canal 4 (Auditoría - Admin):** En Panel Admin -> **Logs / Auditoría**, la entrada debe marcar: `Email: OK`, `Push: OK`, `Inbox: OK`.

---

## 🎂 ESCENARIO 3: Bono de Cumpleaños (El Robot Automático)
1.  **Preparación:** En el Panel Admin, edita a `test_pablo` y pon su fecha de nacimiento como **HOY**.
2.  **Gatillo:** Ve a **Configuración** y pulsa "Ejecutar Motor Diario (Manual)".
3.  **Resultados esperados:**
    *   **Saldo:** El cliente ve +X puntos (según tu config).
    *   **Push/Inbox:** Recibe el "¡Feliz Cumpleaños!" en ambos canales.
    *   **Auditoría:** En el registro de "Cumpleaños" debe decir: `Socio test_pablo: Procesado con éxito`.

---

## ⏳ ESCENARIO 4: Expiración y Widget de la Extensión
1.  **Preparación:** Haz que los puntos de `test_pablo` venzan mañana (editando en Firestore).
2.  **Gatillo (Extensión):** Abre el facturador. Verás el widget naranja `⏳ V: 1`.
3.  **Gatillo (Panel):** En el Dashboard verás la burbuja verde de WhatsApp.
4.  **Acción Admin:** Pulsa "Enviar" o la **(X)** de "Anular" en la burbuja del Dashboard.
5.  **Verificación de Descarte:** Vuelve al facturador. 
    *   **Resultado esperado:** El widget naranja **desaparece solo** sin refrescar (gracias al arreglo que hicimos hoy).

---

## ⚡ ESCENARIO 5: Campaña Flash (Multiplicador Activo)
1.  **Campaña:** Crea una Campaña Flash que empiece en 2 minutos.
2.  **Lead Time:** El cliente recibe un Push avisando que la promo está por empezar.
3.  **Acción:** Suma puntos con la extensión durante la campaña.
    *   **Resultado esperado:** El cliente recibe el multiplicador (x2, x3) y el Push de confirmación lo menciona.

---

> [!IMPORTANT]
> **REGLA DE ORO DE LAS NOTIFICACIONES PUSH:** 
> 1.  **NO USAR INCÓGNITO:** Los navegadores bloquean permisos de Push y GPS en modo incógnito. Usa un **Perfil de Chrome** diferente.
> 2.  **PERMISOS:** El cliente debe aceptar el permiso en el popup del navegador.
> 3.  **LOGIN:** El cliente debe loguearse al menos una vez para registrar su "dirección" (Token).
> 4.  **SERVIDOR:** El servidor debe tener las claves de Firebase correctas en el `.env`.




--- SECTION: HOJA_DE_RUTA_PRUEBAS_E2E.md ---

# Hoja de Ruta: Pruebas Integrales del Sistema (End-to-End)

Este documento detalla los escenarios y pautas de prueba (E2E) para asegurar la salud y correcto funcionamiento de los distintos módulos de Club Fidelidad.

---

## FASE 1: Motor Diario (Expiraciones y Cumpleaños)

El Motor Diario (`/api/engine-daily.js` y `/api/expirations.js`) es el corazón de la retención y la operatoria automatizada. Las pruebas deben cubrir las restricciones de seguridad, el procesamiento de cumpleaños y las lógicas de vencimiento de puntos.

### 1. Guardias de Seguridad y Deduplicación
- **1.1. Ventana Horaria:** 
  - *Acción:* Ejecutar el cronjob fuera de la ventana horaria permitida (ej. 3:00 AM) usando un trigger automatizado (`pwa`, `qstash`).
  - *Resultado Esperado:* El motor debe registrar un `system_skip` en auditoría indicando "Fuera de horario permitido" y abortar el proceso.
- **1.2. Deduplicación Diaria:**
  - *Acción:* Ejecutar el cronjob dos veces en el mismo día dentro de la ventana horaria.
  - *Resultado Esperado:* La primera ejecución corre normalmente. La segunda debe retornar `skipped: true` con el mensaje "Todo al día", registrando en auditoría que había "Deduplicación activa".
- **1.3. Forzado Manual (Override):**
  - *Acción:* Enviar petición con `isManual=true` o `ignoreDeduplication=true` (simulando desde el Dashboard).
  - *Resultado Esperado:* El motor debe saltarse las guardias de horario y de limitación de una-vez-al-día, ejecutando la evaluación y notificando según corresponda.

### 2. Pautas de Prueba: Cumpleaños
- **2.1. Asignación de Puntos y Saludos:**
  - *Preparación:* Crear un usuario de prueba con fecha de nacimiento coincidente con el día de hoy (ej. "MM-DD" = hoy).
  - *Acción:* Ejecutar el Motor Diario.
  - *Resultado Esperado:* 
    - El usuario debe recibir la cantidad de puntos definida en configuración (ej. 100 pts).
    - El historial de puntos debe mostrar el crédito con concepto "🎂 ¡Feliz Cumpleaños! Regalo del Club" y una expiración de +365 días.
    - Se debe disparar notificación Push (si tiene token FCM), Email (si tiene correo) y guardar un mensaje en el Inbox (`/inbox`).
    - En el documento del usuario se deben actualizar los campos `lastBirthdayGreetingYear` y `lastBirthdayPointsYear` al año en curso.
- **2.2. Control de Año Ya Bonificado:**
  - *Acción:* Ejecutar nuevamente el motor tras el paso 2.1 (usando `ignoreDeduplication=true`).
  - *Resultado Esperado:* El usuario NO debe volver a recibir los puntos ni el saludo, ya que `lastBirthdayGreetingYear` coincide con el año actual.

### 3. Pautas de Prueba: Expiraciones y Vencimientos
- **3.1. Resta de Puntos Vencidos:**
  - *Preparación:* Configurar un usuario con un crédito en el historial cuya fecha `expiresAt` haya pasado ("ayer" o antes) y asignar la fecha de hoy (o menor) a `nextExpirationDate` en su documento principal.
  - *Acción:* Ejecutar Motor Diario.
  - *Resultado Esperado:*
    - El crédito vencido pasa a estado `status: 'expired'` y `remainingPoints: 0`.
    - Se genera un débito compensatorio en el historial: "Vencimiento de puntos acumulados (Auto)".
    - Se descuentan los puntos del saldo principal (`points`).
    - Se recalcula de manera correcta `nextExpirationDate`.
- **3.2. Avisos Proactivos de Próximo Vencimiento:**
  - *Preparación:* Asignar un crédito a un usuario que expira en exactamente los días de anticipación definidos (ej. `warningDays` = 7 días), haciendo que su `nextExpirationDate` apunte a 7 días en el futuro.
  - *Acción:* Ejecutar Motor Diario.
  - *Resultado Esperado:*
    - El sistema envía notificación Push y Email con el título "⚠️ Tus puntos están por vencer" detallando el monto y la fecha exacta.
    - Se crea registro en Inbox.
    - Se actualiza el campo `lastExpirationNotice` al día de hoy, y `lastExpirationNoticeTargetDate` a la fecha en que vencen.
- **3.3. Itinerancia de Advertencia:**
  - *Acción:* Volver a ejecutar el Motor Diario al día siguiente. 
  - *Resultado Esperado:* El sistema valida la diferencia de días contra `expirationReminderIntervalDays`. Si no ha pasado el intervalo, NO vuelve a enviar el correo/push molesto.

### 4. Auditoría
- **4.1. Registro Consolidado:**
  - *Acción:* Tras la primera ejecución limpia del día.
  - *Resultado Esperado:* Verificar que en la tabla/colección `audit_logs` se haya creado un documento de tipo `daily_engine_run` con el resumen consolidado: Total de cumpleaños procesados y Notificaciones de vencimiento. Además de un log secundario de tipo `expiration_engine`.

---
*Nota: Para simular fechas sin afectar el ambiente real de producción en Firebase, se recomienda utilizar el parámetro temporal `simulatedDate` o bien apuntar el entorno de desarrollo al emulador local o base de datos de staging.*




--- SECTION: TEST_GUIDE_CAMPAIGNS.md ---

# Hoja de Ruta: Pruebas Integrales del Sistema (End-to-End)

Este documento detalla los escenarios de prueba exactos que deben ejecutarse manualmente para verificar que **todos los componentes del Club Fidelidad** interactúan correctamente.

Esta hoja de ruta debe ser ejecutada paso a paso antes de redactar los manuales definitivos.

---

## 📅 FASE 1: Motor Diario (Expiraciones y Cumpleaños)

**Objetivo:** Verificar que el sistema limpia puntos vencidos y otorga el bono de cumpleaños correctamente sin duplicar acciones.

### ⚙️ Condiciones Iniciales (Configuración del Entorno)
Antes de comenzar con las pruebas de la Fase 1, se deben establecer los parámetros base en la colección `config` (documento `general`) en Firestore:

1.  **Ventana Horaria del Motor (`messaging.engineAllowedStartHour` / `engineAllowedEndHour`):**
    *   Para poder disparar y testear los automáticos en el momento, ajusta temporalmente la hora de inicio a un valor menor al actual (ej. `0`) y la de fin a mayor (ej. `24`).
2.  **Control de Duplicados (`enableDuplicateControl`):**
    *   Déjalo en `true` para comprobar que el escudo funciona (evita doble saldo de cumpleaños en un día). Utilizarás los gatillos forzados del panel (`ignoreDeduplication=true`) para saltar este control a voluntad.
3.  **Itinerancia de Avisos de Vencimiento:**
    *   Asegura que `messaging.enableExpirationWarnings` esté en `true`.
    *   *Si deseas probar CON itinerancia (envío insistente a medida que se acerca la fecha):*
        *   Ajusta `messaging.repeatExpirationWarnings` a `true`.
        *   Ajusta `messaging.expirationReminderIntervalDays` a `1` (o a un valor de días corto) para que permita enviar más de un recordatorio.
    *   *Si deseas probar SIN itinerancia (aviso único al entrar en la ventana):*
        *   Ajusta `messaging.repeatExpirationWarnings` a `false`. El socio recibirá el Push/Email la primera vez que la fecha entre en el rango de riesgo (ej. 7 días de `expirationWarningDays`) y no se le molestará más.

---

### Escenario 1.1: Vencimiento de Puntos
1.  **Preparación (Admin):**
    *   Ve a la ficha de un "Usuario de Prueba".
    *   Súmale 100 puntos utilizando el botón "Acreditación Manual".
    *   *Acción Técnica:* En Firebase Firestore, edita el documento de ese usuario en la colección `users`, y cambia su `nextExpirationDate` para que sea el día de **Ayer** (ej. si hoy es 15, pon 14).
2.  **Disparo (Gatillo):**
    *   Abre el Panel Admin (esto dispara la Extensión Chrome) o abre la PWA.
3.  **Verificación:**
    *   **Auditoría:** En el registro "Motor Diario" o "Expiraciones", debe indicar "Expired: 1". El registro debe detallar a quién se le quitaron los puntos.
    *   **PWA:** Entra como ese cliente. Su saldo debe haber bajado 100 puntos. En su "Actividad" debe aparecer el ítem "Puntos Vencidos".

### Escenario 1.2: Bono de Cumpleaños
1.  **Preparación:**
    *   En Firestore, cambia la `birthDate` del "Usuario de Prueba" para que coincida con el día y mes de **HOY** (ej. "1990-10-15").
2.  **Disparo:**
    *   Usa el botón "Forzar Revisión Diaria (Ignorar Control)" en la página de **Configuración** del Panel Admin.
3.  **Verificación:**
    *   **Auditoría:** En el registro de "Cumpleaños" debe marcar "Notified: 1".
    *   **PWA:** El cliente debe recibir la notificación Push/Inbox de Feliz Cumpleaños y ver los puntos acreditados en su historial.
    *   *Deduplicación:* Vuelve a darle al botón "Forzar Revisión Diaria" (esta vez sin ignorar el control, p.ej. recargando el dashboard). La auditoría debe decir "Skipped: alreadyRanToday".

---

## 🚀 FASE 2: Campañas Flash y Modificaciones en Vivo

**Objetivo:** Comprobar la precisión del reloj, los márgenes de antelación y qué sucede al alterar una campaña mientras está activa.

### Escenario 2.1: Antelación y Activación Flash
1.  **Creación:** Crea una Campaña Flash para que inicie en **15 minutos** y termine en **30 minutos**.
    *   Pon la "Antelación del Mensaje" (Lead Time) en **10 minutos**. (El mensaje debe salir 10 min antes del inicio).
2.  **Verificación del Lead Time:**
    *   Espera a que falten 9 minutos para el inicio.
    *   Abre la PWA (Gatillo).
    *   Revisa la PWA del cliente: **Debe recibir el Push** y el mensaje en el Inbox, pero la promoción **AÚN NO DEBE VERSE** en la sección "Promos Vigentes".
3.  **Verificación de Activación:**
    *   Espera a que sea la hora de inicio exacta.
    *   Recarga la PWA.
    *   Ahora la promoción **DEBE VERSE** en el Home y Carrusel, con el cronómetro corriendo.

### Escenario 2.2: Interferencia Manual (Alterando la campaña en vivo)
1.  **Alteración:**
    *   Mientras el cronómetro de la campaña anterior sigue corriendo en la PWA, ve al Panel Admin.
    *   Edita la campaña Flash: Cámbiable el título, el valor del premio (ej. de x2 a x3) y los canales de notificación. Guarda los cambios.
2.  **Verificación de Interferencia:**
    *   Ve a la PWA y recarga.
    *   El cronómetro debe seguir correcto, pero el título debió actualizarse.
    *   **Prueba de Deduplicación Crítica:** Abre el panel y haz clic en "Ejecutar Motor" (Manual). Ve a la Auditoría. El motor **NO debe haber enviado otra notificación Push**, debe decir "Skipped" (alreadySentToday), confirmando que editar una campaña no resetea su estado de spam.

### Escenario 2.3: Interacción del Cliente en Medio de la Campaña
1.  **Mientras la campaña Flash (x3) sigue activa:**
    *   Usa la pistola escáner (o el botón "Asignar Puntos" manual en el panel admin para simularlo).
    *   Asígnale 100 puntos al cliente de prueba.
2.  **Verificación de Multiplicador:**
    *   La base de datos y la actividad del cliente deben registrar **300 puntos**, confirmando que el motor de asignación detectó y respetó el multiplicador activo de la campaña modificada.

### Escenario 2.4: Muerte de la Campaña
1.  **Fin Nominal:**
    *   Espera a que pase la hora de fin.
    *   La PWA debería dejar de mostrar el cronómetro y la campaña desaparece del front-end.
2.  **Margen de Gracia:**
    *   Asigna puntos en el Panel Admin durante los 15 minutos posteriores a la finalización (el Margen de Gracia predeterminado).
    *   El cliente **AÚN DEBE recibir el premio x3** (o el que estuviese configurado).
3.  **Desactivación Definitiva:**
    *   Espera a que pase el Margen de Gracia (Ej. 16 minutos después de la finalización).
    *   Entra al Panel Admin (Gatillo de Mantenimiento).
    *   Ve a Campañas: la campaña ahora debe estar en verde a gris (Estado: Borrador). Ya no existe para el motor.

---

## 📝 FASE 3: Desarrollo de Documentación (Próximos Pasos)

Una vez que se ejecuten y aprueben todos los pasos de las Fases 1 y 2, se procederá a:

1.  **Manual de Usuario (Visual):**
    *   Capturar pantallas (Screenshots reales del sistema) para cada flujo: Crear socios, sumar puntos, crear campañas normales y configurar flash.
2.  **Manual Técnico (Arquitectura):**
    *   Explicar la relación entre `campaignService`, `engine-campaigns.js`, `engine-daily.js`, QStash y Firestore.
    *   Detallar las variables críticas (`broadcastLeadMins`, `engineAllowedStartHour`).
3.  **Manual de Despliegue (Clonación):**
    *   Guía estricta paso a paso para levantar un nuevo gimnasio o local desde cero (Firebase, Vercel, Variables de Entorno, QStash).


---
## 🔔 GESTIÓN DE ALERTAS Y NOTIFICACIONES (V.1.4.32)

Para una operación fluida, el sistema utiliza un sistema de **Sincronización Bidireccional** entre la Extensión de Chrome y el Panel Administrador. Todas las alertas se centralizan en un widget flotante (burbuja).

### 🏷️ Diccionario de Siglas (Widget Minimizado)
Cuando el widget de alertas está contraído, muestra un resumen rápido del trabajo pendiente usando estas siglas:

*   **C**: **Cumpleaños** 🎂 (Socios que cumplen años hoy).
*   **V**: **Vencimientos** ⏳ (Puntos que están en el periodo crítico de caducidad).
*   **A**: **Alimento (Mascotas)** 🐾 (Avisos de reposición de comida según el ciclo de consumo).
*   **R**: **Canjes (Redemptions)** 🎁 (Premios canjeados por socios durante el día).
*   **P**: **Puntos (Asignaciones)** 💰 (Resumen de las cargas de puntos realizadas en la jornada).

---

### 🐾 Lógica del Módulo Pet (Consumo Real)
El sistema ha evolucionado de un simple recordatorio a un **Monitor de Consumo Real**:

1.  **Gatillo de Ciclo**: El ciclo de reposición NO se cuenta desde el último aviso, sino desde la **última compra real**. 
2.  **Registro de Compra**: Al cargar puntos y marcar "Reposición de Alimento" en la extensión, el sistema guarda la `lastPurchaseDate`.
3.  **Cálculo Proactivo**: El motor de alertas calcula: `Fecha_Compra + Ciclo_de_Días - Días_de_Antelación`. 
4.  **Aviso Anticipado**: El mensaje se dispara `N` días antes (configurable en el panel) de que se le termine el alimento al socio, permitiendo una preventa efectiva.

---

### 📳 Canales de Comunicación
*   **WhatsApp**: En la extensión, el botón de WhatsApp siempre está disponible para envío manual, incluso si la automatización global está apagada (Prioridad del Administrador).
*   **Push PWA**: Las notificaciones móviles se envían a todos los dispositivos registrados del socio (`multi-token`). Al hacer clic, redirigen directamente al perfil del usuario en la PWA.
*   **Email e Inbox**: Copias de seguridad de todas las alertas importantes.
