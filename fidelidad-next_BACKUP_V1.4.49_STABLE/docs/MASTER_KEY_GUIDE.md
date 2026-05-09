# Guía: Cómo Cambiar la Clave Maestra en Fidelidad/Franccesca

Esta guía explica cómo cambiar la Clave Maestra de acceso administrativo de forma independiente y segura. El proceso consta de dos partes: actualizar el código y sincronizar la base de datos de Firebase.

---

## 🛠️ Paso 1: Cambiar la clave en el código

Debes actualizar la clave en el archivo de configuración del frontend para que el sistema reconozca la nueva contraseña en el formulario de login.

1. Abre el archivo: `src/lib/adminConfig.ts`
2. Busca la línea:
   ```typescript
   export const MASTER_LOGIN_KEY = import.meta.env.VITE_MASTER_LOGIN_KEY || 'Felipe01';
   ```
3. Cambia `'Felipe01'` por tu nueva clave. 
   > [!IMPORTANT]
   > Asegúrate de usar comillas simples y no borrar el fallback (`||`).

---

## 🔄 Paso 2: Sincronizar con Firebase (Auth y Firestore)

Aunque cambies el código, Firebase Auth todavía tiene guardada la clave vieja. Para sincronizarlos sin entrar a la consola de Google, usa el script de automatización que hemos preparado.

1. Abre una terminal en la carpeta raíz del proyecto.
2. Ejecuta el siguiente comando:
   ```bash
   node scripts/set-master-keys.js
   ```
3. Verás un mensaje en la terminal confirmando la actualización:
   `OK: pablo_attala@yahoo.com.ar / NuevaClave`

---

## 🚀 Paso 3: Desplegar cambios

Para que los clientes y tú mismo veáis el cambio en la web (Vercel):

1. Sube los cambios a GitHub:
   ```bash
   git add .
   git commit -m "chore: actualización de clave maestra"
   git push origin desarrollo
   ```
2. Vercel detectará el cambio y recreará la aplicación con la nueva clave.

---

## ⚠️ Notas de Seguridad

- **Service Account**: El script requiere que el archivo `service-account.json` esté en la raíz del proyecto. No lo borres ni lo compartas.
- **Doble Factor**: Si cambias la clave, todos los administradores maestros listados en el script `scripts/set-master-keys.js` se actualizarán. Puedes editar ese archivo para agregar o quitar correos electrónicos de la lista `masters`.

> [!TIP]
> Si alguna vez olvidas la clave y no puedes entrar ni al código, puedes resetearla directamente en la consola de Firebase -> Authentication -> Usuarios.
