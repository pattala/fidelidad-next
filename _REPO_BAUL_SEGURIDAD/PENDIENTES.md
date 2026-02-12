---
description: Pendientes y Próximos Pasos
---

# Backlog de Tareas Pendientes

## Funcionalidades Solicitadas (Prioridad para Próxima Sesión)

### 1. Gestión de Cumpleaños (Implementado)
- **Campo de Fecha de Nacimiento**: ✅ Implementado.
- **Flujo de Acción en Dashboard**: ✅ Implementado (Etapas Notificación -> WhatsApp).
- **Automatización**: ✅ Implementado en Cliente y Manual en Admin.

### 2. Extensión Club Fidelidad (Upgrade v33)
- **Buscador Predictivo**: ✅ Corregido prefix matching (DNI/Socio).
- **UI Rediseño**: ✅ Panel profesional, compacto y alineado con Admin.
- **Promociones**: ✅ Ajuste horario (AR UTC-3) y filtrado de anuncios (solo FIXED/MULTIPLIER).

## Tareas Técnicas / Mantenimiento
- **Revisar lógica de cumpleaños**: Revisar flujo de Dashboard, estados de bloqueo y link de WhatsApp para asegurar robustez total.

- **Revisión de Logs**: Verificar que los errores de permisos (`limit(1)`) y VAPID Key estén definitivamente resueltos en producción.
- **Validación de UI**: ✅ Modal de "Sumar Puntos" rediseñado y funcional.

## Estado Actual (Checkpoint)
- **Repositorio**: `github.com/pattala/fidelidad-next` (Rama `main`).
- **Último Commit**: `Refine panel: Filter INFO promos and shrink UI sizing`.
- **Configuración**: Timezone Argentina forzada en API, extensión compacta (330px).
