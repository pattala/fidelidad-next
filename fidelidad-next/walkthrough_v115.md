# Walkthrough de Actualización - V.1.1.5

## Cambios Realizados
1. **Corrección de Error Visual (ClientsPage.tsx)**:
   - Se importó el icono `RefreshCw` que faltaba, lo que soluciona la pantalla blanca (ReferenceError) al intentar cargar la lista de clientes.

2. **Unificación de Métricas de Dormidos (MetricsPage.tsx)**:
   - Se modificó la consulta a la base de datos para incluir a todos los socios (no solo los que tienen puntos > 0). 
   - Esto asegura que el contador de clientes dormidos en las tarjetas de métricas coincida exactamente con lo que se ve en la lista filtrada, independientemente de si tienen puntos acumulados o no.

3. **Actualización de Versión**:
   - Se incrementó la versión a **V.1.1.5** en `AdminLayout.tsx`.

## Verificación Sugerida
- Entrar a la lista de **Clientes** y verificar que cargue correctamente y que el botón de guardado de días funcione.
- Comparar el número de clientes dormidos en las tarjetas de **Métricas** con el total de la lista filtrada por "Dormidos" para asegurar que coincidan.
