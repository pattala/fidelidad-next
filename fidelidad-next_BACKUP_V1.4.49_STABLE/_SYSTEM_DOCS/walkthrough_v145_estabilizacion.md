# 🏁 Checkpoint de Estabilización V.1.4.5

Este documento sirve como guía para las pruebas de usuario y protocolo de reversión tras la limpieza y unificación de lógica realizada el 05 de Mayo.

---

## 🧪 Escenarios de Prueba (Checklist)

### 1. Registro de Socio con Bonos (Unificación)
- **Acción**: Crea un nuevo socio desde el Panel Admin marcando "Bono de Registro" y "Bono de Domicilio".
- **Verificación**:
    - El socio debe recibir los puntos sumados correctamente.
    - **Auditoría**: Debe aparecer un registro tipo `points_mgmt` con el detalle "🎁 Bienvenida al sistema (Registro + Domicilio)".
    - **Vencimiento**: Verifica que la fecha de vencimiento coincida con tus escalas de configuración.

### 2. Motor de Campañas (Restauración)
- **Acción**: Crea una campaña Flash para hoy (o una fecha simulada).
- **Verificación**:
    - Al iniciar sesión en la PWA con un socio, debería aparecer el popup de la campaña.
    - En el Panel Admin -> Campañas, usa el botón "Enviar Ahora" y verifica que no dé error 404.

### 3. Simulador de Fecha Integral
- **Acción**: Adelanta el reloj +30 días en el panel.
- **Verificación**:
    - El reloj de la barra lateral debe mostrar la fecha futura.
    - Las métricas de "Vencimientos Próximos" deben actualizarse según esa nueva fecha.

---

## ⏪ Protocolo de Reversión (Volver Atrás)

Si detectas algún comportamiento inesperado, puedes volver al estado anterior de las siguientes formas:

### A. Vía Git (Recomendado)
Para deshacer todos los cambios de esta sesión y volver a la V.1.4.4:
```bash
git reset --hard 04c6405
git push origin desarrollo --force
```
*(Nota: 04c6405 es el ID del commit anterior a esta limpieza).*

### B. Restauración Manual de Archivos
Si solo quieres recuperar un archivo específico que fue movido:
- **Ubicación de archivos "fantasma"**: `_OLD_BACKUPS/DEPURACION_FINA_MAYO/`
- **Ubicación de credenciales**: `_OLD_BACKUPS/DEPURACION_FINA_MAYO/SECURITY/service-account.json`

---

## 📋 Lista de Archivos Movidos (Limpieza)
Estos archivos ya no están en la raíz ni en `/api`, están en la carpeta de depuración:
- `api/sync-alerts.js`
- `image.png`
- `current_indexes.json`
- `current_indexes_utf8.json`
- `original_vapid.txt`
- `service-account.json`

---
*Punto de Control V.1.4.5 - Estado: Estable y Sincronizado.*
