---
description: Pendientes y Próximos Pasos
---

# Backlog de Tareas Pendientes

## Funcionalidades Solicitadas (Prioridad para Próxima Sesión)

### 1. Gestión de Cumpleaños (Implementado)
- **Campo de Fecha de Nacimiento**: ✅ Implementado.
- **Flujo de Acción en Dashboard**: ✅ Implementado (Etapas Notificación -> WhatsApp).
- **Automatización**: ✅ Implementado en Cliente y Manual en Admin.

## Tareas Técnicas / Mantenimiento
- **Revisar lógica de cumpleaños**: Revisar flujo de Dashboard, estados de bloqueo y link de WhatsApp para asegurar robustez total.

- **Revisión de Logs**: Verificar que los errores de permisos (`limit(1)`) y VAPID Key estén definitivamente resueltos en producción.
- **Validación de UI**: Confirmar que el modal de "Sumar Puntos" ya no se quede pegado en "Procesando...".

## Estado Actual (Checkpoint)
- **Repositorio**: `github.com/pattala/fidelidad-next` (Rama `main`).
- **Último Deploy**: Commit `Backup: Save final state before end of session`.
- **Configuración**: VAPID Key actualizada, reglas de Firestore ajustadas con `limit(1)`.
