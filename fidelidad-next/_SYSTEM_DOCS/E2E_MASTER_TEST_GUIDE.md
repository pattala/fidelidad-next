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
