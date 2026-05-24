# 📅 Plan de QA Final - Notificaciones & Campañas Estrictas

**Fechas de Ejecución:** 24/05 al 29/05/2026  
**Usuario de Prueba:** Pablo (DNI: 24042610 / o nuevo registro)

---

## ⚙️ VALORES DE CONFIGURACIÓN ACTUALES (en Base de Datos)

| Parámetro | Valor Esperado | Dónde se aplica / Comportamiento |
|-----------|----------------|----------------------------------|
| `expirationWarningDays` | **4 días** | Primer aviso de vencimiento automático (sumado 1 día de espera) |
| `expirationReminderIntervalDays` | **3 días** | Días transcurridos entre el 1º y el 2º aviso |
| `repeatExpirationWarnings` | **true** | Permite el envío del 2º aviso de vencimiento |
| Validez 101-200 pts | **5 días** | Fecha límite para consumir puntos de este rango |
| `petFoodWarningDays` | **3 días** | Días de anticipación para avisar falta de alimento |
| `birthdayPoints` | **50 pts** | Puntos de regalo acreditados automáticamente el día de cumple |

---

## 🚀 SETUP INICIAL - Hacer el 24/05 (Domingo)

### 1. Registrar o verificar el usuario de prueba
- Regístrate en la PWA si no lo has hecho, o verifica que tu usuario exista en **Panel Admin ➡️ Clientes**.
- En **Panel Admin ➡️ Clientes ➡️ [Editar]**:
  - **Nombre:** Pablo
  - **Fecha de Nacimiento:** **26/05/1993** (Configurada para el **26/05**, clave para la prueba del Día 3).
  - **Teléfono:** Tu número real con código de país para probar el envío de notificaciones.

### 2. Configurar la Mascota
En **Panel Admin ➡️ Clientes ➡️ [Tu Socio] ➡️ Mascotas ➡️ Agregar**:
- **Nombre:** Simba
- **Marca:** Purina
- **Ciclo de alimentación:** **7 días** (Crítico para que el aviso de alimento se dispare el **28/05**).
  > 💡 *Compra el 24/05 + ciclo 7 días = Agotamiento el 31/05. Restando 3 días de aviso = Alerta el 28/05.*

### 3. Crear Campaña FLASH de Prueba
En **Panel Admin ➡️ Campañas ➡️ Nueva Campaña**:
- **Tipo:** Flash ⚡
- **Nombre:** `FLASH QA TEST`
- **Título:** `¡Oferta Flash! ⚡`
- **Descripción:** `Descuento exclusivo por pocas horas.`
- **Fecha:** **25/05/2026** (Lunes)
- **Hora inicio:** **00:01**
- **Hora fin:** **23:59**
- **Días habilitados:** Lunes
- **Tolerancia (Gracia):** **0 minutos** (Para validar la tolerancia estricta)
- **Estado:** Activo

### 4. Crear Campaña NORMAL de Prueba
En **Panel Admin ➡️ Campañas ➡️ Nueva Campaña**:
- **Tipo:** Tradicional
- **Nombre:** `NORMAL QA TEST`
- **Título:** `¡Promoción de Mayo! 🎁📢`
- **Fecha inicio:** **29/05/2026**
- **Fecha fin:** **30/05/2026**
- **Estado:** Activo

### 5. Desactivar Campañas Legacy
En **Panel Admin ➡️ Campañas**: Apaga (pasa a **OFF**) cualquier otra campaña que no sean las de este plan para evitar ruidos.

---

## 📅 CRONOGRAMA DÍA A DÍA (Simulación & Motores)

---

### 📅 DÍA 1 - 24/05 (Domingo)   Simulador Offset: 0
**Objetivo:** Registrar al usuario, cargar puntos con vencimiento de bienvenida y asegurar el **silencio de bienvenida** en el Día 1.

#### 1. Acreditación de Puntos:
En **Panel Admin ➡️ Clientes ➡️ [Tu Socio] ➡️ Cargar Puntos**:
- **Monto:** **200 puntos** (Esto define 5 días de validez ➡️ vencen el 29/05).
- **Reponer Alimento:** ✅ Marcar y seleccionar la mascota (Simba).
- **Concepto:** `Compra QA`
- *Verifica en el perfil que figure: "Próximo vencimiento: 29/05/2026 con 200 pts".*

#### 2. Ejecución del Motor:
En **Panel Admin ➡️ Simulador**: Haz clic en **"Ejecutar Motor Diario"** (sin ignorar bloqueos).

#### 🔍 Resultados Esperados:
- **Silencio de Vencimiento de Bienvenida:** No debe generarse ninguna alerta de vencimiento en el panel ni enviarse notificaciones de expiración. 
  > 💡 *Esto es correcto porque hoy es 24/05 y faltan exactamente 5 días para el vencimiento (29/05). Al configurar `expirationWarningDays = 4`, sumamos el día de espera solicitado para evitar el bucle o embudo inmediato de alertas al registrar al usuario.*

---

### 📅 DÍA 2 - 25/05 (Lunes)   Simulador Offset: +1
**Objetivo:** Validar la Campaña Flash, la Tolerancia Estricta de 0 minutos y el **Primer Aviso de Vencimiento**.

#### 1. Cambio de Fecha:
En **Simulador ➡️ [+1 día]** (La fecha del panel pasa al 25/05).

#### 2. Ejecución del Motor:
Ejecuta el **Motor Diario** de forma normal.

#### 🔍 Resultados Esperados:
- **Primer Aviso de Vencimiento (Parchado a 4 días):**
  - **Alerta en Panel Admin:** Alerta de VENCIMIENTO visible con botón individual de WhatsApp.
  - **Push / Inbox PWA:** "⚠️ Tus puntos vencen pronto ⏳ 200 pts el 29/05".
  - **Base de Datos (Firestore):** El campo `lastExpirationWarningDates` en el documento del usuario se actualiza a `{"2026-05-29": "2026-05-25"}`.
  > 💡 *Se activa exitosamente en el Día 2 porque hoy es 25/05 y faltan exactamente 4 días para el vencimiento (29/05).*
- **Campaña Flash:**
  - **Alerta en Panel Admin:** Alerta de CAMPAÑA con botón de "Descargar CSV".
  - **Push / Inbox PWA:** Mensaje de `FLASH QA TEST` a todos los usuarios.

#### ⚡ Test de Tolerancia Estricta (Novedad V1.6.0):
1. Programa una Campaña Flash que finalice en **5 minutos** con **Tolerancia = 0 minutos**.
2. Abre la extensión de Chrome: Verifica que la campaña aparezca activa con la cuenta regresiva normal.
3. Deja pasar la hora exacta de fin:
   - **En la extensión:** Pasa instantáneamente a **"FINALIZADA"** (color rojo).
   - **En el panel:** Cambia de forma inmediata a **"FINALIZADA"**.
4. Intenta acreditar puntos en esa campaña desde la extensión: El sistema debe rechazar la operación inmediatamente por expiración horaria.

---

### 📅 DÍA 3 - 26/05 (Martes)   Simulador Offset: +2
**Objetivo:** Validar saludo de cumpleaños automático y puntos de regalo.

#### 1. Cambio de Fecha:
En **Simulador ➡️ [+1 día]** (La fecha pasa al 26/05).

#### 2. Ejecución del Motor:
Haz clic en **"Ejecutar Motor Diario"**.

#### 🔍 Resultados Esperados:
- **Alerta en Panel Admin:** Alerta de CUMPLEAÑOS con botón individual de WhatsApp.
- **Notificación:** "🎉 ¡Feliz cumpleaños, Pablo!" + Acreditación automática de **50 pts** de regalo.

---

### 📅 DÍA 4 - 27/05 (Miércoles)   Simulador Offset: +3
**Objetivo:** Validar transcurso sin duplicaciones y preparación de alertas siguientes.

#### 1. Cambio de Fecha:
En **Simulador ➡️ [+1 día]** (La fecha pasa al 27/05).

#### 2. Ejecución del Motor:
Haz clic en **"Ejecutar Motor Diario"**.

#### 🔍 Resultados Esperados:
- El día transcurre sin avisos repetidos de vencimiento.
  > 💡 *No se dispara el segundo aviso de vencimiento porque han transcurrido sólo 2 días desde el primer aviso (25/05 al 27/05) y el intervalo es de 3 días.*

---

### 📅 DÍA 5 - 28/05 (Jueves)   Simulador Offset: +4
**Objetivo:** Validar el **Segundo Aviso de Vencimiento** y la **Alerta Predictiva de Alimento de Mascota**.

#### 1. Cambio de Fecha:
En **Simulador ➡️ [+1 día]** (La fecha pasa al 28/05).

#### 2. Ejecución del Motor:
Haz clic en **"Ejecutar Motor Diario"**.

#### 🔍 Resultados Esperados:
- **Segundo Aviso de Vencimiento (Intervalo de 3 días transcurridos):**
  - **Alerta en Panel Admin:** Alerta de VENCIMIENTO en color de advertencia con botón individual.
  - **Push / Inbox PWA:** Segundo recordatorio de vencimiento para el 29/05.
  - **Base de Datos (Firestore):** El campo `lastExpirationWarningDates` en el documento del usuario se actualiza a `{"2026-05-29": "2026-05-28"}`.
  > 💡 *Se dispara porque han pasado exactamente 3 días desde el primer aviso (25/05 al 28/05).*
- **Alerta Predictiva de Alimento:**
  - **Alerta en Panel Admin:** Alerta de MASCOTA (Simba se queda sin Purina).
  - **Push / Inbox PWA:** "🐾 A Simba se le termina el alimento Purina".
  > 💡 *Se calcula: compra 24/05 + ciclo 7 días = fin 31/05 - 3 días de anticipación = 28/05.*

---

### 📅 DÍA 6 - 29/05 (Viernes)   Simulador Offset: +5
**Objetivo:** Validar Campaña Normal y procesamiento de expiración de puntos.

#### 1. Cambio de Fecha:
En **Simulador ➡️ [+1 día]** (La fecha pasa al 29/05).

#### 2. Ejecución del Motor:
Haz clic en **"Ejecutar Motor Diario"**.

#### 🔍 Resultados Esperados:
- **Alerta en Panel Admin:** Alerta de CAMPAÑA (NORMAL QA TEST) con botón CSV.
- **Notificación:** Promoción tradicional visible para todos.
- **Backend:** Los 200 puntos cargados el día 24 expiran automáticamente al final del día.

---

## ⚡ TEST DE AUTO-ARCHIVADO REACTIVO (Novedad V1.6.0)

Esta prueba valida la lógica del panel en tiempo real para archivar alertas vencidas sin interacción del usuario:
1. Configura una campaña Flash que termine en el día de hoy a un horario específico (ej: 21:00).
2. Genera una alerta pendiente de esa campaña (ej: subiendo un CSV de test). Deberá figurar en la pestaña **"Pendientes"** del panel.
3. No refresques la página. Espera a que la hora sobrepase las 21:00 (más los minutos de gracia, si los tiene).
4. **Verificación:** En exactamente 15 segundos, la alerta de la campaña flash vencida debe desaparecer de la pestaña **"Pendientes"** y trasladarse de forma automática a **"Procesados"** en tiempo real.

---

## ⚠️ REGLAS DE ORO PARA EL QA
1. **NO marcar "Ignorar bloqueo diario"** durante el flujo secuencial para probar las restricciones reales de producción.
2. **Un solo clic en "Ejecutar Motor"** por día simulado y esperar el cartel verde de confirmación.
3. **Descargar los archivos CSV** de las campañas en el momento para verificar su contenido antes de avanzar al día siguiente.

---
*Si deseas reiniciar todas las variables y limpiar la base de datos de desarrollo para volver a probar desde cero, recuerda que puedes usar:*  
`node scratch/campaign-clean.js`