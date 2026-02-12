# ✅ Checklist de Verificación - Estadísticas y Estabilización (09/02/2026)

Este checklist detalla las correcciones de estabilidad y la nueva arquitectura de estadísticas implementada hoy.

## 📊 1. Sistema de Estadísticas (Nueva Colección Global)
- [ ] **Colección `transactions`**: Verificar en Firebase Console que existe la colección raíz `transactions`. Cada documento debe tener `uid`, `clientName`, `socioNumber`, `points`, `amount`, `concept`, `type` y `date`.
- [ ] **Registro de Canjes**: Realizar un canje de premio y verificar que aparezca en `transactions` con tipo `redemption` (o puntos negativos).
- [ ] **Página de Métricas**:
    - [ ] **Visualización**: Verificar que los gráficos ahora carguen datos desde la colección `transactions`.
    - [ ] **Estado Vacío**: Cambiar el rango a uno sin datos (ej: 30 días si no hubo nada hoy) y verificar que aparezca el mensaje informativo en lugar de una pantalla en blanco.
    - [ ] **Exportación**: Probar el botón **"Exportar CSV"** en Métricas y abrir el archivo para confirmar los datos.

## 🛠 2. Estabilidad de Gestión de Clientes
- [ ] **Asignación Manual de Puntos**:
    - [ ] Abrir el modal de puntos de un cliente.
    - [ ] Ingresar una compra en pesos.
    - [ ] **Verificar Flujo**: El botón debe mostrar "Procesando..." y luego el modal debe cerrarse automáticamente con un mensaje de éxito.
    - [ ] **Protección Anti-Bloqueo**: Forzar un error (ej: desconectar internet momentáneamente) y verificar que al fallar el botón vuelva a su estado normal (no se quede bloqueado).
- [ ] **Notificaciones y WhatsApp**:
    - [ ] Al asignar puntos, verificar que el mensaje de WhatsApp abra la URL de API correctamente.
    - [ ] Comprobar que los campos `{saldo}` y `{total_puntos}` no muestren "NaN".
- [ ] **Búsqueda y Filtros**:
    - [ ] Buscar por **Número de Socio** en la tabla. Verificar que sea robusto y coincida con el campo visible.

## 💰 3. Saldo a Favor (Acumulado)
- [ ] **Visualización en Admin**: Verificar que en la tabla de clientes aparezca "+$X a favor" debajo de los puntos si el cliente tiene un remanente.
- [ ] **Persistencia en Carga Manual**: Asignar puntos por monto (ej: $150). Verificar que se asigne 1 punto y queden $50 a favor.
- [ ] **Persistencia en API**: Usar la extensión para cargar un monto con remanente y verificar que se actualice correctamente en el Panel Admin.
- [ ] **Consumo Automático**: Realizar una segunda carga. Verificar que se sume el saldo previo al nuevo monto para el cálculo de puntos.

## 👥 3. Gestión de Clientes (CRUD)
- [ ] **Validaciones**: Intentar crear un cliente con un DNI que ya existe. Verificar que el toast avise del duplicado y **permita corregir** sin cerrar el modal ni bloquearlo.
- [ ] **Número de Socio Automático**: Crear un cliente nuevo sin especificar número. Verificar que el sistema asigne el siguiente ID disponible (ej: 1001, 1002).

## 🧩 4. Extensión Chrome (v31)
- [ ] **Panel Draggable**: Verificar que el panel lateral se pueda arrastrar desde el encabezado.
- [ ] **Transición Búsqueda**: Buscar un cliente, hacer clic en el resultado y verificar que pase directamente al formulario de carga de puntos.
- [ ] **Filtro de Promos**: Verificar que las promociones tipo `INFO` no aparezcan en la lista.

---
*Documentación preparada para el control del 10/02/2026.*
