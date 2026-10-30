# Seguimiento de Operadores FNG — Especificación de diseño

Fecha: 2026-10-30 · Estado: pendiente de revisión del usuario

## 1. Objetivo

Digitalizar el Excel "Operadores en Proceso FNG 2026" (hoja por mes + hoja DESCARTADOS). Cada operador avanza por un proceso de contratación de 10 etapas. El sistema reemplaza el Excel para 40+ usuarios simultáneos (RH, gerentes, reclutadores) con login, roles, auditoría y datos privados protegidos.

**Criterios de éxito**
- Los 26 operadores activos y 2 descartados de octubre 2026 se importan sin pérdida.
- Un reclutador captura/actualiza una etapa en ≤ 2 clics o con teclado.
- Ningún usuario accede a datos fuera de su rol (verificado con pruebas RLS por rol).
- Todo cambio queda en auditoría (quién, cuándo, antes, después).
- Publicado en GitHub Pages + Supabase, sin costo obligatorio.

## 2. Alcance

Incluye: login, gestión de usuarios, operadores y etapas, tablero, panel de KPIs, descartados, reportes con exportación a Excel, importación de Excel, auditoría, catálogos.
No incluye (YAGNI): nómina, documentos adjuntos, notificaciones por correo, app móvil nativa.

## 3. Arquitectura

- Front: SPA estática, Vite + TypeScript + Preact, `@supabase/supabase-js`, SheetJS (import/export), desplegada en GitHub Pages (hash routing).
- Backend: Supabase (Auth, Postgres con RLS, Realtime, una Edge Function `admin-users`).
- Solo la llave publicable (anon) va al front. La `service_role` vive únicamente en la Edge Function.
- Repo público (requisito de Pages gratis); sin secretos en el repo.

## 4. Modelo de datos (schema `public`)

- `profiles(id → auth.users, nombre, rol, activo, debe_cambiar_password, creado_en)`; `rol` ∈ {admin, gerente_rh, reclutador, consulta}.
- `bases(id, nombre unique, activa)`: SLP, TEX, ALTAMIRA, PUEBLA, TIJUANA, CUAUHTEMOC.
- `operadores(id, nombre, nombre_norm unique-where-activo, base_id, reclutador_id → profiles, modalidad, estatus, observaciones, motivo_descarte, version, creado_por, creado_en, actualizado_en)`; `modalidad` ∈ {FULL, SENCILLO, MOVEDOR}; `estatus` ∈ {PREMEDICO_INTERNO, VALIDACION_CARTAS, PREMEDICO_CRYO, LABORATORIOS, DICTAMEN, CONTRATADO, DESCARTADO}.
- `etapas(clave, nombre, orden)`: quimica_sanguinea, revision_medica_interna, solicitud_examen_cryo, revaloracion, resultado_premedicos_cryo, prueba_manejo, envio_laboratorios, envio_resultados_cliente, dictamen_cryo, contratacion.
- `operador_etapas(operador_id, etapa, fecha date null, resultado, primary key(operador_id, etapa))`; `resultado` ∈ {FECHA, NA_LOCAL, OP_VIAJE, OK, NO_APTO}. `NA_LOCAL`/`OP_VIAJE`/`OK`/`NO_APTO` son resultados sin fecha (así "N|A (LOCAL)", "OP. VIAJE" y "OK" del Excel dejan de contaminar columnas de fechas).
- `audit_log(id, ts, usuario_id, tabla, registro_id, accion, antes jsonb, despues jsonb)`: solo INSERT.
- Vista `v_operadores`: une catálogos y calcula `total_dias` = (fecha de contratación, o hoy si sigue en proceso) − (primera fecha registrada).
- Descarte = estatus DESCARTADO con `motivo_descarte` obligatorio. Nunca hay DELETE de operadores.

## 5. Seguridad

- RLS activo en todas las tablas. Función `SECURITY DEFINER` `mi_rol()` lee `profiles`; nunca se confía en metadatos editables por el usuario.
- Matriz:

| Recurso | admin | gerente_rh | reclutador | consulta |
|---|---|---|---|---|
| operadores / operador_etapas | R/W todo | R/W todo | R todo*, W solo suyos | R |
| catálogos | R/W | R | R | R |
| profiles | R/W | R | R (nombres) | R (nombres) |
| audit_log | R | R | — | — |

\* Decisión: el reclutador ve todos los operadores (necesario para detectar duplicados) pero solo edita los asignados a él.
- Usuarios: solo por invitación. Edge Function `admin-users` (verifica rol admin con el JWT) crea/desactiva usuarios, restablece contraseñas; contraseña temporal + cambio obligatorio.
- Contraseña mínima de 12 caracteres; cierre de sesión por inactividad (30 min); un usuario `activo=false` pierde acceso vía RLS.
- CSP estricta en `index.html`, sin `innerHTML` con datos de usuario, sin `eval`, dependencias fijadas.
- Auditoría por triggers en operadores, operador_etapas, profiles, bases; `audit_log` sin políticas UPDATE/DELETE.
- Concurrencia: `version` se incrementa en cada UPDATE; la escritura usa `WHERE version = :leida`; conflicto → aviso con opción de recargar. Realtime sincroniza tablas abiertas.

## 6. Validaciones (UI y BD)

- Fechas en orden cronológico entre etapas; no futuras más de 30 días; resultados coherentes con fecha.
- Nombre obligatorio, normalizado (mayúsculas, sin espacios dobles); duplicado activo bloqueado.
- No pasar a CONTRATADO sin dictamen OK; DESCARTADO exige motivo.
- Implementadas como `CHECK`/triggers; la UI solo las refleja.

## 7. Pantallas

Login · Panel (KPIs por etapa, promedio de días, atrasados >N días) · Operadores (tabla filtrable por mes/base/reclutador/estatus, edición rápida de etapas, atajos, panel lateral) · Tablero por estatus · Descartados · Reportes (exporta .xlsx) · Importar Excel (vista previa + errores) · Auditoría · Usuarios · Catálogos.

## 8. Estética

Sobria y minimalista: fondo marfil/gris cálido, tinta casi negra, un acento azul petróleo apagado; rojo/ámbar solo para alertas. IBM Plex Sans + IBM Plex Mono (fechas, cifras). Espacio en blanco, bordes finos, sin gradientes. Accesibilidad: contraste AA, foco visible, navegación por teclado.

## 9. Pruebas

- Unitarias (Vitest): cálculo de días, validaciones, parser del Excel.
- RLS/SQL: cada rol intenta leer/escribir lo permitido y lo prohibido.
- E2E con Playwright: login, captura de etapa, conflicto de versión, permisos por rol.
- Advisors de Supabase (seguridad/rendimiento) sin hallazgos críticos antes de publicar.

## 10. Despliegue y operación

- GitHub Actions construye y publica en Pages. Variables públicas (URL + anon key) en el build.
- Supabase: proyecto nuevo "FNG". Migraciones versionadas en `supabase/migrations`.
- Riesgos conocidos: plan gratis de Supabase pausa tras 7 días de inactividad y no tiene respaldos diarios → recomendado plan Pro o export manual periódico. Pages gratis exige repo público.
- Prerrequisito pendiente: token de GitHub válido para crear/publicar el repo.

## 11. Fuera de esta primera entrega

Notificaciones, adjuntos, multi-empresa, firma de documentos.
