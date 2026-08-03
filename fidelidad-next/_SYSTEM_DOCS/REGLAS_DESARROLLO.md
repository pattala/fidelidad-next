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
## 5. Gestión de Versiones, Consola y Compilación/Deploy
- **Incremento Obligatorio**: Con cada subida (push) que incluya mejoras o correcciones en el programa principal o en la Extensión de Navegador, se DEBE incrementar su respectivo número de versión (V.X.X.X o vX.XX).
- **Versiones Independientes**: La Extensión del Navegador posee su propio número de versión/revisión en su archivo `manifest.json` y código interno, independiente de la App Web.
- **Sincronización Total en PWA y Consola**: El número de versión DEBE actualizarse obligatoriamente en `package.json`, en `src/lib/adminConfig.ts` (`APP_VERSION`), en la PWA del cliente (pie del Perfil de usuario `ClientProfilePage.tsx`), en el Panel Administrador y ser impreso en la consola del navegador (`console.log`) al iniciar.
- **Títulos de Compilación y Deploy**: En todos los casos, el número de versión DEBE figurar explícitamente en los títulos de compilación, mensajes de commit (`git commit -m "vX.X.X: ..."`), reportes y notas de despliegue.

## 6. Comportamiento Analítico y Fáctico
- **Prohibición de Especular**: A partir de ahora, el asistente debe actuar de forma analítica y fáctica. Tiene estrictamente prohibido inventar información, especular, adivinar o asumir datos sin verificar.
- **Basado en Hechos**: Todas las respuestas deben basarse únicamente en hechos verificables (logs, bases de datos reales, código). Si la respuesta no se conoce con total certeza o no se encuentran fuentes confiables en el sistema o internet, se debe decir obligatoriamente *"No tengo esa información confirmada"* en lugar de adivinar.
- **Objetividad**: El asistente debe ser conciso y objetivo en sus respuestas.
- **Búsqueda Continua**: Siempre se debe buscar en internet (cuando aplique) si hay actualizaciones, contexto o información nueva sobre el tema antes de responder.

## 7. Visión Global de Negocio en los Análisis
- **Análisis Holístico**: Al realizar cualquier análisis comercial, estratégico o de diseño, la evaluación debe hacerse SIEMPRE desde la Visión Global del Negocio (considerando el ciclo de vida completo del cliente, la ganancia neta acumulada previa y la fluidez de la experiencia en el mostrador), evitando diagnósticos aislados o encasillados por transacción.

## 8. Arquitectura Marca Blanca (White-Label)
- **Títulos Genéricos y Universales**: Todos los títulos, etiquetas, encabezados e indicadores visuales de la aplicación deben ser 100% genéricos (ej: "Costo de Premios", "Valor Mostrador", "Deuda Potencial (Costo)", "Deuda Potencial (Mostrador)"), sin utilizar términos específicos de un rubro comercial en particular.


