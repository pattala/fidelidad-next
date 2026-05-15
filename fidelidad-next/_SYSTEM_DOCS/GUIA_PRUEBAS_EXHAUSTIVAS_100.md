# 🏆 Guía de Prueba Exhaustiva (E2E) 100% - Versión 1.4.83 (Múltiples Vencimientos y Cumpleaños)

Esta prueba es extrema. Vamos a simular que a un mismo usuario le cargamos **dos saldos distintos en fechas distintas**, probaremos múltiples cumpleaños escalonados, y verificaremos Campañas y Mascotas. Todo en una misma línea temporal.

## ⚙️ PASO 0: Configuración del Panel (La Preparación)
Antes de tocar el simulador de tiempo, ve a **Configuración > Reglas** y asegúrate de tener estos valores:
- [ ] **Vencimiento de Puntos:** `15` días.
- [ ] **Aviso de Vencimiento:** `7` días de antelación.
- [ ] **Avisos Reiterados (Itinerancia):** Encendido, intervalo `3` días.
- [ ] **Mascotas:** Días de antelación para alimento: `3` días.

---

## 📅 DÍA 1: La Siembra Inicial (Hoy: 14 de Mayo)
Abre el Simulador de Fecha y ponlo en **14 de Mayo de 2026**.

- [ ] **1. Vencimiento 1:** Búscate a ti mismo (Usuario A) y asímgnate `100` puntos manuales. *(Estos puntos vencerán el **29 de Mayo**).*
- [ ] **2. Cumpleaños Escalonados:**
  - Edita al **Usuario A** y ponle fecha de nacimiento **16 de Mayo**.
  - Edita al **Usuario B** y ponle fecha de nacimiento **18 de Mayo**.
  - Edita al **Usuario C** y ponle fecha de nacimiento **20 de Mayo**.
- [ ] **3. Mascotas:** Edita al **Usuario C** y regístrale compra de alimento hoy (**14 de Mayo**), ciclo de **30 días**. *(El alimento se agota el 13 de Junio. El sistema debería avisar el **10 de Junio**).*
- [ ] **4. Campaña:** Ve a Campañas y crea una campaña Tradicional que arranque el **15 de Mayo**.

---

## 📅 DÍA 2: Lanzamiento de Campaña (15 de Mayo)
Adelanta el Simulador al **15 de Mayo**.
- [ ] Abre la Campanita. Debe aparecer la sección **"📢 CAMPAÑAS ACTIVAS"**.
- [ ] Toca "Descargar CSV (Ver)". Comprueba en la pantalla de campañas que el botón de Difusión está **VERDE (✅)**.
- [ ] Haz clic en el botón de Descarga (📥) y confirma que el Excel se baja perfecto.

---

## 📅 DÍA 3: Cumpleaños Usuario A (16 de Mayo)
Adelanta el Simulador al **16 de Mayo**.
- [ ] Abre la Campanita. Verifica el aviso de cumpleaños del **Usuario A**. Haz clic en WhatsApp para corroborar la plantilla y marca la alerta.

---

## 📅 DÍA 5: Cumpleaños Usuario B (18 de Mayo)
Adelanta el Simulador al **18 de Mayo**.
- [ ] Abre la Campanita. Verifica el aviso de cumpleaños del **Usuario B** (y que el del Usuario A ya no esté en Pendientes).

---

## 📅 DÍA 6: Segunda Siembra de Puntos (19 de Mayo)
Adelanta el Simulador al **19 de Mayo**.
- [ ] **Vencimiento 2:** Búscate a ti mismo (Usuario A) y asímgnate `250` puntos extra. *(Como la regla es de 15 días, estos 250 puntos vencerán el **3 de Junio**).*

---

## 📅 DÍA 7: Cumpleaños Usuario C (20 de Mayo)
Adelanta el Simulador al **20 de Mayo**.
- [ ] Abre la Campanita. Verifica el aviso de cumpleaños del **Usuario C**.

---

## 📅 DÍA 9: El Aviso del Lote 1 (22 de Mayo)
*(Los primeros 100 puntos de A vencen el 29 de Mayo. Avisamos 7 días antes).*
Adelanta el Simulador al **22 de Mayo**.
- [ ] Abre la Campanita. **¡Punto Crítico!** La alerta debe decir que te vencen **100 puntos** (No 350).
- [ ] Haz clic en WhatsApp y verifica que dice: *"Tus 100 puntos están por vencer: 29/05/2026"*.

---

## 📅 DÍA 12: La Itinerancia del Lote 1 (25 de Mayo)
*(22 de Mayo + 3 días de intervalo).*
Adelanta el Simulador al **25 de Mayo**.
- [ ] Abre la Campanita. **¡Punto Crítico!** Aparece el segundo aviso. Debe seguir diciendo que te vencen **100 puntos** el 29 de Mayo.

---

## 📅 DÍA 14: El Aviso del Lote 2 (27 de Mayo)
*(Los 250 puntos de A vencen el 3 de Junio. Avisamos 7 días antes).*
Adelanta el Simulador al **27 de Mayo**.
- [ ] Abre la Campanita. **¡Punto Crítico!** El sistema ahora cambió de objetivo. Te avisa que te vencen **250 puntos**.
- [ ] Verifica en WhatsApp que diga: *"Tus 250 puntos están por vencer: 03/06/2026"*.

---

## 📅 DÍA 16: La Purga del Lote 1 (29 de Mayo)
Adelanta el Simulador al **29 de Mayo**.
- [ ] Ve al Perfil de Usuario A. Su saldo debió bajar de 350 a **250 puntos** (Se purgaron los 100 iniciales porque vencieron hoy).
- [ ] Abre la campanita. La alerta de los 100 puntos **ya no existe**.

---

## 📅 DÍA 17: La Itinerancia del Lote 2 (30 de Mayo)
*(27 de Mayo + 3 días de intervalo).*
Adelanta el Simulador al **30 de Mayo**.
- [ ] Abre la Campanita. Debe aparecer el segundo aviso de los **250 puntos** que vencen el 3 de Junio. 

---

## 📅 DÍA 28: Alerta de Mascota y Fin del Bucle (10 de Junio)
*(Compra de C fue el 14 de Mayo + 30 días = 13 Junio. Aviso 3 días antes = 10 Junio).*
Adelanta el Simulador al **10 de Junio**.
- [ ] Abre la Campanita. Debe aparecer el aviso de alimento del **Usuario C**.
- [ ] **Acción obligatoria:** Haz clic en "ENVIAR WHATSAPP" en la campanita.
- [ ] Adelanta el simulador al **11 de Junio**.
- [ ] **¡Victoria!** La alerta de la mascota **no debe estar**. El bucle fantasma ha sido eliminado.
