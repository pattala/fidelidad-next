# Reglas de Desarrollo - Proyecto Club Fidelidad

Este documento contiene las pautas obligatorias para el desarrollo y mantenimiento del proyecto.

## 1. Flujo de Git y Ramas
- **Rama de Trabajo**: Solo se deben realizar y subir (push) cambios a la rama `desarrollo`.
- **Rama Main**: Está estrictamente prohibido subir cambios directamente a `main` o mergear `desarrollo` a `main` sin autorización expresa previa del usuario después de verificar que la versión en desarrollo es estable.

## 2. Protocolo de Cambios
- **Explicación Previa**: Antes de realizar cualquier modificación en el código, el asistente debe explicar detalladamente qué se va a cambiar y por qué.
- **Autorización**: No se deben aplicar cambios hasta recibir el permiso explícito ("OK", "proceder", etc.), a menos que el usuario indique específicamente que se pueden realizar los cambios "de una" para una tarea concreta.
- **Propuestas**: Siempre se debe priorizar la propuesta de soluciones antes de la ejecución.

## 3. Filosofía de Desarrollo ("No Innovar")
- **Mantener la Estabilidad**: Se debe evitar "innovar" o agregar funcionalidades no solicitadas que puedan alterar el comportamiento actual del sistema sin previo aviso.
- **Proponer antes que Ejecutar**: Si se detecta una mejora potencial o una nueva tecnología, se debe **proponer** primero. No se debe implementar nada nuevo que no haya sido solicitado o validado.

## 4. Documentación y Estilo
- **Comentarios**: Mantener los comentarios existentes en el código.
## 5. Gestión de Versiones
- **Incremento Obligatorio**: Con cada subida (push) que incluya mejoras o correcciones, se DEBE incrementar el número de versión (V.X.X.X).
- **Visibilidad**: El número de versión debe actualizarse en todas las etiquetas visuales de la interfaz (Sidebar, Header, etc.) para que el usuario pueda verificar que está viendo la última versión desplegada.
