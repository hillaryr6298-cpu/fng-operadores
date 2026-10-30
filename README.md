# FNG · Seguimiento de operadores

Sistema web para el seguimiento del proceso de contratación de operadores (Química sanguínea → … → Contratación).
Interfaz estática en **GitHub Pages**; datos, usuarios y reglas de negocio en **Appwrite**.

## Arquitectura

- `src/` — SPA (Vite + TypeScript + Preact). **Solo lee** de Appwrite; nunca escribe directo a las tablas.
- `appwrite/functions/` — lógica de servidor. Una única Function `api` enruta a los módulos
  `operador-guardar`, `usuarios-admin`, `cambiar-password`, `importar-excel`, `bases-admin`
  (el plan gratuito de Appwrite permite 2 Functions por proyecto). Cada módulo valida rol, propiedad, versión y escribe la auditoría.
- `shared/dominio.ts` — reglas de negocio (validaciones, cálculo de días, roles). Se usa en el front y en el servidor.
- `appwrite/setup.mjs` — crea el esquema, permisos y bases semilla (idempotente).
- `appwrite/deploy-functions.mjs` — empaqueta y despliega la Function `api`.
- `appwrite/endurecer.mjs` — políticas de seguridad del proyecto (contraseñas, sesiones, métodos de acceso, registro cerrado).
- `appwrite/test-permisos.mjs` — pruebas de permisos contra Appwrite real, con un usuario temporal por rol.

## Roles

| Rol | Operadores | Catálogos | Usuarios | Auditoría | Importar |
|---|---|---|---|---|---|
| Administrador | leer/escribir todo | escribe | gestiona | lee | sí |
| Gerente RH | leer/escribir todo | lee | — | lee | sí |
| Reclutador | lee todo, edita solo los suyos | lee | — | — | — |
| Consulta | solo lectura | lee | — | — | — |

## Seguridad (resumen)

- Las tablas de Appwrite **no permiten crear/editar/borrar a ningún cliente**; solo la Function `api` (con la API key dinámica de cada ejecución).
- El rol se lee del perfil en la base de datos, no de datos que el usuario pueda modificar. Usuarios desactivados pierden acceso al instante (sesiones revocadas).
- Alta de usuarios solo por el administrador; contraseña temporal y cambio obligatorio en el primer ingreso; mínimo 12 caracteres.
- Cierre de sesión por inactividad (30 min). Bitácora de auditoría de solo lectura para la aplicación.
- CSP estricta; sin `innerHTML` con datos de usuario; sin secretos en el repositorio.

## Desarrollo

```bash
npm ci
npm test                 # lógica de dominio, parser de Excel, métricas
npm run test:functions   # Functions con Appwrite simulado (Node >= 22.18)
npm run dev
```

Pruebas contra Appwrite real (requieren `APPWRITE_API_KEY` en el entorno, **nunca** en el repo):

```bash
export NODE_USE_ENV_PROXY=1   # solo si hay proxy
node appwrite/setup.mjs --admin-email correo@empresa.mx --admin-pass '<contraseña-temporal-12+>' --admin-nombre 'Nombre'
node appwrite/endurecer.mjs      # políticas de contraseña/sesión y cierre del auto-registro
node appwrite/deploy-functions.mjs
node appwrite/test-permisos.mjs
```

## Despliegue

1. En GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Cada push a `main` ejecuta pruebas, compila y publica (`.github/workflows/desplegar.yml`).
3. En Appwrite, la plataforma web debe incluir el hostname de Pages (`<usuario>.github.io`).

## Operación

- **Respaldo**: Appwrite Free no incluye respaldos automáticos. Exporte periódicamente desde *Reportes → Descargar Excel* (y, si necesita todo, desde la consola de Appwrite).
- **Inactividad**: los proyectos gratuitos de Appwrite pueden pausarse tras un periodo sin actividad; revise los límites vigentes de su plan.
- **Rotación de llaves**: si una API key o token se comparte por error, revóquelo y cree otro con permisos mínimos.

Ver también `docs/seguridad.md` (auditoría y pendientes).
