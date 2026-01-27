# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next) - 27/01/2026
**Última acción**: Se activó el envío forzado de Email y WhatsApp de bienvenida al crear clientes desde el panel, y se agregó la generación de un mensaje persistente en el Inbox para el primer login.

### Situación Resuelta (Checklist para Mañana):
1.  **Crash del Panel**: Se arregló el error `undefined reading charAt` blindando la generación de Avatares.
2.  **Datos en Edición**: Se implementó una capa de traducción en `refreshAndOpen` para:
    *   `nombre` (BD) -> `name` (Form).
    *   `telefono` (BD) -> `phone` (Form).
    *   `domicilio.components` (BD) -> Campos planos (Form).
3.  **API Crear Usuario**: Se validó unicidad de DNI y normalización de Teléfono (+549).

### Retomando la Sesión (Estado de Cierre 27/01/2026):
**Logros de esta sesión:**
1.  **Panel Admin (Clientes):**
    *   Se arregló visualización de direcciones anidadas en la tabla.
    *   El alta manual valida DNI/Email y devuelve errores claros en español.
    *   El alta manual asigna correctamente el rol "client" y los metadatos de domicilio.
2.  **Dashboard:**
    *   Se corrigió el conteo de usuarios (incluye usuarios sin rol explícito).
3.  **App Cliente (PWA Onboarding):**
    *   El flujo de entrada para usuarios creados por panel ahora es: **Login DNI -> Términos y Condiciones (Obligatorio) -> Permisos Notificaciones -> Geolocalización**.
    *   Se guarda aceptación de términos y lat/long en la BD.

### Próximos Pasos (Pendiente):
1.  **Registro Autónomo (PWA):** Analizar y trabajar en el flujo de los usuarios que se registran solos desde la web/app (no cargados por el admin).
2.  **Validación General:** Verificar que el flujo completo (Admin crea -> Usuario entra -> Acepta todo -> Usa la app) no tenga fricción.

## Notas Técnicas
- **Base de Datos**: Firestore tiene mezcla de campos español (`nombre`) e inglés (`name`) debido a diferentes versiones de la API/Frontend. La capa de compatibilidad en el Frontend es la solución actual.
