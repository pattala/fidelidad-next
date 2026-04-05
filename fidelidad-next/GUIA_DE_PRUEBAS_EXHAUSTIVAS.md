# 🧪 Guía de Pruebas Exhaustivas (RAMPET PWA)

Esta guía te llevará paso a paso para verificar que el sistema de permisos y el "Momento de Gloria" funcionan exactamente como pediste: **Sin solapamientos y con prioridades claras.**

---

## 🛠️ PASO 0: Preparación (Desde el Panel Admin)
Antes de empezar, necesitamos un "Lienzo Limpio":
1.  **Crea un Cliente Nuevo:** Ve a la sección de Clientes y crea uno de prueba (ej. "Prueba PC").
2.  **Verifica la Configuración:** En el panel "Mensajería", asegúrate de tener:
    *   Máx. Intentos PC: **3**
    *   Máx. Intentos Móvil: **3**
    *   Cooldown Móvil: **24 HS**
    *   Re-suscripción: **30 DÍAS**

---

## 💻 BLOQUE 1: Pruebas en Computadora (PC)
*Objetivo: Verificar que funciona por SESIÓN y que el Momento de Gloria recupera permisos.*

### Escenario 1.1: El Banner Inicial
1.  **Acción:** Inicia sesión con el cliente de prueba en una pestaña de Incógnito (recomendado).
2.  **Resultado Esperado:** A los pocos segundos, debe aparecer el **Banner Grande Superior** pidiendo notificaciones.
3.  **Acción:** Haz clic en **"Quizás luego"**.
4.  **Verificación:** 
    *   El cartel desaparece.
    *   **Refresca la página (F5):** El cartel **NO** debe volver a aparecer (estamos en la misma sesión).

### Escenario 1.2: El Momento de Gloria (Recuperación)
*(Continuando desde el punto anterior, con el banner ya descartado)*
1.  **Acción:** Desde el Panel Admin, búscale los puntos a este usuario y **súmale 100 puntos**.
2.  **Acción:** Vuelve a la pestaña del cliente (PC).
3.  **Resultado Esperado:** Debe aparecer un cartel con estrellas (Sparkles) que diga: **"¡Tu cuenta está creciendo! Activá los avisos para enterarte de más premios"**.
    *   *Nota:* Este es el "Momento de Gloria" trabajando para recuperar el permiso que el usuario negó al principio.

### Escenario 1.3: Nuevo Login
1.  **Acción:** Cierra la pestaña por completo y vuelve a abrir la app (o borra la sesión).
2.  **Resultado Esperado:** El **Banner Grande vuelve a aparecer (es el Intento #2).**

---

## 📱 BLOQUE 2: Pruebas en Celular (PWA)
*Objetivo: Verificar que funciona por COOLDOWN (Tiempo).*

### Escenario 2.1: Prioridad de Permisos
1.  **Acción:** Entra desde el celular. Aparece el banner de Permisos.
2.  **Acción:** **NO lo cierres**. Quédate con el cartel abierto.
3.  **Acción:** (Desde el Admin) Súmale puntos al usuario.
4.  **Resultado Esperado:** **NO debe solaparse nada**. El Momento de Gloria debe esperar a que el primer cartel termine de procesarse.

### Escenario 2.2: Momento de Gloria (PWA Install)
1.  **Acción:** Acepta todos los permisos (Notificaciones y GPS).
2.  **Acción:** Suma puntos desde el Admin.
3.  **Resultado Esperado:** Debe aparecer el cartel de "Momento de Gloria" pero esta vez invitando a **"Instalar la App"** (porque los permisos ya los tiene).

---

## 📋 RESUMEN DE RESULTADOS ESPERADOS

| Si el usuario... | Y suma puntos... | Resultado |
| :--- | :--- | :--- |
| **No contestó** el banner inicial | Suma puntos | **Silencio.** No se solapan. |
| Puso **"Luego"** al banner | Suma puntos | Sale Gloria invitando a **Permisos**. |
| **Aceptó** los permisos | Suma puntos | Sale Gloria invitando a **Instalar App**. |
| **Ya instaló** la App y tiene permisos | Suma puntos | **Silencio.** El cliente ya es VIP total. |

---

## ⚠️ NOTA PARA EL TESTER (PABLO)
Para "forzar" que los puntos suban y ver el efecto, asegúrate de que la pestaña del cliente esté abierta mientras haces el cambio en el Panel Admin. El sistema detecta el cambio en tiempo real y dispara la celebración.
