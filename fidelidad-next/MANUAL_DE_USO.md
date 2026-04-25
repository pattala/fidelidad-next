# 📘 Manual Operativo Integral - Sistema de Fidelización

Este documento es la guía definitiva para la operación, configuración y estrategia del sistema de fidelización.

---

## 📑 Índice de Contenidos

1. [Introducción al Ecosistema](#1-introducción-al-ecosistema)
2. [Estrategia Financiera: El Valor del Punto](#2-estrategia-financiera-el-valor-del-punto)
3. [Operación Diaria: Gestión de Clientes](#3-operación-diaria-gestión-de-clientes)
4. [Masterclass de Campañas y Promociones](#4-masterclass-de-campañas-y-promociones)
5. [Mensajería y Enlaces Externos](#5-mensajería-y-enlaces-externos)
6. [Solución de Problemas](#6-solución-de-problemas)
7. [Gestión de Roles y Permisos](#7-gestión-de-roles-y-permisos)
8. [Mantenimiento Avanzado: Reset Maestro](#8-mantenimiento-avanzado-reset-maestro)
9. [Anexo: Automatización con la Extensión](#9-anexo-automatización-con-la-extensión)
10. [Guía de Migración: Cambio de URL y Dominio](#10-guía-de-migración-cambio-de-url-y-dominio)
11. [Motor de Notificaciones y Auditoría](#11-motor-de-notificaciones-y-auditoría)

---

## 1. 🌐 Introducción al Ecosistema

El sistema se compone de dos partes vivas:
1.  **Panel de Administración (Usted):** Donde configura las reglas, carga puntos y controla el dinero.
2.  **App de Clientes (PWA):** Lo que ven sus usuarios en el celular. Allí consultan saldo, ven el catálogo y reciben notificaciones.

---

## 2. 💰 Estrategia Financiera: El Valor del Punto

Esta es la configuración más crítica del sistema, ubicada en **Configuración > Valor del Punto**. Determina si su programa es rentable o si está perdiendo dinero.

### ¿Manual o Automático?
El sistema ofrece dos formas de calcular cuánto "vale" realmente un punto y, por ende, cuánto dinero debe "reservar" usted para pagar los canjes futuros (El Pasivo/Deuda).

#### A. Método Manual (Recomendado para empezar)
Usted define arbitrariamente cuánto vale el punto.
*   **Ejemplo:** Configura que **$1000 pesos de venta = 1 punto**.
*   **Ventaja:** Es predecible. Usted sabe que dar 1 punto le "cuesta" un porcentaje fijo de su venta.
*   **Uso:** Ideal si sus precios de productos son estables.

#### B. Método Promedio (Avanzado / Protección de Márgenes)
El sistema calcula el valor del punto basándose en **el costo real de sus premios actuales**.
*   **Fórmula:** `Costo del Premio / Puntos Requeridos = Valor Real del Punto`.
    *   *Ejemplo:* Si una "Cafetera" le cuesta a usted `$50.000` y pide `5000 puntos` por ella, cada punto vale `$10`.

*   **Ventaja:** Si la inflación sube el costo de los premios, el sistema le avisará que su "deuda" en puntos ha aumentado.
*   **El Semáforo del Dashboard:**
    *   Si configura Manual, el Dashboard comparará ambos valores.
    *   🟢 **Verde (Cobertura OK):** Si usted cobra el punto más caro de lo que le cuesta el premio. (Está ganando margen).
    *   🔴 **Naranja (Desfasaje):** Si el premio es más caro que lo que usted está "ahorrando" por punto. **Alerta:** Debe subir la cantidad de puntos requeridos para el canje o cambiar el premio.

---

## 3. 👥 Operación Diaria: Gestión de Clientes

### Paso a Paso: Alta de Cliente
1.  Botón **"+ Nuevo Cliente"**.
2.  **Teléfono:** Fundamental ingresarlo con formato internacional o local completo (ej. 11...), ya que este número alimenta el link de WhatsApp.
3.  **DNI:** Actúa como llave única para que no se dupliquen personas.

### Paso a Paso: Carga de Puntos y Lógica
Aquí ocurre la magia de la fidelización.
1.  Localice al cliente y presione **Asignar Puntos** (Icono Moneda).
2.  **Fecha de Compra:**
    *   Si deja "Hoy", el sistema grabará la **hora exacta actual**. Esto es vital para que el historial cronológico sea coherente.
    *   Si elige una fecha pasada, se grabará a las 12:00 del mediodía de esa fecha.
3.  **Monto ($):** Ingrese cuánto gastó el cliente (ej. $25.000).
4.  **Lógica Interna:**
    *   El sistema divide `Monto / Valor del Punto`. (ej. 25.000 / 100 = 250 puntos).
    *   Luego consulta si hay **Campañas Activas** (ver sección 4) y suma los bonos automáticamente.
    *   Finalmente calcula el **Vencimiento** según las reglas escalonadas (ej. "Si suma más de 5000, vencen en 1 año, sino en 3 meses").

### Paso a Paso: Canje de Premios (FIFO)
El cliente quiere usar sus puntos.
1.  Botón **Canjear** (Icono Regalo).
2.  Seleccione el premio. Si el stock está en 0, el sistema bloqueará el canje.
3.  **Lógica FIFO (First-In, First-Out):**
    *   El sistema NO descuenta puntos del total genérico.
    *   Busca las cargas de puntos más viejas del cliente que aún tengan saldo.
    *   Descuenta de esas cargas específicas.
    *   **¿Por qué?** Para beneficiar al cliente consumiendo primero los puntos que están más cerca de vencerse.
    *   En el historial verá: *"Se usaron 100 puntos (50 del día 1/1 y 50 del día 5/1)".*

---

## 4. 🚀 Masterclass de Campañas y Promociones

Las campañas son reglas automáticas que se activan según el día o la fecha. No necesita activarlas manualmente cada vez.
Vaya a **Campañas > Nueva Campaña**.

### Tipo 1: Multiplicadores (X)
*   **Objetivo:** Incentivar compras en días flojos.
*   **Configuración:**
    *   *Tipo:* "Multiplicador".
    *   *Valor:* "2" (para Doble), "3" (para Triple).
    *   *Días:* Seleccione "Martes".
*   **Resultado:** Si un cliente gasta $100 (1 punto base), el sistema le dará automáticamente **2 puntos**.
*   **Mensaje al Cliente:** En la PWA verá "¡Puntos Dobles Hoy!".

### Tipo 2: Bonos Fijos (+)
*   **Objetivo:** Premiar la visita, sin importar el gasto.
*   **Configuración:**
    *   *Tipo:* "Fijo".
    *   *Valor:* "50".
    *   *Días:* "Sábado".
*   **Resultado:** Cualquier compra ese día suma sus puntos normales **MÁS 50 puntos de regalo**. Ideal para eventos o cumpleaños del negocio.

---

## 5. 💬 Mensajería y Enlaces Externos

El sistema no envía los WhatsApps por sí mismo (para evitar bloqueos de Meta/Facebook), sino que genera **Enlaces Inteligentes**.

### Cómo funciona el motor de WhatsApp
1.  Usted configura una "Plantilla" en Configuración (ej. "Hola {nombre}, sumaste {puntos}!").
2.  Cuando carga puntos, el sistema detecta si está en PC o Celular.
3.  Abre automáticamente `api.whatsapp.com/send...` con el mensaje ya escrito y el número del cliente precargado.
4.  Usted solo presiona "Enviar" en su WhatsApp.

**Tip Pro:** En esos mensajes puede incluir el link a su PWA (`su-negocio.app`) para que el cliente entre a ver su saldo inmediatamente.

---

## 6. 🛠️ Solución de Problemas

### 1. "Borré un canje pero el saldo no coincide"
El sistema está diseñado para recalcular todo. Si elimina un movimiento del historial (con el tacho de basura rojo), el sistema hace la operación inversa automáticamente (si borra un canje, le devuelve los puntos al cliente; si borra una carga, se los quita).

### 2. "Tengo datos basura o pruebas viejas"
En el modal de historial, abajo a la izquierda, use el botón rojo **"Resetear Todo"**.
*   **Cuidado:** Esto borra ABSOLUTAMENTE TODO el historial de ese cliente y pone su saldo en 0. Úselo solo para limpiar datos de prueba o errores graves de contabilidad.

### 3. "La PWA no muestra los canjes"
Asegúrese de que el cliente tiene conexión a internet y ha actualizado la página. Los canjes aparecen en rojo con el signo negativo (-).

---

## 7. 🔐 Gestión de Roles y Permisos

El sistema cuenta con un esquema de seguridad basado en roles para asegurar que cada miembro del equipo acceda solo a lo que necesita para su función.

### Jerarquía de Roles

#### A. Administrador (admin)
Es el nivel más alto de acceso. Recomendado solo para dueños o gerentes generales.
*   **Permisos Especiales:**
    *   Gestión de Configuración (Valor del punto, expiración, branding).
    *   Gestión de Equipo (Invitar/eliminar otros administradores).
    *   Uso del Simulador de Fecha para pruebas de vencimiento.

#### B. Operador (editor)
Ideal para encargados de local o personal administrativo.
*   **Permisos:** Gestión de Clientes, Premios, Campañas y Notificaciones.
*   **Restricciones:** No puede entrar a "Configuración" ni gestionar otros usuarios.

#### C. Solo Ver (viewer)
Ideal para auditorías o pasivistas que necesitan consultar datos sin modificarlos.
*   **Permisos:** Puede navegar por todas las pantallas (excepto configuración).
*   **Restricciones:** No puede realizar ninguna acción que altere la base de datos (Guardar, Eliminar, Nuevo).

---

## 8. 🔴 Mantenimiento Avanzado: Reset Maestro

Ubicado en **Configuración > Avanzado**, el Reset Maestro es una herramienta de "limpieza profunda".

*   **SOCIOS TOTAL**: ⚠️ **Eliminación Definitiva.** Borra todos los clientes y sus cuentas.
*   **SOCIOS HISTORIAL**: **Limpieza de Saldos.** Mantiene a los clientes pero vacía sus puntos.
*   **AUDIT TOTAL**: Borra el libro de auditoría de acciones del personal.

> [!CAUTION]
> **Estas acciones son irreversibles.** Requiere escribir `RESET` para confirmar.

---

## 9. 🤖 Anexo: Automatización con la Extensión

La extensión de Chrome automatiza la captura del total y la resta de descuentos en sistemas como **Sky Facturación**.

### Lógica de Detección de Descuentos
La extensión busca las palabras **DESCUENTO, PROMO, COMBO, BONIF** en la descripción de cada fila para identificar descuentos y restarlos del total base de puntos.

---

## 10. 🌐 Guía de Migración: Cambio de URL y Dominio

1.  **Firebase:** Autorizar el nuevo dominio en *Authentication > Settings*.
2.  **Vercel:** Agregar el nuevo dominio en la pestaña *Domains*.
3.  **Configuración:** Actualizar la "URL de la App" en el panel de administración.

---

## 11. ⏱️ Motor de Notificaciones y Auditoría

El sistema registra de forma minuciosa y estricta todas las acciones automáticas y manuales en la pantalla **Auditoría**.

### Gatillos de Ejecución y Origen
En la columna de cada registro verá exactamente quién disparó el proceso:
*   **`Sistema (QStash)`**: Procesos disparados automáticamente de madrugada o por eventos del reloj interno.
*   **`Ejecución Manual (Admin)`**: Ejecución forzada al presionar botones en el tablero por un administrador.
*   **`[Nombre del Admin]`**: Ediciones específicas a la base de datos (premios, configuración, carga manual de puntos).
*   **`Ejecución (Extensión)`**: Acciones originadas desde la extensión de Chrome.

### Diccionario de Mensajes de Auditoría

A continuación, se listan todos los mensajes de estado y qué significan:

#### 1. Casos con Novedades (Procesamiento Activo)
| Proceso (Tipo) | Título Principal | Detalle Desplegable |
| :--- | :--- | :--- |
| **Vencimientos** | `Revisión finalizada: 2 procesados, 230 pts restados.` | Nombre del socio, cantidad restada y canales notificados (Inbox/Push/Email). |
| **Cumpleaños** | `Proceso de Cumpleaños: 1 socio detectado hoy.` | Nombre del cumpleañero y adjudicación asignada. |
| **Alertas PetShop** | `Alertas PetShop: 1 aviso enviado hoy.` | Nombre del socio, mascota y alimento correspondiente. |
| **Campañas** | `Difusión automática: Promo 2x1` | Cantidad total de socios alertados por Push/Email. |

#### 2. Días sin Novedades (Casos en Cero)
Cuando el sistema escanea y no encuentra acciones necesarias, no da error, sino que deja estos marcadores explícitos:
| Proceso (Tipo) | Título Principal | Detalle Desplegable |
| :--- | :--- | :--- |
| **Vencimientos** | `Revisión ejecutada: 0 registros para procesar hoy.` | ⚙️ PROCESO DE SISTEMA: Todo al día. No se requirieron acciones. |
| **Cumpleaños** | `Revisión ejecutada: 0 cumpleañeros detectados hoy.` | ⚙️ PROCESO DE SISTEMA: Ningún socio cumple años en la fecha. |
| **Alertas PetShop**| `Alertas PetShop: 0 avisos necesarios hoy.` | ⚙️ PROCESO DE SISTEMA: No se encontraron alertas pendientes de envío hoy. |

#### 3. Auditoría de Mantenimiento Manual
| Acción | Título de Ejemplo |
| :--- | :--- |
| **Crear Premio** | `Premio creado: "Voucher 15% OFF"` |
| **Canjear** | `Canje de Premio para María García` |
| **Regalar Puntos**| `Carga Manual a María García` |

### 🚨 Botones de Ejecución Manual
En la sección de Auditoría, existen botones para disparar procesos manualmente que son fundamentales (sobre todo si usa el Simulador de Fechas):

*   **Botón Rosa (Cumpleaños):** Fuerza la lectura manual de los cumplen hoy, reparte premios y archiva la notificación.  
*   **Botón Naranja (Vencimientos):** Fuerza la revisión de los vencimientos diarios calculados, resta los puntos maduros y archiva la notificación preventiva.

> [!TIP]
> Si dispara los motores **manualmente** desde la pestaña de Auditoría, el sistema pasará por alto los controles estándar de reloj y operará inmediatamente según la fecha que tenga seteada en el simulador.

### 🛡️ Muro de Contención: Control de Duplicidad

El sistema posee un mecanismo estricto para evitar que los procesos envíen correos, mensajes o resten puntos múltiples veces en un mismo día por error de sistema o doble click. Existen dos lugares donde usted interactúa con esta barrera:

1. **En la Configuración General (Panel > Ajustes):** Aquí encuentra el control **Maestro**. Si está activado (Verde), el motor automático de QStash (el que se dispara a la madrugada) está bloqueado por el "Muro". Esto garantiza que si el robot se despierta dos veces el mismo día, la segunda vez rebote pacíficamente.
2. **En la Pantalla de Auditoría (El Switch de Duplicidad):** Este botón rojo/verde **es exactamente la misma variable** que el anterior, pero puesto aquí para su comodidad. Al disparar pruebas manuales, lo usará de la siguiente forma:
   - **Verde (Seguro):** Protegerá las acciones manuales. Si usted aprieta el botón Rosa (Cumpleaños) dos veces seguidas, la segunda fallará discretamente.
   - **Rojo (Ignorarla temporalmente):** Suaviza el escudo temporalmente y le permite a usted (como administrador) presionar los motores múltiples veces en el mismo día. Esto es exclusivo y obligatorio cuando usa el **Simulador de Fechas** y necesita viajar en el tiempo simulando múltiples cierres de mes en una sola tarde de trabajo.

---

## 12. 🚀 Optimización y Performance

Para mantener la PWA rápida y ágil en todos los dispositivos móviles, se recomienda seguir estos estándares al cargar contenido:

### 🖼️ Estándar de Imágenes
*   **Formato:** Utilizar preferentemente **WebP** para fotografías y **SVG** para logos o iconos. El formato WebP reduce el peso hasta un 70% comparado con el JPG tradicional.
*   **Peso Máximo Sugerido:** 
    *   **Logos e Iconos:** < 40KB
    *   **Premios y Promociones:** < 100KB
    *   **Banners Principales:** < 200KB
*   **Dimensiones:** No es necesario cargar imágenes de más de 1200px de ancho. Los celulares optimizan mejor archivos pequeños.

### ⏱️ Carga Diferida (Lazy Loading)
El sistema ha sido optimizado con **Carga Inteligente**. Esto significa que el código pesado de administración (gráficos, métricas, reportes) no es descargado por los celulares de tus socios. Solo vos, cuando entres como Administrador, descargarás esos componentes adicionales.

---
*Manual Operativo Avanzado v2.7 (Performance & PWA Optimization)*
