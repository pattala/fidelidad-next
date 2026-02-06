---
description: Pendientes y Próximos Pasos
---

# Backlog de Tareas Pendientes

## Funcionalidades Solicitadas (Prioridad para Próxima Sesión)

### 1. Gestión de Cumpleaños
- **Campo de Fecha de Nacimiento**:
    - Agregar campo `birthDate` (o `fechaNacimiento`) al perfil del usuario en Firestore.
    - Modificar formulario de registro (Wizard) para solicitar la fecha.
    - Modificar modal de "Editar Cliente" en Admin Panel para permitir cargar/editar la fecha manualmente.

### 2. Automatización de Cumpleaños
- **Mensaje de Saludo**:
    - Configurar envío automático de mensaje (WhatsApp/Email/Push) en el día del cumpleaños.
- **Premio/Puntos por Cumpleaños**:
    - Crear lógica (posiblemente una Cloud Function o check diario) para asignar puntos extra automáticamente.
    - O bien, generar un "Cupón de Regalo" válido por X días.

## Tareas Técnicas / Mantenimiento
- **Revisión de Logs**: Verificar que los errores de permisos (`limit(1)`) y VAPID Key estén definitivamente resueltos en producción.
- **Validación de UI**: Confirmar que el modal de "Sumar Puntos" ya no se quede pegado en "Procesando...".

## Estado Actual (Checkpoint)
- **Repositorio**: `github.com/pattala/fidelidad-next` (Rama `main`).
- **Último Deploy**: Commit `Backup: Save final state before end of session`.
- **Configuración**: VAPID Key actualizada, reglas de Firestore ajustadas con `limit(1)`.
