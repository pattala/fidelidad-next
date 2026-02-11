# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next) - 10/02/2026
**Última acción**: Unificación de mensajería (Push, Email, WhatsApp e Inbox) y activación de Dashboard en tiempo real.

### Retomando la Sesión (Logros al 10/02/2026):
1.  **Dashboard & Métricas**:
    *   **Tiempo Real Total**: El Tablero Principal ahora es 100% reactivo usando `onSnapshot`. Se eliminó el botón de "Refrescar" ya que los KPIs (Puntos, Ventas, Usuarios) se actualizan al instante.
    *   **Exportación Optimizada**: El reporte de métricas ahora se descarga con separador de punto y coma (`;`) y formato de números español (coma para decimales), listo para Excel sin configuraciones adicionales.

2.  **Mensajería & Notificaciones (UNIFICACIÓN)**:
    *   **Plantillas Únicas**: Se refactorizó `assign-points.js` para que todos los canales (Push, Email, WhatsApp e Inbox) consuman la misma plantilla configurada en el panel administrador.
    *   **Depuración de Código**: Eliminado el código "fantasma" que generaba mensajes duplicados en el Inbox o textos hardcodeados.
    *   **Corrección de Auth (401)**: Solucionado el problema de autorización en las llamadas internas entre APIs (Vercel) que impedía el envío de Emails y Push.
    *   **Emails**: Corregido el error de "doble layout" que rompía el diseño visual de los correos.

3.  **Extensión de Chrome**:
    *   **Paridad con el Panel**: La extensión ahora dispara los mismos eventos de notificación (Email/Push) que el panel administrativo, respetando las configuraciones globales.

### Próximos Pasos (Pendiente de Verificación):
1.  **Validación de Mensajería**: Verificar mañana con el usuario que los textos recibidos en todos los canales coinciden exactamente con lo configurado en el panel.
2.  **Limpieza de Base de Datos**: Pendiente borrar la colección `users` y Auth para el lanzamiento final.

## Notas Técnicas
- **Base de Datos**: Los roles de admin se almacenan en la colección `admins`. Los emails en `MASTER_ADMINS` (en `adminConfig.ts`) siempre tienen rol `admin`.
- **Reglas del Firestore**: El código fuente de las reglas reside en `firestore.rules` en la raíz del proyecto.
- **Geolocalización**: Se añadió un toggle en el perfil para que el usuario gestione sus permisos de ubicación.
