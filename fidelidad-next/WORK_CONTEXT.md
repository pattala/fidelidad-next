# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next) - 30/01/2026
**Última acción**: Se corrigió el error de lógica en `ClientsPage.tsx` que impedía la creación de nuevos clientes y se desplegó a GitHub (`main`) para disparar el redeploy en Vercel.

### Retomando la Sesión (Logros al 30/01/2026):
1.  **Panel Admin (Clientes) - FIX CRÍTICO:**
    *   Se separó la lógica de "Actualización" de la de "Creación" en `handleSave` (estaban anidadas incorrectamente).
    *   Se automatizaron las notificaciones de bienvenida (Email, WhatsApp, Push e Inbox) respetando la configuración de canales habilitados (`isChannelEnabled`).
    *   Se integró el `NotificationService.sendToClient` para centralizar mensajes en el Inbox.

2.  **Infraestructura:**
    *   Se verificó la configuración de variables de entorno en Vercel (SMTP, API Keys).
    *   Deploy exitoso a la rama `main`.

### Próximos Pasos (Pendiente):
1.  **Prueba de Flujo Completo**: Crear un cliente real, recibir el email y entrar a la PWA para ver el Inbox.
2.  **Registro Autónomo (PWA)**: Trabajar en el flujo de usuarios que se registran por su cuenta (Onboarding completo).
3.  **Refactor Client Inbox**: Asegurar que todos los tipos de mensajes (bienvenida, premios, puntos) se rendericen correctamente tras los cambios.

## Notas Técnicas
- **Base de Datos**: Firestore tiene mezcla de campos español (`nombre`) e inglés (`name`) debido a diferentes versiones de la API/Frontend. La capa de compatibilidad en el Frontend es la solución actual.
