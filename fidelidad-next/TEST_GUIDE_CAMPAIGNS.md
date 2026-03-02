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
