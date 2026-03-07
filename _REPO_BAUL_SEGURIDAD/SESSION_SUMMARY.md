# Resumen de Sesión - 07/02/2026

## Estado Actual
- **Extensión v25 (Implementada):** Se aplicó el fix de escritura agresiva (`stopImmediatePropagation` y fase de captura) para asegurar el teclado en el buscador.
- **Sincronización Admin (Implementada):** Ahora, al borrar movimientos en el historial del cliente, se limpian también los arrays legacy (`historialPuntos`/`historialCanjes`). Esto garantiza que el Tablero Principal se actualice correctamente.
- **Git:** Todos los cambios están en la rama `main` de GitHub.

## Próximos Pasos (Tras Reiniciar)
1. Verificar si la escritura en la extensión v25 funciona en el ambiente del facturador.
2. Confirmar que el borrado de puntos se refleja en tiempo real en los totales del Admin.

¡Todo guardado! Listo para el reinicio.
