# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next) - 31/01/2026
**Última acción**: Se implementó el control de acceso basado en roles (RBAC) con tres niveles (Admin, Operador, Solo Ver) y se protegieron todas las páginas críticas del administrador.

### Retomando la Sesión (Logros al 31/01/2026):
1.  **Sistema de Permisos (RBAC):**
    *   **Roles Definidos**: `admin` (acceso total), `editor` (operativo sin configuración), `viewer` (solo lectura).
    *   **Protección de IU**: Botones de acción (Crear, Editar, Borrar, Enviar) se ocultan o deshabilitan dinámicamente según el rol.
    *   **Centralización**: `AdminAuthContext` gestiona la lógica de roles globalmente, incluyendo a los `MASTER_ADMINS`.
    *   **Refactor de AuthGuard**: Simplificación de la seguridad de rutas delegando al contexto.

2.  **Documentación Actualizada:**
    *   `MANUAL_DE_USO.md`: Nueva sección (7) sobre jerarquía de roles y gestión de equipo.
    *   `SESSION_SUMMARY.md`: Resumen detallado de las protecciones implementadas.

3.  **Git & CI/CD:**
    *   Todos los cambios han sido commiteados y pusheados a la rama `main` de GitHub.

### Próximos Pasos (Pendiente):
1.  **Refactor de Roles (Futuro)**: El usuario mencionó que la estructura de roles actual podría cambiar más adelante.
2.  **Pruebas de Invitación**: Probar el flujo completo de invitar a un nuevo admin con un rol específico y verificar que sus permisos se apliquen al loguearse.
3.  **Refactor Client Inbox**: Validar la visualización de mensajes automáticos en la PWA.

## Notas Técnicas
- **Base de Datos**: Los roles de admin se almacenan en la colección `admins`. Los emails en `MASTER_ADMINS` (en `adminConfig.ts`) siempre tienen rol `admin`.
- **Compatibilidad**: Se mantiene la normalización de campos (español/inglés) al cargar clientes en las páginas administrativas.
