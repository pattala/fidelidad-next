# 🧪 GUÍA DEFINITIVA DE PRUEBAS DE LA PLATAFORMA (A PRUEBA DE TONTOS)

Este documento centraliza todas las pruebas que debes realizar para validar el 100% del funcionamiento de la PWA, el Backend y la Extensión. 

**Regla de oro para estas pruebas:** Sigue los pasos en orden. No asumas que algo funciona sin probarlo bajo estas condiciones.

---

## 🛠 PARTE 1: AMBIENTE CONTROLADO Y CONFIGURACIÓN INICIAL

Antes de empezar a probar como usuario, debes asegurarte de que el "terreno" (el Panel de Administración) esté configurado exactamente como necesitamos para que las pruebas sean predecibles.

### 1.1 Limpieza y Preparación (Admin Panel)
- [ok] Entra al panel de administrador (`/admin`).
- [OK] Ve a "Usuarios" o la base de datos y ELIMINA los usuarios de prueba anteriores que vayas a reutilizar (para que los registros sean 100% desde cero).
- [OK] Ve a "Campañas" y DESACTIVA cualquier campaña que esté corriendo, para que no interfiera enviando notificaciones adicionales mientras pruebas los flujos básicos.

### 1.2 Configuración Exacta (Pestaña "Configuración")
Asegúrate de tener estos valores **exactamente así** antes de iniciar:
- [ ] **Mail de Bienvenida:** ✅ Activo.
- [ ] **Puntos por Registro:** ✅ Activo. Valor: `100`. (Para saber instantáneamente que entraron bien).
- [ ] **Puntos por Domicilio:** ✅ Activo. Valor: `50`.
- [ ] **Tabla de Vencimientos:** Revisa que los puntos de Registro y Domicilio tengan sus días de vencimiento configurados correctamente en la tabla de vencimientos (Ej: Vencen a los 365 días).

- [ ] **Días de preaviso de vencimiento:** `7` días.
- [ ] **Intervalo de repetición (Vencimientos):** `2` días.
- [ ] **Re-intento de Permisos PWA:** ✅ Activo. Y configura en `7` días.
- [ ] GUARDA LOS CAMBIOS en el panel de configuración.

---

## 📱 PARTE 2: PRUEBAS DEL CLIENTE (PWA)

**⚠️ IMPORTANTE SOBRE EL ENTORNO DE PRUEBA:**
*   **NO uses el modo Incógnito/InPrivate** para la prueba de Permisos (Paso 2.2). Los navegadores modernos bloquean directamente las notificaciones Push y la Geolocalización en incógnito, por lo que la app no registrará bien tus elecciones.
*   **La forma correcta de limpiar tu usuario para una prueba nueva es:** En Chrome (PC o Celular), ve a *Configuración del sitio* -> *Fidelidad* -> **Borrar datos y Restablecer permisos**. Luego, refresca la página.
*   **Doble Prueba (El Mejor Enfoque):** Para evitar que los tokens de notificaciones o las sesiones choquen, **crea DOS usuarios de prueba distintos** (ej: `pablo.pc@test.com` y `pablo.movil@test.com`). Haz el recorrido 2.1 al 2.3 en la computadora con el primero y simultáneamente en tu celular con el segundo.

### 2.1 El Registro (El Embudo Principal)
**Objetivo:** Validar que el usuario entra, se le asigna DNI/Socio correcto, recibe los premios iniciales y UN SOLO email. Repite este bloque en tu PC (Usuario A) y en tu Celular (Usuario B).

- [ ] Entra a la URL de la PWA (`/login`).
- [ ] Haz clic en "Crear Cuenta" o "Registrarme".
- [ ] **Verificación visual:** El banner inicial debe decir "Registrate y gana 150 puntos" (suma de los 100 + 50 que configuraste).
- [ ] Completa Nombre, Apellido, Email, DNI/Teléfono.
- [ ] Llega al paso del Domicilio. **Completa los datos del domicilio.**
- [ ] Haz clic en el botón principal ("Completar y ganar puntos").
- [ ] **Expectativa en la App:** Te debe llevar a la pantalla de Inicio ("Home") directamente, mostrando **150 Puntos** en el marcador.
- [ ] **Expectativa en Email:** Ve a la bandeja de entrada del email con el que te registraste. Debes haber recibido **UN SOLO EMAIL**. Ese email debe decir "¡Bienvenido!" y celebrar que ganaste 150 puntos. *(Si llegan dos, o llega vacío, repórtalo).*

### 2.2 Validación de los Pop-ups Persuasivos (Permisos)
**Objetivo:** Validar que los permisos no sean molestos, los copys sean los acordados y la lógica de "memoria" funcione.

- [ ] En la pantalla de inicio, espera unos 3 segundos. Debería aparecer el cartel de **Avisos y Premios** (Notificaciones).
- [ ] Haz clic en **"Quizás Luego"**.
- [ ] Navega por la app (ve a Premios, ve a Perfil, vuelve a Inicio). 
- [ ] **Expectativa:** El cartel **NO DEBE** volver a aparecer. La sesión se acordó que le dijiste "luego".
- [ ] Cierra la pestaña. Abre la app normalmente (o en tu celular asegurándote de no estar en incógnito), entra a la PWA y haz Login con el usuario que recién creaste.
- [ ] Espera unos 3 segundos. 
- [ ] **Expectativa en PC y Móvil:** El cartel de "Avisos y Premios" **SÍ DEBE** aparecer en esta nueva sesión (asumiendo que los días de iterancia que configuraste ya pasaron o borraste el LocalStorage/Cache del navegador). *(Nota: Si está en 7 días, puedes forzarlo borrando el "Session Storage" en las herramientas de desarrollador o desde el menú de Chrome del celular "borrar datos del sitio").*
- [ ] Esta vez, en el cartel de Avisos, pon **"Sí, avisar de premios"**. Acepta el permiso del navegador emergente.
- [ ] Inmediatamente después de aceptar, debe aparecer el cartel de **Beneficios Locales** (Ubicación).
- [ ] Acéptalo también y da permisos en el navegador.

### 2.3 El Perfil y Toggles
**Objetivo:** Validar los copywritings amistosos y que los botones reflejen la realidad.

- [ ] Toca el ícono de "Mi Perfil" en la barra inferior.
- [ ] **Verificación visual:** Ya no deben existir las palabras "Geolocalización" ni "Notificaciones". Deben decir "Avisos y Premios" y "Beneficios Locales".
- [ ] **Validación:** Como los activaste en el paso 2.2, los "toggles" (interruptores) de ambos deben aparecer en color **Verde (Activados)**.
- [ ] Toca el verde de "Avisos y Premios" para apagarlo. Debe ponerse gris y aparecer un cartelito confirmando que se apagó.

---

## 💻 PARTE 3: LA EXTENSIÓN DE CHROME EN CAJA

**Objetivo:** Validar el proceso del cajero en el día a día.

- [ ] Abre tu sistema de facturación en la pestaña donde tienes anclada la extensión.
- [ ] Abre la Extensión e ingresa el DNI o el Email del usuario que creaste en la Parte 2.
- [ ] **Expectativa:** La extensión debe encontrar a "Pablo Prueba" (tu usuario) y mostrar que tiene **150 Puntos** disponibles.
- [ ] En la sección de asignar puntos, asúgnale **500 Puntos**.
- [ ] Ve a la PWA (celular/incógnito) y recarga la página. Tu saldo ahora debe ser **650 Puntos**.
- [ ] Volviendo a la extensión, simula un canje. Ve a la pestaña de canjear/restar y réstale **200 Puntos**.
- [ ] Revisa la PWA. Tu saldo ahora debe ser **450 Puntos**.

---

## ⚙️ PARTE 4: EL MOTOR ("THE ENGINE") Y VENCIMIENTOS

**Objetivo:** Probar el CronJob y las lógicas de fechas.

### 4.1 Forzar un vencimiento falso (Solo para Testing)
Para poder probar los correos de vencimiento sin esperar 1 año:
- [ ] Ve al Panel de Admin -> "Usuarios".
- [ ] Busca el usuario que creaste y ábrelo.
- [ ] Baja hasta el "Historial de Puntos".
- [ ] Busca la fila donde le diste los 500 puntos (o los de registro). Haz clic en el ícono de lápiz/editar en la columna de la derecha.
- [ ] Cambia la "Fecha de Caducidad" para que sea **pasado mañana** (ejemplo, si hoy es día 10, ponle día 12 de este mes). Guarda.
- [ ] Vuelve a la lista de usuarios. La columna "Próximo Vencimiento" debería reflejar la fecha de pasado mañana y pintarse de **Naranja/Rojo** (porque entra en la ventana de aviso de 7 días).

### 4.2 Disparar el Motor Manualmente
Como Vercel a veces duerme el cronjob, lo dispararemos a mano para la prueba.
- [ ] En el Panel de Admin, ve a **"Logs del Sistema"** (abajo en el menú).
- [ ] Haz clic en la pestaña **"Check Vencimientos"**.
- [ ] Toca el botón de Play grande (Forzar escaneo ahora). Acepta la advertencia.
- [ ] Aparecerá una pantalla tipo consola. Espera a que termine (dirá "Motor finalizado").
- [ ] **Expectativa en Logs:** El log deber decir "Avisando a 1 cliente sobre puntos por vencer".
- [ ] **Expectativa en tu app:**
    - Ve a la bandeja de tu email. Debe haberte llegado el correo de "Tus puntos están por vencer".
    - Abre la PWA. Arriba a la derecha en la campanita, debes tener un "(1)", y al entrar, un mensaje en el Buzón advirtiendo del vencimiento.
    - *Si habilitaste notificaciones push, debería llegarte también al celular/PC.*

### 4.3 Deduplicación (Anti-Spam)
- [ ] Vuelve a "Logs del Sistema" -> "Check Vencimientos" en el Admin.
- [ ] Presiona otra vez el botón Play grande para forzarlo **por segunda vez hoy**.
- [ ] **Expectativa:** El log debe ejecutar rápido y decir que avisó a **"0 clientes"**. Esto es porque se dio cuenta que "Pablo Prueba" ya recibió su aviso y no tiene que volver a spamearlo por hoy.

---

## 📢 PARTE 5: CAMPAÑAS DE NOTIFICACIONES (PUSH EXTREMO)

**Objetivo:** Validar que podemos disparar promociones "on demand".

- [ ] Ve al Panel de Admin -> **"Campañas"**.
- [ ] Crea una Nueva Campaña.
- [ ] Tipo: **Urgente / Flash** (son las más fáciles de probar).
- [ ] Ponle Título: "PROMO PRUEBA", Subtítulo "2x1 hoy", Cuerpo: "Ven ahora mismo".
- [ ] Activa el chequeo inferior: **"Lanzar motor Push de inmediato al Guardar"**.
- [ ] Haz clic en "Crear Campaña y Notificar a todos".
- [ ] El sistema se quedará pensando y dirá "Enviando... Listo".
- [ ] **Expectativa en PC y Celular:** Como creaste dos usuarios y a ambos les diste permisos en el punto 2.2, la notificación Push te debe saltar **SIMULTÁNEAMENTE** en la pantalla secundaria de tu PC de escritorio y en tu celular (iOS/Android).
- [ ] Entra a la PWA con cualquiera de los usuarios -> Campanita -> Buzón. La campaña de "PROMO PRUEBA" debe estar ahí dentro para leerla cuando quieras en ambos dispositivos.

---

> ### 🏁 ¿Has marcado todas las casillas?
> Si has marcado absolutamente todas las cajas de arriba y el comportamiento fue exactamente el descrito, ¡felicidades! **El sistema está robusto y estable en su versión actual.** 
> Si detectas que algo no hace exactamente lo que dice su "Expectativa", deten la prueba ahí mismo y repórtamelo para analizar el caso aislado.
