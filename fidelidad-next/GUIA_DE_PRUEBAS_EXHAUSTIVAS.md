# 🧪 GUÍA DE PRUEBAS POR DISPOSITIVO (PC vs. CELULAR)

Este documento organiza las pruebas para que puedas completar primero todo lo que se hace en la **Computadora** y luego pasar al **Celular**.

---

## 💻 BLOQUE 1: PRUEBAS EN COMPUTADORA (PC / DESKTOP)

Este bloque incluye la configuración inicial, el uso del Panel de Administración, la Extensión y la experiencia de la PWA en escritorio.

### 1.1 Preparación y Configuración (Admin Panel)
*Antes de empezar, el "terreno" debe estar listo:*
- [ ] **Limpieza**: Elimina usuarios de prueba previos para empezar de cero.
- [ ] **Pestaña Configuración**:
    - [ ] Puntos por Registro: `100` pts.
    - [ ] Puntos por Domicilio: `50` pts.
    - [ ] **Novedad 09/03**: En "Mensajería", verifica que los Toggles de **"Límite de Persianas"** y **"Límite de Cartel Grande"** estén ambos en **ON**.
- [ ] **Guardar cambios**.

### 1.2 Flujo del Cliente en PC (PWA Desktop)
- [ ] Abre la PWA en una pestaña de Chrome (fuerza el cierre de sesión si tenías una).
- [ ] **Registro**: Crea un usuario nuevo (`pc@test.com`).
- [ ] **Expectativa**: Al terminar, debes ver **150 Puntos** y recibir un **Email de Bienvenida**.
- [ ] **Permisos en PC**: 
    - [ ] Espera al cartel de "Avisos y Premios". Dale a **"Quizás Luego"**.
    - [ ] **Novedad 09/03 (Ciclo)**: Suma puntos o navega. Verifica que **NO** aparezca el banner chico arriba. Ha de respetarse el "no" de la sesión.
    - [ ] Abre una nueva sesión (o limpia session storage) y esta vez **ACEPTA** los permisos.

### 1.3 Extensión de Chrome y Acciones de Operador
- [ ] Abre tu sistema de facturación con la extensión.
- [ ] Busca al usuario `pc@test.com`.
- [ ] **Carga de Puntos**: Asígnale 500 puntos.
- [ ] **Canje de Premios (Refuerzo 09/03)**:
    - [ ] Realiza un canje desde la extensión o desde el botón azul "Canjes" en el Panel Admin.
    - [ ] **Expectativa**: El proceso debe ser fluido sin errores 500 ni fallos de "token A" en la consola.
- [ ] **Validación de Saldo**: Verifica en la PWA que el saldo se actualizó correctamente.

### 1.4 Auditoría y Motores Manuales
- [ ] Ve a **Logs del Sistema** -> Pestaña **Check Vencimientos**.
- [ ] Haz clic en el botón de **Play (Forzar escaneo)**.
- [ ] **Novedad 09/03 (Trazabilidad)**: Ve a la pestaña de Auditoría.
- [ ] **Expectativa**: En la columna "Ejecutor", debe decir claramente **"EJECUCIÓN EN DASHBOARD"**.
- [ ] **Carga de Puntos con Saldo**: Suma puntos a un cliente que ya tenga acumulado.
- [ ] **Expectativa**: Verifica que aparezca el aviso verde: *"★ Incluye $XXX de Puntos a Favor previos"*.

---

## 📱 BLOQUE 2: PRUEBAS EN CELULAR (MÓVIL / PWA)

Una vez que la PC está validada, pasamos al dispositivo móvil para ver la experiencia final del cliente.

### 2.1 Instalación y Primer Contacto
- [ ] Abre la URL en el celular (Safari en iOS o Chrome en Android).
- [ ] **Instalación**: Usa la opción "Compartir" -> "Añadir a pantalla de inicio". Abre la app desde el icono generado.
- [ ] **Login**: Entra con el usuario que creaste en la PC o uno nuevo.

### 2.2 Experiencia Visual y Terminología (Novedad 09/03)
- [ ] Toca el ícono de **Actividad** (historial).
- [ ] **Expectativa**: El saldo acumulado debe figurar como **"Puntos a Favor:"**.
- [ ] **Layout**: Verifica que el texto esté correctamente alineado a la derecha y no se encime con otros elementos.

### 2.3 Notificaciones Push Reales
- [ ] Con la app del celular cerrada (en segundo plano).
- [ ] Desde la PC (Admin), crea una **Campaña Flash** y envíala de inmediato.
- [ ] **Expectativa**: La notificación debe llegar al celular con sonido/vibración.
- [ ] Abre la notificación y verifica que te lleve al **Buzón** de la app.

---

## 🏁 CRITERIOS DE ÉXITO FINALES
- [ ] ¿Los logs de auditoría identifican correctamente quién disparó el motor?
- [ ] ¿Los términos "Saldo a favor" han desaparecido en favor de "Puntos a Favor"?
- [ ] ¿Los toggles de configuración controlan cada cartel de forma independiente?
- [ ] ¿El ciclo de permisos respeta el "Quizás luego" durante toda la sesión?

**Si todo esto se cumple, la versión del 09/03 está lista para producción.**
