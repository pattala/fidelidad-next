# Contexto de Trabajo y Pautas del Proyecto

## 1. Entorno y Despliegue
- **Tipo de Proyecto**: Aplicación Web Next.js / Vite con API Serverless (Vercel Functions).
- **Repositorio**: GitHub.
- **Despliegue**: Automático vía Vercel al hacer push a la rama principal (GitHub -> Vercel).
- **No es Local**: Aunque editemos archivos locales, el entorno de ejecución real es la nube (Vercel). Las pruebas finales deben hacerse en la URL de desarrollo/producción, no en localhost (salvo que se use `npx vercel dev`).

## 2. Estado Actual (2026-01-27)
- **PWA (Cliente)**:
    - Registro gratuito funcionando.
    - Pendiente depuración fina.
- **Panel Admin**:
    - Creación de cliente: Funciona parcialmente.
    - **Problema Crítico**: Crea el registro en Firestore DB correctamente, pero **FALLA silenciosamente al crear el usuario en Firebase Authentication**. Esto impide que el usuario se loguee.
    - **Solución en proceso**: Se modificó `api/create-user.js` para robustecer la creación/actualización en Auth y usar el `authUID` como ID de documento para consistencia.

## 3. Pautas de Comunicación
- **Idioma**: Español.
- **Memoria**: Consultar este archivo al inicio de cada sesión para evitar preguntas repetitivas sobre el entorno.
- **Roles**: Yo (IA) edito archivos locales. Tú (Usuario) te encargas de que esos cambios se suban a GitHub para el despliegue.

## 4. Archivos Clave
- `api/create-user.js`: Lógica crítica de alta de usuarios (Auth + Firestore).
- `src/modules/client/pages/ClientRegisterPage.tsx`: Registro lado cliente (PWA).
- `src/modules/admin/pages/ClientsPage.tsx`: Gestión de clientes lado Admin.
