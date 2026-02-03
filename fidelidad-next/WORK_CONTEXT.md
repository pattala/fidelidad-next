# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next) - 02/02/2026
**Última acción**: Corrección crítica de acceso al Panel Administrativo y actualización de reglas de seguridad para soporte multi-admin.

### Retomando la Sesión (Logros al 02/02/2026):
1.  **Historial de Actividad y Visitas**:
    *   Se creó una subcolección `visit_history` para cada usuario.
    *   Se implementó el registro automático (ping) desde la PWA con control de frecuencia (30 min).
    *   Se creó el componente `VisitHistoryModal.tsx` para visualizar estos datos desde el admin.

2.  **Métricas Financieras y Reportes**:
    *   Se añadió el ranking "Clientes más Fieles (APP)" en la página de métricas.
    *   Se actualizaron los cálculos de "Total Gastado" y "Valor de Canjes".
    *   Exportación Excel (CSV) mejorada con 5 nuevas columnas de datos financieros y formato compatible con Excel.

3.  **Seguridad y Fiabilidad (CRÍTICO)**:
    *   Se corrigieron las `firestore.rules` para incluir la colección `admins` y habilitar el chequeo de roles basado en DB.
    *   **Login Resiliente**: Se modificó `LoginPage.tsx` para evitar bloqueos por falta de permisos durante la verificación inicial del sistema.
    *   Entrada garantizada para Master Admins (`pablo_attala@yahoo.com.ar` y `admin@admin.com`) con auto-creación de documento de perfil si falta.

4.  **Git & Backup**:
    *   Se realizó backup de reglas de seguridad (`firestore.rules.bak`).
    *   Cambios pusheados a la rama `main`.

### Próximos Pasos (Pendiente):
1.  **Refactor de Roles (Futuro)**: El usuario mencionó que la estructura de roles actual podría cambiar más adelante.
2.  **Pruebas de Invitación**: Probar el flujo completo de invitar a un nuevo admin con un rol específico y verificar que sus permisos se apliquen al loguearse.
3.  **Refactor Client Inbox**: Validar la visualización de mensajes automáticos en la PWA.

## Notas Técnicas
- **Base de Datos**: Los roles de admin se almacenan en la colección `admins`. Los emails en `MASTER_ADMINS` (en `adminConfig.ts`) siempre tienen rol `admin`.
- **Compatibilidad**: Se mantiene la normalización de campos (español/inglés) al cargar clientes en las páginas administrativas.
