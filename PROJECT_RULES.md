# Reglas de Trabajo y Constitución del Proyecto 📜

Este documento define las normas OBLIGATORIAS para cualquier agente o desarrollador que trabaje en este repositorio. Ignorarlas es inaceptable.

## 1. Protocolo de Aprobación (Semáforo) 🚦
*   **REGLA:** Antes de escribir una sola línea de código, debo explicarte el plan y esperar tu **"OK" explícito**.
*   **Formato:** "Propongo hacer X, Y, Z. ¿Procedo?".
*   **Prohibido:** Ejecutar cambios silenciosos o asumir aprobaciones tácitas.

## 2. Flujo de Despliegue (GitHub First) 🐙
*   **REGLA:** El camino **único** es: `Local` -> `GitHub` -> `Vercel (Automático)`.
*   **Excepción:** Solo si es una emergencia crítica de infraestructura, puedo *sugerir* ir directo a Vercel, pero **debo preguntar antes**.
*   **Prohibido:** "Bypassear" GitHub por comodidad.

## 3. Enfoque Paso a Paso 👣
*   **REGLA:** Atacar Un (1) problema a la vez.
*   **Prohibido:** "Ya que estoy, arreglo esto otro...". No. Resolver el problema actual, verificar, y recién pasar al siguiente.
*   **Prohibido:** Presuponer o adivinar lógica de negocio. Ante la duda, PREGUNTAR.

## 4. White Label Puro (Marca Blanca) 🏷️
*   **REGLA:** El código fuente debe ser agnóstico.
*   **Prohibido:** Textos "quemados" (Hardcoded) como "Bienvenido a Coca-Cola".
*   **Fuente de Verdad:** Todo texto, color o marca debe venir de **Firebase** (Colecciones `config`, `plantillas`) o archivos de configuración.

## 5. Validación Estricta ✅
*   Las reglas de negocio definidas (ej: Validaciones de domicilio) se cumplen estrictamente. No se "relajan" validaciones por decisión propia del agente.

## 6. Proyecto 100% FREE (Costo Cero) 💸
*   **REGLA:** Todas las herramientas, APIs y servicios utilizados deben pertenecer a sus planes gratuitos de forma permanente.
*   **WhatsApp:** Se debe usar EXCLUSIVAMENTE redirección por enlaces (`api.whatsapp.com/send` o `wa.me`) para evitar el uso de gateways de pago (Twilio, Meta Business API, etc.).
*   **Infraestructura:** Firebase (Spark), Vercel (Hobby) y proveedores de Email deben mantenerse dentro de los límites gratuitos.
*   **Prohibido:** Sugerir servicios que requieran tarjeta de crédito o suscripción mensual para la funcionalidad core.

---
*Última actualización: 30/01/2026*
