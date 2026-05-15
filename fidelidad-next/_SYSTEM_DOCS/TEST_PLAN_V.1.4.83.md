# 🧪 Plan de Pruebas: Motor Unificado (V.1.4.83)

Esta es tu hoja de ruta interactiva. A medida que vayas validando cada punto en el servidor de pruebas (o simulador), puedes ir marcando las casillas con una `x` dentro de los corchetes `[x]`, o haciendo clic si tu editor lo permite.

---

### 📥 1. Exportación de CSV para WhatsApp Masivo
*Objetivo: Validar que el botón "Descargar CSV" genera un archivo limpio y listo para usar en extensiones.*

- [ ] **1.1. Localización:** Ir a la pestaña `Campañas` en el Panel de Control.
- [ ] **1.2. Interfaz:** Confirmar que aparece el nuevo botón con el ícono de descarga (📥) al lado del botón de "Difundir/Play".
- [ ] **1.3. Acción:** Hacer clic en el botón de descarga.
- [ ] **1.4. Resultado:** Confirmar que se descarga un archivo llamado `Campaña_[Nombre]_WhatsApp.csv`.
- [ ] **1.5. Datos:** Abrir el archivo CSV en Excel o Google Sheets y confirmar que tiene 3 columnas: `Nombre`, `Telefono` y `Mensaje`.
- [ ] **1.6. Limpieza:** Confirmar que los números de teléfono están formateados correctamente (sin espacios, empezando con 549) y que no se incluyeron usuarios sin número de teléfono.
- [ ] **1.7. Plantilla:** Verificar que el texto del `Mensaje` en el CSV corresponde exactamente a la campaña seleccionada y reemplazó variables como el nombre del cliente.

---

### ✅ 2. Botón Inteligente "Forzar Envío"
*Objetivo: Validar que el sistema avisa visualmente cuando una campaña ya fue procesada hoy.*

- [ ] **2.1. Acción:** Hacer clic en el botón de Difundir (Play) en cualquier campaña.
- [ ] **2.2. Cambio Visual:** Refrescar la página. Verificar que el botón cambió a color verde con un tilde (✅) y el texto (al pasar el mouse) dice "Enviado Hoy (Forzar Re-envío)".
- [ ] **2.3. Doble Envío:** Intentar hacer clic nuevamente en el botón verde.
- [ ] **2.4. Protección:** Confirmar que salta una ventana de confirmación advirtiendo: *"Esta campaña ya fue enviada automáticamente hoy. ¿Estás seguro que deseas FORZAR un re-envío a todos?"*.

---

### 🐾 3. Bucle Fantasma de Mascotas (Burbuja)
*Objetivo: Comprobar que el aviso de alimento desaparece de la campanita una vez que le enviamos el WhatsApp y no vuelve al día siguiente.*

- [ ] **3.1. Generación:** Usar el simulador de fecha para situarse en una fecha donde a un cliente le venza el alimento de mascota.
- [ ] **3.2. Visibilidad:** Verificar que la campanita (abajo a la derecha) se pone en rojo y muestra el aviso de la mascota en la pestaña "PENDIENTES".
- [ ] **3.3. Acción:** Hacer clic en el botón "📳 ENVIAR WHATSAPP" dentro de la tarjeta de ese aviso en la burbuja. (Se abrirá WhatsApp Web, ciérralo).
- [ ] **3.4. Confirmación Inmediata:** Refrescar la página del panel. Verificar que la alerta ya no está en la pestaña "PENDIENTES" (se movió a PROCESADOS o desapareció).
- [ ] **3.5. Prueba de Futuro:** Usar el simulador para adelantar el reloj al día de **mañana**.
- [ ] **3.6. Éxito:** Verificar que el aviso de esa misma compra de alimento **NO** volvió a aparecer en la burbuja.

---

### 📢 4. Alerta Administrativa de Campañas (Burbuja)
*Objetivo: Validar que cuando el motor envía una campaña automáticamente a la madrugada, deja un recordatorio en tu burbuja.*

- [ ] **4.1. Generación Automática:** Crear una campaña que deba lanzarse hoy de forma automática, y ejecutar el motor diario (o hacer clic en "Forzar Envío" para simular que el motor la ejecutó).
- [ ] **4.2. Visibilidad:** Abrir la campanita de alertas en el Panel de Control.
- [ ] **4.3. Nueva Sección:** Verificar que aparece una sección nueva llamada "📢 CAMPAÑAS ACTIVAS" en color azul.
- [ ] **4.4. Acción:** Hacer clic en el botón "📥 DESCARGAR CSV (VER)" en esa alerta.
- [ ] **4.5. Navegación:** Confirmar que te redirige instantáneamente a la pantalla principal de Campañas para que puedas bajar tu archivo.

---

### 💬 5. Unificación Total de Plantillas de WhatsApp
*Objetivo: Asegurar que el texto manual por WhatsApp es exactamente igual al automático.*

- [ ] **5.1. Cumpleaños:** Hacer clic en enviar WhatsApp a un cumpleañero. Validar que dice: *"¡Feliz cumpleaños [Nombre]! 🎂 Que tengas un gran día..."*
- [ ] **5.2. Vencimientos:** Hacer clic en enviar WhatsApp por vencimiento. Validar que dice: *"¡Hola [Nombre]! 📢 Te recordamos que tus [Puntos] puntos están por vencer: [Fecha]..."*
- [ ] **5.3. Mascotas:** Hacer clic en enviar WhatsApp por alimento. Validar que dice: *"¡Hola [Nombre]! 🐾 Notamos que a [Mascota] se le debe estar terminando su alimento Marca: [Marca]."*

---
*Si logras tildar todos estos casilleros, la Versión V.1.4.83 es un éxito absoluto y está lista para operar en el negocio real.*
