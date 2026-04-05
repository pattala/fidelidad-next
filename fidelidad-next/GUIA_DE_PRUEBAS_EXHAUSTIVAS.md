# 🧪 GUÍA DE PRUEBAS "A PRUEBA DE TODO" (VERSIÓN DEFINITIVA)

Esta guía te lleva de la mano. **Abre dos pestañas:** una con el **Panel Admin** y otra con la **PWA**.

---

## 🛠️ PASO PREVIO: CONFIGURACIÓN (En el Panel Admin)
Antes de empezar cualquier prueba, ve a **Mensajería** y deja estos valores:
- **Máx. Intentos PC:** 2  
- **Máx. Intentos Gloria:** 2  
- **Re-suscripción:** 30 DÍAS  

---

## 📂 ESCENARIO 1: EL SOCIO CREADO POR EL ADMINISTRADOR
*Uso: Cuando tú cargas al cliente manualmente desde tu panel.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? (Resultado) |
| :--- | :--- | :--- | :--- |
| **1.1** | **Panel Admin** | Ve a "Clientes" -> Pulsa "+ Nuevo" -> Crea al socio. | Socio creado con éxito. |
| **1.2** | **PWA (PC)** | Abre la PWA e inicia sesión con ese socio. | **BUM:** Al entrar al Home sale el **Banner Azul**. |
| **1.3** | **PWA (PC)** | Haz clic en **"QUIZÁS LUEGO"**. | El banner desaparece. |
| **1.4** | **PWA (PC)** | Pulsa **F5** (Refrescar página). | **SILENCIO:** No sale nada (porque ya te preguntó en esta sesión). |
| **1.5** | **Panel Admin** | Búscalo en la lista y súmale **100 puntos**. | Puntos sumados. |
| **1.6** | **PWA (PC)** | Mira la pantalla del socio. | **SILENCIO:** No sale Gloria (porque aún te queda 1 intento del ciclo inicial). |
| **1.7** | **PWA (PC)** | **Cierra la pestaña**, abre una nueva y logueate otra vez. | **BUM:** Re-aparece el **Banner Azul** (Intento 2). |
| **1.8** | **PWA (PC)** | Haz clic en **"QUIZÁS LUEGO"**. | Desaparece. Ya agotaste tus 2 intentos normales. |
| **1.9** | **Panel Admin** | Súmale otros **100 puntos**. | Puntos sumados. |
| **1.10**| **PWA (PC)** | Mira la pantalla del socio. | **¡TRIUNFO! Sale el Momento de Gloria** (pidiendo que actives avisos). |

---

## 📂 ESCENARIO 2: EL SOCIO QUE SE REGISTRA SOLO EN LA PC
*Uso: Cuando el cliente entra a tu web y se da de alta él mismo.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? (Resultado) |
| :--- | :--- | :--- | :--- |
| **2.1** | **PWA (PC)** | En el Login, pulsa **"REGISTRATE"** -> Llena Paso 1 y Paso 2 -> Acepta T&C. | Registro completo y entras al Home solo. |
| **2.2** | **PWA (PC)** | Quédate mirando el Home apenas terminas de registrarte. | **BUM:** Sale el **Banner Azul** a los 1.5 segundos. |
| **2.3** | **PWA (PC)** | Haz clic en **"SÍ, ME INTERESA"** (Damos permisos). | Navegador te pide permiso real -> Aceptas. El contador se resetea a 0. |
| **2.4** | **Panel Admin** | Búscalo y súmale **100 puntos**. | Puntos sumados. |
| **2.5** | **PWA (PC)** | Mira la pantalla del socio. | **¡NUEVO OBJETIVO!** Sale Gloria invitando a **INSTALAR LA APP**. |

---

## 📂 ESCENARIO 3: EL SOCIO QUE SE REGISTRA DESDE EL CELULAR
*Uso: Cliente con su móvil escaneando el QR o entrando al link.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? (Resultado) |
| :--- | :--- | :--- | :--- |
| **3.1** | **PWA (Móvil)** | Regístrate como socio nuevo desde el celular. | Llegas al Home del celular. |
| **3.2** | **PWA (Móvil)** | Mira el Home. | Sale el **Banner Azul** (Móvil). |
| **3.3** | **PWA (Móvil)** | En lugar de aceptar, pulsa **"QUIZÁS LUEGO"**. | Desaparece. |
| **3.4** | **PWA (Móvil)** | Cierra la App y vuelve a entrar. | **SILENCIO:** No sale nada (el celular usa cooldown de 24hs). |
| **3.5** | **Panel Admin** | Ve a Mensajería -> **Simulador de Fecha** -> Pon **+2 días**. | Tiempo adelantado para el sistema. |
| **3.6** | **PWA (Móvil)** | Abre la App de nuevo en el celular. | **BUM:** El banner azul vuelve a salir (porque ya pasaron las 24hs simuladas). |

---

## 📂 ESCENARIO 4: EL RESPETO AL "NO, GRACIAS"
*Uso: Ver si el sistema de verdad deja de molestar si el usuario dice que no.*

| Paso | ¿Dónde estoy? | ¿Qué hago exactamente? | ¿Qué debo ver? (Resultado) |
| :--- | :--- | :--- | :--- |
| **4.1** | **PWA (Cualquiera)**| En el banner azul, pulsa el botón **"NO, GRACIAS"**. | Cartelito de "Ok, te respetamos por 30 días". |
| **4.2** | **Panel Admin** | Súmale muchísimos puntos, gánale un desafío... | Lo que sea. |
| **4.3** | **PWA** | Mira la pantalla. | **SILENCIO ABSOLUTO.** Ni banner azul ni Momento de Gloria saldrán por un mes. |

---

### ✅ Checklist Final (Si marcas todo, puedes dormir tranquilo):
- [ ] ¿El banner espera a que se acaben los intentos normales para que Gloria salga al rescate?
- [ ] ¿Si el usuario dice SÍ a los permisos, el siguiente Gloria le pide Instalar la App?
- [ ] ¿Si el usuario dice NO, se calla todo por 30 días?
- [ ] ¿El celular respeta las 24hs entre intentos?
