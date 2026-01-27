# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next)
- **Backend (API)**: `api/create-user.js` saneada. Guarda DNI, valida unicidad, y normaliza teléfonos para WhatsApp.
- **Frontend (Admin)**: `ClientsPage.tsx` blindado contra crashes (`undefined` names).
    - **Fix Reciente**: Normalización de datos en el Modal de Edición (`nombre`->`name`, `domicilio.components` -> flat fields) para que al editar no se pierdan datos.

## Tareas Pendientes Inmediatas
- Verificar que el deploy con el fix de domicilio funcione correctamente.
- Limpiar cualquier otro punto donde se asuma `name` en lugar de `nombre` si aparecen más casos.

## Notas Técnicas
- **Base de Datos**: Firestore usa campos en español (`nombre`, `telefono`, `domicilio`).
- **Código**: TypeScript usa campos en inglés (`name`, `phone`, flat address fields).
- **Binding**: El mapeo se hace manualmente en `fetchData` y `refreshAndOpen` dentro de `ClientsPage.tsx`. Mantener esto sincronizado es vital.
