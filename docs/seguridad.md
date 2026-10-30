# Auditoría de seguridad — estado al 2026-10-30

Revisión de código y de configuración real (Appwrite en vivo), con verificación activa de cada hallazgo.

## Superficie de ataque

| Entrada | Quién llega | Control |
|---|---|---|
| Sitio estático (GitHub Pages) | Público | Solo HTML/JS; sin secretos; CSP `script-src 'self'` |
| Appwrite Auth (`/account/*`) | Público | Auto-registro cerrado (límite de usuarios); contraseña ≥ 12 + diccionario + filtradas; 3 sesiones; 12 h |
| Appwrite Databases (lectura) | Usuarios con etiqueta de rol | Permisos por etiqueta; **ningún** create/update/delete para clientes |
| Function `api` (única escritura) | Usuarios autenticados | Perfil activo en BD; rol y propiedad en servidor; versión atómica; auditoría |
| Importación de .xlsx | Admin / Gerente RH | Se lee en el navegador; validado de nuevo en servidor; máx. 5 MB y 500 filas |

## Hallazgos y estado

| # | Sev. | Hallazgo | Evidencia | Estado |
|---|---|---|---|---|
| 1 | Alta | Auto-registro público abierto (`POST /account` sin credenciales creaba usuarios) | Probado con un alta anónima | **Corregido**: límite de usuarios = 1; verificado (400) y el alta del admin por servidor sigue funcionando |
| 2 | Media | Un usuario podía fijar una contraseña de 8 caracteres por la API directa y saltar la política de 12 | `updatePassword("corta123")` permitido | **Corregido**: política de proyecto (mín. 12, diccionario, datos personales, filtradas); rechazo verificado |
| 3 | Media | Carrera en el control de versión (dos ediciones simultáneas podían pisarse) | Diseño leer-comparar-escribir | **Corregido**: incremento atómico acotado; verificado en vivo (1 gana, 1 recibe 409) |
| 4 | Media | Alta simultánea del mismo nombre podía duplicar | Dos altas en paralelo | **Corregido**: índice único + manejo del conflicto; verificado en vivo |
| 5 | Baja | El cambio obligatorio de contraseña solo lo imponía la interfaz | Llamada directa a la API | **Corregido**: el servidor bloquea todo salvo `password` mientras esté pendiente |
| 6 | Alta (operativa) | La API key de Appwrite y el token de GitHub se compartieron por chat | Historial de la conversación | **Pendiente (usuario)**: revocar y reemplazar al terminar |
| 7 | Media | `xlsx@0.18.5` (npm) con prototype pollution y ReDoS al leer archivos manipulados | `npm audit` | **Pendiente (decisión)**: pasar a SheetJS 0.20.x desde el CDN oficial o cambiar de librería. Mitigación actual: solo Admin/Gerente importan, máx. 5 MB, errores controlados |
| 8 | Media | Dos nombres reales de operadores quedaron en el historial git de un repo público (commits tempranos) | `git log -S` | **Pendiente (usuario)**: reescribir historial y forzar push, o aceptar el riesgo (solo nombres) |
| 9 | Baja | Todos los roles leen `perfiles` (incluye correos corporativos) | Prueba de lectura por rol | Aceptado: necesario para mostrar nombres; mover el correo a una tabla solo-admin si se desea |
| 10 | Baja | Plataforma `localhost` registrada en Appwrite para pruebas | `GET /project/platforms` | **Corregido**: eliminada |
| 11 | Baja | GitHub Actions por etiqueta mayor (v4), no por SHA | `desplegar.yml` | Aceptado (acciones oficiales de GitHub) |
| 12 | Info | Las cabeceras `x-appwrite-*` enviadas por el cliente son rechazadas por Appwrite (400) | Prueba de suplantación | Sin acción |

## Revisado y limpio

- **Control de acceso**: lectura por etiqueta de rol; escritura solo por la Function; propiedad (reclutador) y reasignación verificadas en servidor; sin asignación masiva (los campos se mapean uno a uno).
- **Inyección / XSS**: sin `innerHTML`, `eval` ni `dangerouslySetInnerHTML`; Preact escapa; consultas con el SDK (sin SQL).
- **Suplantación de identidad**: la identidad viene de la sesión validada por Appwrite; el rol, del perfil en BD.
- **Secretos**: ninguna llave en el repo ni en el historial (`git grep` sobre todos los commits); `.env*` ignorado.
- **Registros**: Appwrite no guarda el cuerpo de las peticiones; las contraseñas no aparecen en ejecuciones ni en la bitácora.
- **Enumeración de cuentas**: el login responde con un mensaje único.
- **CI**: sin `pull_request_target`, sin secretos, permisos mínimos.

## Límites de esta revisión

No se probó carga ni denegación de servicio (la Function no tiene límite de tasa propio; aplica el del proveedor). El plan gratuito de Appwrite no incluye respaldos automáticos. Revise periódicamente la lista de usuarios y la bitácora.
