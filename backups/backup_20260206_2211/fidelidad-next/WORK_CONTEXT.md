# Contexto de Trabajo y Reglas del Proyecto

## Reglas Operativas
1.  **Git & Deploy**: **Yo (el asistente) soy el responsable de ejecutar los comandos de git (`git add`, `git commit`, `git push`)**.
    *   **Regla de Oro**: Siempre debo CONSULTARTE y pedir confirmación antes de ejecutar el `push` o una secuencia de deploy.
    *   No debo pedirte que tú escribas los comandos; yo los preparo y los ejecuto tras tu "sí".

## Estado Actual del Proyecto (Fidelidad Next) - 06/02/2026
**Última acción**: Corrección integral de la PWA (campanita, edición de perfil completo, estabilidad de sesión) y panel de administración en tiempo real.

### Retomando la Sesión (Logros al 06/02/2026):
1.  **Mejoras Críticas en PWA**:
    *   **Notificaciones**: Campanita funcional con contador real de mensajes (`inbox`) y animación de pulso. Se vinculó la carga de puntos del admin con el envío automático de notificación al inbox.
    *   **Edición de Perfil**: El usuario ahora puede editar todos sus datos (Nombre, Teléfono, Provincia, Localidad, CP, Dirección completa) desde la App.
    *   **Estabilidad de Sesión**: Se solucionó el "bucle de logout" al refrescar o cambiar de pestaña mejorando la sincronización de Auth y Roles.
    *   **Términos y Condiciones**: Restaurado texto original en un modal interno (sin enlaces externos).
    *   **Carrusel Táctil**: Implementado soporte para deslizamiento manual (swipe/drag).

2.  **Panel de Administración**:
    *   **Tiempo Real**: Implementado `onSnapshot` en la lista de clientes; los nuevos registros aparecen al instante sin refrescar.
    *   **Dirección unificada**: El campo `calle` ahora guarda automáticamente "Calle + Número" para facilitar la lectura del administrador.
    *   **Visualización de Socios**: Corrección en la visualización de `socioNumber` / `numeroSocio` en todas las tablas.

3.  **Backend & Firebase (Seguridad)**:
    *   **Asignación de Socio**: La API `/api/assign-socio-number` ahora es compatible con registros directos desde la PWA mediante tokens de identidad de Firebase.
    *   **Firestore Rules (CRÍTICO)**: Se actualizaron las reglas para permitir acceso al `inbox`, `points_history` y subcolecciones de geolocalización.
    *   **NOTA RECORDA**: Las reglas de Firestore deben pegarse MANUALLY en la consola de Firebase cada vez que se actualicen, ya que el asistente no tiene acceso directo a la publicación de reglas en la nube.

### Próximos Pasos (Pendiente):
1.  **Limpieza de Base de Datos**: El usuario planea borrar la colección `users` y usuarios de Auth para empezar de cero una vez que el despliegue en Vercel sea 100% estable.
2.  **Pruebas de Push Real**: Verificar que las notificaciones FCM (notificación de sistema del celular) lleguen incluso con la App cerrada.

## Notas Técnicas
- **Base de Datos**: Los roles de admin se almacenan en la colección `admins`. Los emails en `MASTER_ADMINS` (en `adminConfig.ts`) siempre tienen rol `admin`.
- **Reglas del Firestore**: El código fuente de las reglas reside en `firestore.rules` en la raíz del proyecto.
- **Geolocalización**: Se añadió un toggle en el perfil para que el usuario gestione sus permisos de ubicación.
