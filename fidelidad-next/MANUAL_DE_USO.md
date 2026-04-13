# 📘 Manual Operativo Integral - Sistema de Fidelización

Este documento es la guía definitiva para la operación, configuración y estrategia del sistema de fidelización.

---

## 📑 Índice de Contenidos

1. [Introducción al Ecosistema](#1-introducción-al-ecosistema)
2. [Estrategia Financiera: El Valor del Punto](#2-estrategia-financiera-el-valor-del-punto)
   - [¿Manual o Automático? ¿Cuál me conviene?](#manual-o-automático)
   - [Cálculo de Rentabilidad](#cálculo-de-rentabilidad)
3. [Operación Diaria: Gestión de Clientes](#3-operación-diaria-gestión-de-clientes)
   - [Paso a Paso: Alta de Cliente](#paso-a-paso-alta-de-cliente)
   - [Paso a Paso: Carga de Puntos y Lógica](#paso-a-paso-carga-de-puntos-y-lógica)
   - [Paso a Paso: Canje de Premios (FIFO)](#paso-a-paso-canje-de-premios-fifo)
4. [Masterclass de Campañas y Promociones](#4-masterclass-de-campañas-y-promociones)
   - [Tipo 1: Multiplicadores (ej. "Doble Puntos")](#tipo-1-multiplicadores)
   - [Tipo 2: Bonos Fijos (ej. "Premio por Visita")](#tipo-2-bonos-fijos)
5. [Mensajería y Enlaces Externos](#5-mensajería-y-enlaces-externos)
   - [Cómo funciona el motor de WhatsApp](#cómo-funciona-el-motor-de-whatsapp)
6. [Solución de Problemas](#6-solución-de-problemas)
7. [Gestión de Roles y Permisos](#7-gestión-de-roles-y-permisos)
8. [Mantenimiento Avanzado: Reset Maestro](#8-mantenimiento-avanzado-reset-maestro)
9. [Anexo: Automatización con la Extensión](#9-anexo-automatización-con-la-extensión)

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
![Listado de Clientes](./assets/clientes.png)
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

## 5. � Mensajería y Enlaces Externos

El sistema no envía los WhatsApps por sí mismo (para evitar bloqueos de Meta/Facebook), sino que genera **Enlaces Inteligentes**.

### Cómo funciona el motor de WhatsApp
1.  Usted configura una "Plantilla" en Configuración (ej. "Hola {nombre}, sumaste {puntos}!").
2.  Cuando carga puntos, el sistema detecta si está en PC o Celular.
3.  Abre automáticamente `api.whatsapp.com/send...` con el mensaje ya escrito y el número del cliente precargado.
4.  Usted solo presiona "Enviar" en su WhatsApp.

**Tip Pro:** En esos mensajes puede incluir el link a su PWA (`su-negocio.app`) para que el cliente entre a ver su saldo inmediatamente.

---

## 6. � Solución de Problemas

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
    *   Acciones de CRUD completas en todas las áreas.

#### B. Operador (editor)
Ideal para encargados de local o personal administrativo.
*   **Permisos:**
    *   Gestión de Clientes (Alta, edición, carga de puntos y canjes).
    *   Gestión de Premios (Crear y editar catálogo).
    *   Gestión de Campañas y Notificaciones.
*   **Restricciones:** No puede entrar a "Configuración" ni gestionar otros usuarios.

#### C. Solo Ver (viewer)
Ideal para auditorías o pasivistas que necesitan consultar datos sin el riesgo de modificarlos.
*   **Permisos:** Puede navegar por todas las pantallas (excepto configuración) para consultar saldos, historiales y estadísticas.
*   **Restricciones:** Todos los botones de "Guardar", "Eliminar", "Nuevo", "Sumar Puntos" o "Enviar" están deshabilitados. No puede realizar ninguna acción que altere la base de datos.

### Gestión de Equipo
Para gestionar el acceso de su equipo, diríjase a **Mi Perfil > Gestión de Equipo**.
1.  **Invitar Invitado:** Ingrese el email del colaborador y asigne el rol correspondiente.
2.  **Activación:** El invitado recibirá una notificación (según el flujo de onboarding) y podrá registrarse usando ese mismo email para activar sus permisos.
3.  **Revocación:** El administrador principal puede eliminar el acceso de cualquier miembro en cualquier momento.

---
*Manual Operativo Avanzado v2.1 (Roles & Permissions update)*

---

## 8. 🔴 Mantenimiento Avanzado: Reset Maestro

Ubicado en **Configuración > Avanzado**, el Reset Maestro es una herramienta de "limpieza profunda" de la base de datos. Se utiliza principalmente para pasar de una etapa de pruebas a producción o para corregir desfasajes masivos de datos.

### 👥 Grupo: Socios (Datos de Clientes)

*   **SOCIOS TOTAL**: ⚠️ **Eliminación Definitiva.** Borra todos los clientes de la base de datos, sus puntos, historiales y elimina sus cuentas de acceso al sistema (Firebase Authentication).
    *   *Uso:* Vaciar el sistema por completo para empezar una nueva base de datos.
*   **SOCIOS HISTORIAL**: **Limpieza de Saldos.** Mantiene a los clientes creados pero vacía sus historiales de puntos y pone sus saldos en 0.
    *   *Uso:* Reiniciar la contabilidad sin perder la lista de contactos de clientes actuales.
*   **SOCIOS MENSAJES**: Borra todas las notificaciones e ítems recibidos en el buzón (Inbox) de los clientes.
*   **GEO TOTAL**: Borra los registros acumulados de geolocalización de los clientes.
*   **TRANSACCIONES TOTAL**: Elimina el registro global de transacciones financieras del sistema.

### ⚙️ Grupo: Estructura (Personalización)

*   **MARCA TOTAL**: Restablece los colores originales (azul/blanco) y elimina la URL del logo personalizado, dejando el logo por defecto.
*   **GAMIFICATION TOTAL**: Restaura los valores estándar de "Reglas del Juego" (monto por punto, bono de bienvenida, etc.).
*   **PRIZES TOTAL**: Vacía el catálogo de premios (Premios > Activos).
*   **CAMPAIGNS TOTAL**: Elimina todas las campañas de marketing creadas.
*   **TEAM TOTAL**: Elimina a todos los administradores secundarios, manteniendo solo su usuario actual y el acceso maestro administrativo.
*   **LEGALES TOTAL**: Restablece el texto de Términos y Condiciones a la plantilla legal básica.
*   **AUDIT TOTAL**: Borra el libro de auditoría (Registro de quién hizo qué en el panel).

> [!CAUTION]
> **Estas acciones son irreversibles.** El sistema siempre le pedirá escribir la palabra `RESET` en mayúsculas para confirmar que está seguro de lo que va a ejecutar.

---
*Actualizado v2.2 (Reset Maestro Documentation)*

---

## 🛠️ Anexo Técnico: Actualización del Sistema (Git Workflow)

Para que usted pueda subir cambios sin depender de asistencia técnica directa, siga estos pasos en su terminal:

### 1. Subir al Laboratorio (Fidelidad)
*Para probar antes de lanzar a clientes:*
1.  `git add .`
2.  `git commit -m "mensaje descriptivo"`
3.  `git push origin desarrollo`

### 2. Actualización Masiva (Todos los Clientes)
*Para que el cambio llegue a Franccesca y demás:*
1.  `git checkout main`
2.  `git merge desarrollo`
3.  `git push origin main`
4.  `git checkout desarrollo` (Para volver a modo prueba)

---

## 9. 🤖 Anexo: Automatización con la Extensión

La extensión de Chrome automatiza la captura del total y la resta de descuentos en sistemas como **Sky Facturación**.
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
![Listado de Clientes](./assets/clientes.png)
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

## 5.  Mensajería y Enlaces Externos

El sistema no envía los WhatsApps por sí mismo (para evitar bloqueos de Meta/Facebook), sino que genera **Enlaces Inteligentes**.

### Cómo funciona el motor de WhatsApp
1.  Usted configura una "Plantilla" en Configuración (ej. "Hola {nombre}, sumaste {puntos}!").
2.  Cuando carga puntos, el sistema detecta si está en PC o Celular.
3.  Abre automáticamente `api.whatsapp.com/send...` con el mensaje ya escrito y el número del cliente precargado.
4.  Usted solo presiona "Enviar" en su WhatsApp.

**Tip Pro:** En esos mensajes puede incluir el link a su PWA (`su-negocio.app`) para que el cliente entre a ver su saldo inmediatamente.

---

## 6.  Solución de Problemas

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
    *   Acciones de CRUD completas en todas las áreas.

#### B. Operador (editor)
Ideal para encargados de local o personal administrativo.
*   **Permisos:**
    *   Gestión de Clientes (Alta, edición, carga de puntos y canjes).
    *   Gestión de Premios (Crear y editar catálogo).
    *   Gestión de Campañas y Notificaciones.
*   **Restricciones:** No puede entrar a "Configuración" ni gestionar otros usuarios.

#### C. Solo Ver (viewer)
Ideal para auditorías o pasivistas que necesitan consultar datos sin el riesgo de modificarlos.
*   **Permisos:** Puede navegar por todas las pantallas (excepto configuración) para consultar saldos, historiales y estadísticas.
*   **Restricciones:** Todos los botones de "Guardar", "Eliminar", "Nuevo", "Sumar Puntos" o "Enviar" están deshabilitados. No puede realizar ninguna acción que altere la base de datos.

### Gestión de Equipo
Para gestionar el acceso de su equipo, diríjase a **Mi Perfil > Gestión de Equipo**.
1.  **Invitar Invitado:** Ingrese el email del colaborador y asigne el rol correspondiente.
2.  **Activación:** El invitado recibirá una notificación (según el flujo de onboarding) y podrá registrarse usando ese mismo email para activar sus permisos.
3.  **Revocación:** El administrador principal puede eliminar el acceso de cualquier miembro en cualquier momento.

---
*Manual Operativo Avanzado v2.1 (Roles & Permissions update)*

---

## 8. 🔴 Mantenimiento Avanzado: Reset Maestro

Ubicado en **Configuración > Avanzado**, el Reset Maestro es una herramienta de "limpieza profunda" de la base de datos. Se utiliza principalmente para pasar de una etapa de pruebas a producción o para corregir desfasajes masivos de datos.

### 👥 Grupo: Socios (Datos de Clientes)

*   **SOCIOS TOTAL**: ⚠️ **Eliminación Definitiva.** Borra todos los clientes de la base de datos, sus puntos, historiales y elimina sus cuentas de acceso al sistema (Firebase Authentication).
    *   *Uso:* Vaciar el sistema por completo para empezar una nueva base de datos.
*   **SOCIOS HISTORIAL**: **Limpieza de Saldos.** Mantiene a los clientes creados pero vacía sus historiales de puntos y pone sus saldos en 0.
    *   *Uso:* Reiniciar la contabilidad sin perder la lista de contactos de clientes actuales.
*   **SOCIOS MENSAJES**: Borra todas las notificaciones e ítems recibidos en el buzón (Inbox) de los clientes.
*   **GEO TOTAL**: Borra los registros acumulados de geolocalización de los clientes.
*   **TRANSACCIONES TOTAL**: Elimina el registro global de transacciones financieras del sistema.

### ⚙️ Grupo: Estructura (Personalización)

*   **MARCA TOTAL**: Restablece los colores originales (azul/blanco) y elimina la URL del logo personalizado, dejando el logo por defecto.
*   **GAMIFICATION TOTAL**: Restaura los valores estándar de "Reglas del Juego" (monto por punto, bono de bienvenida, etc.).
*   **PRIZES TOTAL**: Vacía el catálogo de premios (Premios > Activos).
*   **CAMPAIGNS TOTAL**: Elimina todas las campañas de marketing creadas.
*   **TEAM TOTAL**: Elimina a todos los administradores secundarios, manteniendo solo su usuario actual y el acceso maestro administrativo.
*   **LEGALES TOTAL**: Restablece el texto de Términos y Condiciones a la plantilla legal básica.
*   **AUDIT TOTAL**: Borra el libro de auditoría (Registro de quién hizo qué en el panel).

> [!CAUTION]
> **Estas acciones son irreversibles.** El sistema siempre le pedirá escribir la palabra `RESET` en mayúsculas para confirmar que está seguro de lo que va a ejecutar.

---
*Actualizado v2.2 (Reset Maestro Documentation)*

---

## 🛠️ Anexo Técnico: Actualización del Sistema (Git Workflow)

Para que usted pueda subir cambios sin depender de asistencia técnica directa, siga estos pasos en su terminal:

### 1. Subir al Laboratorio (Fidelidad)
*Para probar antes de lanzar a clientes:*
1.  `git add .`
2.  `git commit -m "mensaje descriptivo"`
3.  `git push origin desarrollo`

### 2. Actualización Masiva (Todos los Clientes)
*Para que el cambio llegue a Franccesca y demás:*
1.  `git checkout main`
2.  `git merge desarrollo`
3.  `git push origin main`
4.  `git checkout desarrollo` (Para volver a modo prueba)

---

## 9. 🤖 Anexo: Automatización con la Extensión

La extensión de Chrome automatiza la captura del total y la resta de descuentos en sistemas como **Sky Facturación**.

### Lógica de Detección de Descuentos
El sistema busca penalizar el monto base para los puntos restando automáticamente cualquier ítem que reduzca el total de la factura.

#### Palabras Clave Detectadas
La extensión busca las siguientes palabras en la descripción de cada fila para identificar descuentos:
- **DESCUENTO**
- **PROMO**
- **COMBO**
- **BONIF** (Bonificación)

> [!NOTE]
> **¿Mayúsculas o Minúsculas?** Es indistinto. El sistema convierte todo a mayúsculas internamente para comparar, por lo que detectará tanto "Combo", "combo" como "COMBO".

#### Detección de Montos Negativos
El sistema identifica montos que restan en la columna de **Total por Ítem** mediante:
- Signo menos delante: `-500,00`
- Entre paréntesis: `(500,00)`

#### Factor K: Recuperación por Descuentos
Para evitar que el cliente pierda incentivo de fidelidad al usar un descuento, se puede configurar el **Factor K** en el panel de Administración.
- **¿Qué hace?**: Calcula cuántos puntos se "perdieron" debido al descuento y devuelve un porcentaje al cliente.
- **Ejemplo**: Si el cliente usa un combo que descuenta $5.000 (que valdrían 50 puntos) y el Factor K es **10%**, el cliente recibirá **5 puntos extra** como "Bono Descuento".
- **Visualización**: La extensión mostrará el desglose como: `Puntos Base + Bono Descuento (K)`.

#### Cómo agregar más palabras clave (Técnico)
Si en el futuro aparecen nuevos tipos de combos o descuentos, un técnico puede agregarlos editando el archivo `extension-club-fidelidad/content.js`.
1. Localizar la función `detectAmount`.
2. Buscar el bloque marcado como `--- CONFIGURACIÓN DE PALABRAS CLAVE ---`.
3. Añadir la nueva palabra siguiendo el formato: `|| rowText.includes('NUEVA_PALABRA')`.

---
*Manual Operativo v2.3 (Extension Automation Update)*
