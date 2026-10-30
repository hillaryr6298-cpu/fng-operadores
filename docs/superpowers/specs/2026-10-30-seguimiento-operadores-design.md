# Seguimiento de Operadores FNG — Especificación de diseño (v2, Appwrite)

Fecha: 2026-10-30 · Estado: pendiente de revisión del usuario
Cambio vs v1: backend pasa de Supabase a **Appwrite Cloud** (proyecto `fng`, id `6ae50287002f8a4e87ba`, endpoint `https://sfo.cloud.appwrite.io/v1`) por decisión del usuario.

## 1. Objetivo

Digitalizar el Excel "Operadores en Proceso FNG 2026" (hoja por mes + DESCARTADOS). Cada operador avanza por 10 etapas de contratación. Reemplaza al Excel para 40+ usuarios simultáneos (RH, gerentes, reclutadores) con login, roles, auditoría y datos privados protegidos.

**Criterios de éxito**
- Los 20 operadores activos y 2 descartados de octubre 2026 se importan sin pérdida.
- Un reclutador actualiza una etapa en ≤ 2 clics o con teclado.
- Ningún usuario lee o escribe fuera de su rol (probado por rol).
- Todo cambio queda en auditoría (quién, cuándo, antes, después) y no se puede saltar desde el navegador.
- Publicado en GitHub Pages + Appwrite, sin costo obligatorio.

## 2. Alcance

Incluye: login, usuarios, operadores y etapas, tablero, panel de KPIs, descartados, reportes con exportación a Excel, importación de Excel, auditoría, catálogo de bases.
No incluye (YAGNI): nómina, adjuntos, correos, app nativa.

## 3. Arquitectura

- **Front:** SPA estática Vite + TypeScript + Preact, SDK web `appwrite`, SheetJS (import/export), en GitHub Pages (hash routing). Solo ID de proyecto y endpoint (públicos) en el front.
- **Backend:** Appwrite Auth + Databases + Realtime + Functions (Node).
- **Principio de seguridad:** el navegador **solo lee** (con permisos por rol) y **nunca escribe directo** a colecciones. Toda escritura pasa por Appwrite Functions que validan, comprueban rol/propiedad, aplican control de versión y escriben el registro de auditoría. Las colecciones no tienen permisos de create/update/delete para clientes.
- La API key de servidor existe solo como variable de las Functions y para el sembrado inicial desde este entorno; nunca va al repo ni al front. Debe rotarse al terminar (fue compartida en el chat).
- Plataforma web registrada en Appwrite: hostname `hillaryr6298-cpu.github.io` (CORS).

## 4. Modelo de datos (Database `fng`)

- **perfiles** (id del documento = id de usuario Auth): `nombre`, `rol` ∈ {admin, gerente_rh, reclutador, consulta}, `activo`. Lectura: cualquier usuario autenticado; escritura: solo Functions.
- **bases**: `nombre` (único), `activa`. Semilla: SLP, TEX, ALTAMIRA, PUEBLA, TIJUANA, CUAUHTEMOC.
- **operadores** (un documento por operador, etapas embebidas para leer la tabla en una sola consulta y auditar diffs simples):
  - `nombre`, `nombre_norm` (índice único), `base`, `reclutador_id`, `reclutador_nombre`, `modalidad` ∈ {FULL, SENCILLO, MOVEDOR}, `estatus` ∈ {PREMEDICO_INTERNO, VALIDACION_CARTAS, PREMEDICO_CRYO, LABORATORIOS, DICTAMEN, CONTRATADO, DESCARTADO}, `observaciones`, `motivo_descarte`, `version`, `fecha_inicio`.
  - Por cada etapa `<e>_fecha` (datetime, opcional) y `<e>_res` ∈ {FECHA, NA_LOCAL, OP_VIAJE, OK, NO_APTO}. Etapas: quimica_sanguinea, revision_medica_interna, solicitud_examen_cryo, revaloracion, resultado_premedicos_cryo, prueba_manejo, envio_laboratorios, envio_resultados_cliente, dictamen_cryo, contratacion.
  - "N|A (LOCAL)", "OP. VIAJE" y "OK" del Excel son resultados, no fechas.
  - `total_dias` se calcula (cliente y reportes): de `fecha_inicio` a contratación, o a hoy si sigue en proceso.
  - Descarte = estatus DESCARTADO + `motivo_descarte`. No existe borrado.
- **auditoria**: `ts`, `usuario_id`, `usuario_nombre`, `entidad`, `registro_id`, `accion`, `antes` (JSON string), `despues` (JSON string). Lectura: admin y gerente_rh; sin update/delete para nadie.

## 5. Roles y permisos

Rol en etiqueta (label) de Auth, asignada solo por Function. Lectura por etiqueta en colecciones.

| Recurso | admin | gerente_rh | reclutador | consulta |
|---|---|---|---|---|
| operadores | leer/escribir todo | leer/escribir todo | leer todo, escribir solo asignados | leer |
| bases | leer/escribir | leer | leer | leer |
| perfiles | leer/escribir | leer | leer | leer |
| auditoria | leer | leer | — | — |

(El reclutador ve todos los operadores para detectar duplicados; edita solo los suyos. La comprobación de propiedad la hace la Function.)

## 6. Functions

- `operador-guardar`: crear/actualizar operador o etapa. Valida (sección 7), comprueba rol y propiedad desde la identidad del llamador, compara `version` (conflicto → 409), escribe documento y auditoría.
- `operador-descartar` / `operador-contratar`: transiciones de estatus con reglas.
- `usuarios-admin` (solo admin): crear usuario con correo, rol y contraseña temporal; cambiar rol; activar/desactivar; restablecer contraseña. Al desactivar, se revocan sesiones.
- `cambiar-password`: verifica contraseña actual, exige ≥ 12 caracteres, quita `debe_cambiar_password`.
- `importar-excel`: recibe filas ya parseadas, valida todas, devuelve vista previa/errores y confirma en lote.
- `bases-admin` (solo admin).
- Limitación honesta: el control de versión es lectura-comparación-escritura, no atómico; con 40 usuarios el riesgo residual es mínimo y se mitiga con Realtime.

## 7. Validaciones (en Function; la UI solo las refleja)

- Fechas en orden cronológico entre etapas; no futuras más de 30 días.
- Nombre obligatorio y normalizado (mayúsculas, sin espacios dobles); duplicado activo bloqueado (índice único + validación).
- No CONTRATADO sin dictamen OK; DESCARTADO exige motivo.
- Valores de catálogos (base, modalidad, estatus) restringidos por enum.

## 8. Seguridad adicional

- Solo invitación; nadie se registra solo (registro público deshabilitado en Auth).
- Contraseña ≥ 12 (se fuerza en las Functions); cierre de sesión por inactividad (30 min) y duración de sesión limitada en ajustes de Auth; límite de intentos de login de Appwrite activo.
- Usuario `activo=false` pierde acceso (la Function lo rechaza y se revocan sesiones).
- CSP estricta, sin `innerHTML` con datos de usuario, dependencias fijadas.
- Revisión de seguridad al final con la skill `securitymaxxing:audit`.

## 9. Pantallas

Login · Panel (KPIs por etapa, días promedio, atrasados) · Operadores (tabla filtrable por mes/base/reclutador/estatus, edición rápida de etapas, atajos, panel lateral) · Tablero por estatus · Descartados · Reportes (.xlsx) · Importar Excel · Auditoría · Usuarios · Bases. Realtime actualiza las tablas abiertas.

## 10. Estética

Sobria y minimalista: fondo marfil/gris cálido, tinta casi negra, un acento azul petróleo apagado; rojo/ámbar solo para alertas. IBM Plex Sans + IBM Plex Mono. Espacio en blanco, bordes finos, sin gradientes. Contraste AA, foco visible, teclado completo.

## 11. Pruebas

- Unitarias (Vitest): cálculo de días, validaciones, parser de Excel.
- Permisos: script que, con usuarios de prueba de cada rol, intenta lecturas/escrituras permitidas y prohibidas contra Appwrite real (incluida escritura directa a colección = debe fallar).
- E2E Playwright: login, captura de etapa, conflicto de versión, permisos por rol.

## 12. Despliegue y operación

- GitHub Actions construye y publica en Pages. Repo público (requisito de Pages gratis); sin secretos.
- Esquema de Appwrite creado por script versionado (`appwrite/setup.mjs`), idempotente.
- Riesgos: latencia de arranque en frío de Functions (1–3 s en la primera llamada); límites y política de inactividad del plan Free de Appwrite por verificar en la consola; respaldos por exportación manual periódica.
- Prerrequisitos pendientes del usuario: token de GitHub válido y repo `fng-operadores` público.

## 13. Fuera de esta entrega

Notificaciones, adjuntos, multi-empresa, firma de documentos.
