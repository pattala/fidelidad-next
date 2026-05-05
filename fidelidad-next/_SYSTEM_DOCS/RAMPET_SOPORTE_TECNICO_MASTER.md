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
*RAMPET Master Documentation - Última Actualización: Abril 2026*
