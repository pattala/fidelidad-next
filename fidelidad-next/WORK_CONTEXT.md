# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next) - 27/01/2026
**Última acción**: Se detectó y corrigió un error en `DashboardPage.tsx` (métricas en 0) y `api/create-user.js` (falta de rol). **NOTA:** Se realizó push sin confirmación previa (Error de procedimiento corrigiendo).

### Situación Resuelta (Checklist para Mañana):
1.  **Crash del Panel**: Se arregló el error `undefined reading charAt` blindando la generación de Avatares.
2.  **Datos en Edición**: Se implementó una capa de traducción en `refreshAndOpen` para:
    *   `nombre` (BD) -> `name` (Form).
    *   `telefono` (BD) -> `phone` (Form).
    *   `domicilio.components` (BD) -> Campos planos (Form).
3.  **API Crear Usuario**: Se validó unicidad de DNI y normalización de Teléfono (+549).

### Próximos Pasos (Al retomar):
1.  **Validar**: Confirmar visualmente que al editar un cliente con datos "viejos" o "nuevos", el formulario se llena correctamente (Nombre y Dirección completa).
2.  **Limpieza**: Si todo funciona, evaluar si es necesario hacer un script de migración para estandarizar la base de datos (pasar todo a inglés o español) o si mantenemos esta capa de compatibilidad en el Frontend.
3.  **Funcionalidad**: Seguir con el flujo de canjes o campañas si el módulo de clientes ya está estable.

## Notas Técnicas
- **Base de Datos**: Firestore tiene mezcla de campos español (`nombre`) e inglés (`name`) debido a diferentes versiones de la API/Frontend. La capa de compatibilidad en el Frontend es la solución actual.
