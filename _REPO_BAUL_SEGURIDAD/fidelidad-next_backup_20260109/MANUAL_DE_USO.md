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
*Manual Operativo Avanzado v2.0*
