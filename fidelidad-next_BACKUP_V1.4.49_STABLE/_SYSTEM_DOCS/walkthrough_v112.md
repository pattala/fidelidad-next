# Walkthrough de Actualización - V.1.1.2

## Cambios Realizados
1. **Automatización de WhatsApp (ClientsPage.tsx)**:
   - Se implementó la apertura de una pestaña `about:blank` de forma sincrónica al hacer clic en "Confirmar".
   - Al recibir la respuesta de la API, se redirige dicha pestaña al link de WhatsApp. Esto evita el bloqueo de pop-ups.

2. **Persistencia de Días para Clientes Dormidos**:
   - **MetricsPage.tsx**: Se añadió un input y un botón de guardado (ícono de actualización) en la tarjeta de Clientes Dormidos. Ahora guarda el valor en `config/general` en Firestore.
   - **ClientsPage.tsx**: Se sincronizó el input con la base de datos y se añadió también un botón de guardado para consistencia.
   - **Carga de Configuración**: Se mejoró el `useEffect` para asegurar que el valor se cargue correctamente desde Firebase al iniciar.

3. **Unificación de Cálculo de Clientes Dormidos**:
   - En `MetricsPage.tsx`, se cambió el conteo por servidor por un conteo en memoria sobre la lista de usuarios.
   - Ahora incluye a clientes que **nunca han comprado** (`lastPurchaseDate` inexistente), igualando el criterio de la lista de clientes.

4. **Actualización de Versión**:
   - Se incrementó la versión a **V.1.1.2** en `AdminLayout.tsx`.

## Verificación Sugerida
- Verificar que WhatsApp se abra solo tras asignar puntos.
- Verificar que el número de clientes dormidos en la tarjeta de métricas coincida con la lista filtrada.
- Verificar que al cambiar los días y darle a "Guardar", el valor persista tras recargar la página (F5).
