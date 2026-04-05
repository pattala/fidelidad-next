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
