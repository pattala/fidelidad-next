# 🧪 GUÍA DE PRUEBAS "A PRUEBA DE TODO" (VERSIÓN FINAL)

Esta guía asegura que el sistema sea profesional: **No molesta, no se solapa y aprovecha los puntos para ganar permisos.**

---

## 🏁 3 FORMAS DE EMPEZAR (Elige una para cada prueba)
Sea cual sea la forma que elijas, el objetivo es el mismo: **Un Cliente con 0 visitas.**
1.  **DESDE EL PANEL:** Creas el socio en "Clientes" -> Vas a la PWA -> Te logueas.
2.  **DESDE PWA PC:** En la pantalla de login, pulsas "Registrate" -> Llenas los datos -> Entras al Home.
3.  **DESDE PWA MÓVIL:** Igual que en PC, pero desde el celular.

---

## 🛠️ CONFIGURACIÓN INICIAL (En el Panel Admin)
1.  Ve a **Mensajería**.
2.  Pon **Máx. Intentos PC: 2**.
3.  Pon **Máx. Intentos Gloria: 2**.
4.  Pon **Re-suscripción: 30 DÍAS**.
5.  **Simulador de Fecha:** Déjalo en **0 días** (Hoy).

---

## 💻 ESCENARIO 1: LA PC (Sesiones y Paciencia)
*Objetivo: Ver que el sistema es "paciente" y no molesta en la misma sesión.*

1.  **ACCION:** Registra un socio nuevo y logueate en la PC.
2.  **RESULTADO:** Aparece el **Banner Azul (Intento 1)**.
3.  **ACCION:** Haz clic en **"QUIZÁS LUEGO"**.
4.  **ACCION (La trampa):** Sin cerrar la pestaña, ve al Admin y súmale 100 puntos.
5.  **RESULTADO ESPERADO:** **NO sale nada.** Gloria está "callada" porque todavía te queda 1 intento del ciclo inicial.
6.  **ACCION:** Cierra la pestaña y vuelve a entrar (Login 2).
7.  **RESULTADO:** Aparece el **Banner Azul (Intento 2 - último)**.
8.  **ACCION:** Haz clic en **"QUIZÁS LUEGO"**.
9.  **ACCION (El salvavidas):** Ve al Admin y súmale otros 100 puntos.
10. **RESULTADO ESPERADO:** **¡Aparece el Momento de Gloria!** Como ya gastaste tus 2 intentos normales, ahora Gloria sale a intentar recuperarte.

---

## 🌟 ESCENARIO 2: EL REINICIO POR ÉXITO (Hacia la instalación)
*Objetivo: Ver que si acepta permisos, le damos chances nuevas para instalar la App.*

1.  **ACCION (En Gloria):** Pulsa **"SÍ, ACEPTO"**.
2.  **RESULTADO:** Permisos activados. Contador de Gloria vuelve a 0.
3.  **ACCION:** Ve al Admin y súmale puntos de nuevo.
4.  **RESULTADO ESPERADO:** **¡NUEVO CARTEL!** Ahora te invita a **Instalar la App**. (Esto prueba que el ciclo se reinició para el siguiente objetivo).

---

## 📱 ESCENARIO 3: EL CELULAR (Cooldown 24hs)
*Objetivo: Ver que el celular te hace esperar un día entero.*

1.  **ACCION:** Logueate en celular -> Banner Azul -> Pon **"QUIZÁS LUEGO"**.
2.  **ACCION:** Cierra y vuelve a entrar -> **SILENCIO:** No sale nada (faltan 24hs).
3.  **ACCION:** En el Admin, adelanta el **Simulador de Fecha** a **+2 días**.
4.  **RESULTADO:** Al abrir la App de nuevo en el celular, **vuelve a salir el cartel**.

---

## 🛑 ESCENARIO 4: BLOQUEO TOTAL (No, Gracias)
*Objetivo: Ver que si dice "No", el sistema lo respeta por 30 días.*

1.  **ACCION:** En cualquier banner azul, pulsa **"NO, GRACIAS"**.
2.  **RESULTADO:** Cartel de "Volveremos en 30 días".
3.  **ACCION:** Suma puntos, cierra sesión... **SILENCIO ABSOLUTO.** No sale nada por un mes.

---

### ✅ Checklist Final para el OK:
- [ ] ¿El banner azul sale correctamente al primer registro?
- [ ] ¿Si refresco (F5) en PC deja de salir?
- [ ] ¿Aparece el Gloria RECIÉN cuando se acaban los intentos iniciales?
- [ ] ¿Si acepto permisos, el siguiente gloria me pide la App?
- [ ] ¿Si digo "No, gracias", se calla todo por un mes?
