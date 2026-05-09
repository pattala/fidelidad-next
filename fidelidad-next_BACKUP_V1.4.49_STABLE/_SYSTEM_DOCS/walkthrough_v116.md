# Walkthrough de Actualización - V.1.1.6

## Cambios Realizados
1. **Trazabilidad de Alertas Pet (api/pet-alerts.js)**:
   - Se añadió un bloque de "Parámetros del Motor" al inicio de cada ejecución en el log de auditoría.
   - Ahora, al desplegar los detalles de un log de `pet_alerts_engine`, aparecerá una sección azul indicando la **Fecha de Referencia** (simulada o real) y el estado del simulador. Esto permite distinguir si un aviso se envió por una prueba de simulación o por el ciclo real del día.

2. **Actualización de Versión**:
   - Se incrementó la versión a **V.1.1.6** en `AdminLayout.tsx`.

## Verificación Sugerida
- Ejecutar el motor de alertas (o esperar a la próxima ejecución automática) y verificar en la **Auditoría** que el log de mascotas ahora incluya el recuadro azul de "Referencia".
