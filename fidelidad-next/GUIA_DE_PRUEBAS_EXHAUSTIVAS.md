# 💎 GUÍA DE PRUEBAS MAESTRA (RAMPET PWA)

¡Bienvenido a la guía final! Esta versión está diseñada para ser clara, visual y fácil de seguir. 

> [!IMPORTANT]
> **REGLA DE ORO:** Para cada prueba, usa un **Socio Nuevo**. Si ya lo usaste para una prueba, crea otro para que los contadores estén en cero.

---

## ⚙️ PASO 0: CONFIGURACIÓN MÍNIMA
Antes de tocar nada, asegúrate de que en el **Panel Admin > Mensajería**, los valores sean:
*   **Máx. Intentos PC:** 2  
*   **Máx. Intentos Gloria:** 2  
*   **Re-suscripción:** 30 DÍAS  

---

## 📂 ESCENARIO 1: Registro desde el PANEL ADMIN
*Uso: Cuando tú mismo das de alta al cliente y luego él entra a curiosear.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **1.1** | 🛠️ **Panel Admin** | Ve a **Clientes** -> Botón **+ Nuevo** -> Créalo. | Socio creado con éxito. |
| **1.2** | 💻 **PWA (PC)** | Inicia sesión con ese nuevo socio. | **BUM:** Aparece el **Banner Azul**. |
| **1.3** | 💻 **PWA (PC)** | Haz clic en **"QUIZÁS LUEGO"**. | El banner se va. |
| **1.4** | 💻 **PWA (PC)** | Pulsa **F5** (Refrescar). | **SILENCIO:** No vuelve a salir. |
| **1.5** | 🛠️ **Panel Admin** | Búscalo en la lista y súmale **100 puntos**. | Puntos sumados. |
| **1.6** | 💻 **PWA (PC)** | Mira la pantalla del socio. | **SILENCIO:** No sale nada (Espera el ciclo). |
| **1.7** | 💻 **PWA (PC)** | **Cierra la pestaña**, abre una nueva y logueate. | **BUM:** Re-aparece el **Banner Azul** (Intento 2). |
| **1.8** | 💻 **PWA (PC)** | Haz clic en **"QUIZÁS LUEGO"**. | Desaparece. Agotaste los intentos normales. |
| **1.9** | 🛠️ **Panel Admin** | Súmale otros **100 puntos**. | Puntos sumados. |
| **1.10**| 💻 **PWA (PC)** | Mira la pantalla del socio. | **¡TRIUNFO! Aparece el Momento de Gloria.** |

---

## 📂 ESCENARIO 2: Registro desde la PWA (Computadora)
*Uso: Cuando el cliente llega a tu web y se registra solo.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **2.1** | 💻 **PWA (PC)** | Pulsa **"REGISTRATE"** -> Sigue los pasos -> Acepta Términos. | Entras al Home directamente. |
| **2.2** | 💻 **PWA (PC)** | No toques nada, espera 2 segundos. | **BUM:** Aparece el **Banner Azul**. |
| **2.3** | 💻 **PWA (PC)** | Pulsa **"SÍ, ME INTERESA"** (Damos permisos). | Permisos activados. Contador resetea a 0. |
| **2.4** | 🛠️ **Panel Admin** | Búscalo y súmale **100 puntos**. | Puntos sumados. |
| **2.5** | 💻 **PWA (PC)** | Mira la pantalla del socio. | **¡NUEVO OBJETIVO!** Sale Gloria para **INSTALAR APP**. |

---

## 📂 ESCENARIO 3: Registro desde el CELULAR
*Uso: Cuando el cliente usa su teléfono.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **3.1** | 📱 **PWA (Móvil)** | Registra un socio nuevo desde el celular. | Llegas al Home del celular. |
| **3.2** | 📱 **PWA (Móvil)** | Mira la pantalla. | Aparece el **Banner Azul**. |
| **3.3** | 📱 **PWA (Móvil)** | Pulsa **"QUIZÁS LUEGO"**. | Desaparece. |
| **3.4** | 📱 **PWA (Móvil)** | Cierra y vuelve a abrir la App. | **SILENCIO:** No sale nada (Espera 24hs). |
| **3.5** | 🛠️ **Panel Admin** | En **Mensajería** -> **Simulador de Fecha** -> Pon **+2 días**. | Reloj adelantado. |
| **3.6** | 📱 **PWA (Móvil)** | Abre la App de nuevo en el celular. | **BUM:** El banner azul vuelve a salir. |

---

## 📂 ESCENARIO 4: El Respeto al "NO, GRACIAS"
*Para comprobar que no somos pesados.*

| Paso | ¿Donde estoy? | ¿Qué hago? | ¿Qué debo ver? |
| :--- | :--- | :--- | :--- |
| **4.1** | 💻 **PWA** | En cualquier banner, pulsa el botón **"NO, GRACIAS"**. | Cartel de "Ok, te respetamos por 30 días". |
| **4.2** | 🛠️ **Panel Admin** | Haz lo que quieras: suma puntos, quita puntos... | Lo que sea. |
| **4.3** | 💻 **PWA** | Mira la pantalla. | **SILENCIO TOTAL.** No sale nada por un mes. |

---

> [!TIP]
> **¿Todo listo?** Elige un Escenario y empieza. Si tienes dudas en un paso, ¡pregúntame!
