# Seguimiento de Operadores FNG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el Excel "Operadores en Proceso FNG 2026" por una app web con login, roles, auditoría y seguridad, en GitHub Pages + Appwrite.

**Architecture:** SPA estática (Vite + TypeScript + Preact) que solo *lee* de Appwrite (permisos por etiqueta de rol, Realtime). Toda escritura pasa por Appwrite Functions (Node) que validan con la lógica compartida `shared/dominio.ts`, verifican rol/propiedad/versión y escriben la auditoría. Las colecciones no dan create/update/delete a clientes.

**Tech Stack:** Vite, TypeScript, Preact, `appwrite` (SDK web), `node-appwrite` (Functions/scripts), SheetJS (`xlsx`), Vitest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-30-seguimiento-operadores-design.md`

## Global Constraints

- Appwrite: proyecto `6ae50287002f8a4e87ba`, endpoint `https://sfo.cloud.appwrite.io/v1`, database id `fng`.
- La API key de servidor NUNCA va al repo ni al front: solo variable de entorno `APPWRITE_API_KEY` en scripts locales y en las Functions. Se rota al terminar.
- Hostname de la plataforma web (CORS): `hillaryr6298-cpu.github.io`. Pages en `/fng-operadores/` → Vite `base: '/fng-operadores/'`, hash routing.
- Roles: `admin`, `gerente_rh`, `reclutador`, `consulta`. Modalidad: FULL, SENCILLO, MOVEDOR. Estatus: PREMEDICO_INTERNO, VALIDACION_CARTAS, PREMEDICO_CRYO, LABORATORIOS, DICTAMEN, CONTRATADO, DESCARTADO. Resultado de etapa: FECHA, NA_LOCAL, OP_VIAJE, OK, NO_APTO.
- Etapas (clave, en orden): quimica_sanguinea, revision_medica_interna, solicitud_examen_cryo, revaloracion, resultado_premedicos_cryo, prueba_manejo, envio_laboratorios, envio_resultados_cliente, dictamen_cryo, contratacion.
- Bases semilla: SLP, TEX, ALTAMIRA, PUEBLA, TIJUANA, CUAUHTEMOC.
- Contraseña ≥ 12 caracteres; cierre de sesión por inactividad a 30 min; fechas no futuras más de 30 días.
- Sin `innerHTML` con datos de usuario; CSP estricta; dependencias con versión exacta.
- Estética: fondo marfil/gris cálido, tinta casi negra, un acento azul petróleo apagado (`#1F4E5A`), rojo/ámbar solo para alertas; IBM Plex Sans + IBM Plex Mono; sin gradientes; contraste AA; teclado completo.
- Idioma de toda la UI: español (México).
- Commits terminan con las líneas de atribución indicadas por el entorno.

## Review Focus

1. Nombres con acentos, ñ, espacios dobles o finales ("MARIO PRUEBA GARCIA ", "José" vs "JOSE") deben detectarse como duplicados. → Task 2.
2. Excel real: celdas de fecha con texto ("N|A (LOCAL)", "OP. VIAJE", "OK"), filas vacías, duplicados dentro del archivo, fechas de otro mes. → Task 6 y 11.
3. Dos usuarios editan el mismo operador a la vez: el segundo recibe conflicto 409 y la UI ofrece recargar sin perder lo escrito. → Tasks 4 y 9.
4. Usuario desactivado o rol cambiado con sesión abierta: la siguiente escritura se rechaza y la lectura deja de funcionar. → Tasks 5 y 7.
5. Más de 100 operadores o pérdida de conexión Realtime: paginación por cursor y reconexión con recarga. → Task 9.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, index.html, .gitignore, .env.example
shared/dominio.ts                 lógica pura compartida (front + Functions)
shared/dominio.test.ts
appwrite/setup.mjs                esquema, permisos, bases semilla, primer admin (idempotente)
appwrite/functions/<nombre>/      operador-guardar, usuarios-admin, cambiar-password, importar-excel, bases-admin
appwrite/deploy-functions.mjs     copia shared/ dentro de cada función, empaqueta y despliega
appwrite/test-permisos.mjs        pruebas contra Appwrite real, un usuario por rol
src/lib/{config,appwrite,auth,api,store,excel}.ts
src/ui/{app.tsx,layout.tsx,estilos.css}
src/ui/paginas/{login,panel,operadores,tablero,descartados,reportes,importar,auditoria,usuarios,bases}.tsx
src/ui/componentes/{tabla,drawer,filtros,toast}.tsx
e2e/*.spec.ts, .github/workflows/deploy.yml
```

---

### Task 1: Andamiaje y herramientas

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `.env.example`, `src/main.tsx`, `src/ui/app.tsx`, `src/lib/config.ts`.

**Interfaces:**
- Produces: `config.ts` exporta `ENDPOINT`, `PROJECT_ID`, `DB_ID = 'fng'` (de `import.meta.env.VITE_*` con los valores del proyecto por defecto). Scripts npm: `dev`, `build`, `test`, `test:e2e`.

- [ ] **Step 1:** Inicializar con Vite + Preact + TS; fijar versiones exactas; `base: '/fng-operadores/'`. `.gitignore` incluye `node_modules`, `dist`, `.env*` (excepto `.env.example`), `*.key`.
- [ ] **Step 2:** `index.html` con CSP meta: `default-src 'self'; connect-src 'self' https://sfo.cloud.appwrite.io wss://sfo.cloud.appwrite.io; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'` (ajustar si el build lo exige, sin añadir `unsafe-inline` de scripts).
- [ ] **Step 3:** Run `npm run build` → Expected: build OK, `dist/index.html` generado.
- [ ] **Step 4:** Commit.

### Task 2: Lógica de dominio compartida

**Files:** Create `shared/dominio.ts`, Test `shared/dominio.test.ts`.

**Interfaces — Produces (exactos):**
```ts
export const ETAPAS: readonly { clave: EtapaClave; nombre: string }[]
export type Rol = 'admin'|'gerente_rh'|'reclutador'|'consulta'
export type Resultado = 'FECHA'|'NA_LOCAL'|'OP_VIAJE'|'OK'|'NO_APTO'
export type EtapaValor = { fecha: string|null; res: Resultado|null }   // fecha ISO yyyy-mm-dd
export type OperadorInput = { nombre:string; base:string; reclutador_id:string; modalidad:Modalidad;
  estatus:Estatus; observaciones?:string; motivo_descarte?:string; etapas: Record<EtapaClave, EtapaValor> }
export type ErrorValidacion = { campo:string; mensaje:string }
export function normalizarNombre(s:string): string          // mayúsculas, sin acentos/ñ→N, trim, espacios únicos
export function validarOperador(o:OperadorInput, hoy:Date): ErrorValidacion[]
export function fechaInicio(e:OperadorInput['etapas']): string|null   // fecha mínima registrada
export function totalDias(e:OperadorInput['etapas'], hoy:Date): number|null
export function aDocumento(o:OperadorInput): Record<string,unknown>   // aplana a <clave>_fecha / <clave>_res
export function deDocumento(d:Record<string,any>): OperadorInput
export function puedeEditar(rol:Rol, uid:string, reclutadorId:string): boolean
```

- [ ] **Step 1: Tests que fallan.** Casos con valores del Excel: `normalizarNombre('  José  Peña ')==='JOSE PENA'`; `normalizarNombre('MARIO PRUEBA GARCIA ')==='MARIO PRUEBA GARCIA'`; fechas fuera de orden (`prueba_manejo` anterior a `solicitud_examen_cryo`) → error en `prueba_manejo`; fecha > hoy+30 → error; `res:'OK'` con fecha null es válido; `res:'FECHA'` sin fecha → error; `estatus:'CONTRATADO'` sin `dictamen_cryo.res==='OK'` → error; `DESCARTADO` sin `motivo_descarte` → error; `totalDias` con contratación = diferencia en días, sin contratación = hasta `hoy`, sin fechas = null; `puedeEditar` true para admin/gerente, true para reclutador solo si `uid===reclutadorId`, false para consulta; `aDocumento`/`deDocumento` ida y vuelta idéntica.
- [ ] **Step 2:** Run `npx vitest run shared` → Expected: FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `shared/dominio.ts` con las firmas anteriores (sin dependencias externas). Orden cronológico se evalúa solo entre etapas con fecha, en el orden de `ETAPAS`; `revaloracion` queda exenta del orden estricto (puede ocurrir después de `solicitud_examen_cryo` y antes de `resultado_premedicos_cryo`, ver Excel).
- [ ] **Step 4:** Run `npx vitest run shared` → Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 3: Esquema de Appwrite y datos semilla

**Files:** Create `appwrite/setup.mjs`.

**Interfaces — Produces:** Database `fng` con colecciones `perfiles`, `bases`, `operadores`, `auditoria` (ids iguales al nombre). Atributos de `operadores` según spec §4 (`<clave>_fecha` datetime, `<clave>_res` enum, `nombre_norm` string con índice único, `version` integer, `fecha_inicio` datetime). `auditoria.antes/despues` strings de 16000. Permisos: lectura por `label:` para los roles indicados en spec §5; `documentSecurity` activo; ningún `create/update/delete` en colecciones para roles de cliente. Script lee `APPWRITE_API_KEY` del entorno.

- [ ] **Step 1:** Escribir `setup.mjs` idempotente (si existe, no falla ni duplica) usando `node-appwrite`; esperar a que los atributos estén `available` antes de crear índices.
- [ ] **Step 2:** Sembrar las 6 bases y crear el primer usuario admin (correo y contraseña temporal por argumentos `--admin-email`, `--admin-pass`, mínimo 12 caracteres; etiqueta `admin`; documento en `perfiles`).
- [ ] **Step 3:** Run `APPWRITE_API_KEY=… node appwrite/setup.mjs --admin-email … --admin-pass …` dos veces → Expected: segunda corrida sin errores ni duplicados; `GET /databases/fng/collections` lista las 4 colecciones.
- [ ] **Step 4:** Commit (sin credenciales).

### Task 4: Function `operador-guardar` (+ auditoría)

**Files:** Create `appwrite/functions/operador-guardar/src/main.js`, Test `appwrite/functions/operador-guardar/test/main.test.js`.

**Interfaces:**
- Consumes: `shared/dominio.ts` (copiado por `deploy-functions.mjs`).
- Produces: Execution JSON in `{accion:'crear'|'actualizar'|'descartar'|'contratar', id?:string, version?:number, datos:OperadorInput}`; out `{ok:true, doc}` | `{ok:false, status:400|403|404|409, errores:ErrorValidacion[]}`. Identidad del llamador desde `x-appwrite-user-id`; rol y `activo` se leen de `perfiles/<uid>` (no de etiquetas). Escribe en `auditoria` en cada cambio con `antes`/`despues`.

- [ ] **Step 1: Tests que fallan** (cliente Appwrite simulado): reclutador no dueño → 403; `consulta` → 403; perfil `activo=false` → 403; `version` distinta a la guardada → 409 sin escribir; nombre duplicado activo (con acentos/espacios distintos) → 400 en `nombre`; datos inválidos → 400 con errores; éxito incrementa `version`, fija `fecha_inicio`, `nombre_norm`, `reclutador_nombre`, y crea una fila de `auditoria` con `antes` null en alta; `descartar` exige motivo; `contratar` exige dictamen OK.
- [ ] **Step 2:** Run `node --test appwrite/functions/operador-guardar` → Expected: FAIL.
- [ ] **Step 3:** Implementar `main.js` (ESM, entrypoint estándar de Appwrite Functions). Los permisos del documento: leer lo hereda de la colección; update para `user:<reclutador_id>` y labels admin/gerente_rh.
- [ ] **Step 4:** Run tests → Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 5: Functions `usuarios-admin` y `cambiar-password`

**Files:** Create `appwrite/functions/usuarios-admin/src/main.js`, `appwrite/functions/cambiar-password/src/main.js` y sus tests.

**Interfaces — Produces:** `usuarios-admin` in `{accion:'crear'|'cambiar_rol'|'activar'|'desactivar'|'reset', id?, email?, nombre?, rol?, passwordTemporal?}` solo si el llamador es admin activo; `crear` exige `passwordTemporal` ≥ 12 caracteres, asigna etiqueta de rol, crea `perfiles/<id>` con `activo:true` y auditoría; `desactivar` pone `activo:false`, bloquea la cuenta y borra sus sesiones; un admin no puede desactivarse ni quitarse el rol a sí mismo. `cambiar-password` in `{actual, nueva}`: verifica `actual` iniciando sesión con el correo del llamador, exige `nueva` ≥ 12 y distinta de `actual`, y la aplica por API de servidor.

- [ ] **Step 1: Tests que fallan:** no-admin → 403; password de 11 caracteres → 400; admin no puede desactivarse a sí mismo; `desactivar` invoca borrado de sesiones; rol fuera del catálogo → 400; `cambiar-password` con `actual` incorrecta → 403.
- [ ] **Step 2:** Run `node --test appwrite/functions/usuarios-admin appwrite/functions/cambiar-password` → FAIL.
- [ ] **Step 3:** Implementar ambas funciones.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit.

### Task 6: Functions `importar-excel` y `bases-admin`

**Files:** Create `appwrite/functions/importar-excel/src/main.js`, `appwrite/functions/bases-admin/src/main.js`, tests, y `src/lib/excel.ts` (parser en front).

**Interfaces — Produces:** `parsearHojaOperadores(filas: any[][], reclutadores: {id:string;nombre:string}[], hoy: Date): { filas: OperadorInput[]; errores: {fila:number; mensaje:string}[] }` en `excel.ts`. Mapea columnas por encabezado del Excel (A–Q); texto "N|A (LOCAL)"→`NA_LOCAL`, "OP. VIAJE"→`OP_VIAJE`, "OK"→`OK`, "NO APTO"→`NO_APTO`, fecha real→`FECHA`; ignora filas vacías y recorta espacios; reclutador por nombre (CARMEN→perfil); estatus "PREMEDICO CRYO"→`PREMEDICO_CRYO` etc.; hoja DESCARTADOS → `DESCARTADO` con `observaciones` como `motivo_descarte`. `importar-excel` in `{filas: OperadorInput[], confirmar:boolean}`: sin `confirmar` valida y devuelve vista previa/errores sin escribir; con `confirmar` crea en lote y audita. Solo admin y gerente_rh. `bases-admin` in `{accion:'crear'|'activar'|'desactivar', nombre}` solo admin.

- [ ] **Step 1: Tests que fallan** (parser con las filas reales del Excel de octubre como fixture): 26 activos + 2 descartados parseados sin errores; `'MARIO PRUEBA GARCIA '` recortado; duplicado dentro del archivo → error con número de fila; reclutador inexistente → error; función sin `confirmar` no escribe nada; rol `reclutador` → 403.
- [ ] **Step 2:** Run `npx vitest run src/lib/excel` y `node --test appwrite/functions/importar-excel` → FAIL.
- [ ] **Step 3:** Implementar parser y funciones.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit.

### Task 7: Despliegue de Functions y pruebas de permisos reales

**Files:** Create `appwrite/deploy-functions.mjs`, `appwrite/test-permisos.mjs`.

**Interfaces — Produces:** `deploy-functions.mjs` copia `shared/` a cada función, empaqueta y despliega las 5 funciones (runtime Node 22, `execute: ['users']`, variable `APPWRITE_API_KEY` solo del lado de la función). `test-permisos.mjs` crea un usuario temporal por rol (vía `usuarios-admin`), ejecuta la matriz del spec §5 contra Appwrite real y borra los usuarios de prueba.

- [ ] **Step 1:** Escribir `test-permisos.mjs` con aserciones: escritura directa a `operadores`/`auditoria`/`perfiles` por cualquier rol → rechazada; `consulta` lee operadores pero no `auditoria`; `reclutador` no lee `auditoria`; reclutador edita solo asignado; admin sin sesión → rechazado; usuario desactivado → rechazado en la siguiente ejecución; versión vieja → 409.
- [ ] **Step 2:** Run `node appwrite/deploy-functions.mjs` → Expected: 5 funciones con deployment `ready`.
- [ ] **Step 3:** Run `node appwrite/test-permisos.mjs` → Expected: todas las aserciones PASS, 0 usuarios de prueba restantes.
- [ ] **Step 4:** Commit.

### Task 8: Núcleo del front (auth, router, estilos, shell)

**Files:** Create `src/lib/{appwrite,auth,api}.ts`, `src/ui/{app.tsx,layout.tsx,estilos.css}`, `src/ui/paginas/login.tsx`, `src/ui/componentes/toast.tsx`; Test `src/lib/auth.test.ts`.

**Interfaces — Produces:**
```ts
// auth.ts
export type Sesion = { id:string; nombre:string; rol:Rol; email:string }
export function iniciarSesion(email:string, password:string): Promise<Sesion>
export function cerrarSesion(): Promise<void>
export function sesionActual(): Promise<Sesion|null>   // lee perfiles/<uid>; si activo=false cierra sesión y devuelve null
export function iniciarTemporizadorInactividad(minutos:number, alExpirar:()=>void): ()=>void
// api.ts
export function guardarOperador(accion:string, datos:OperadorInput, id?:string, version?:number): Promise<{ok:true;doc:any}|{ok:false;status:number;errores:ErrorValidacion[]}>
export function ejecutar<T>(funcionId:string, cuerpo:unknown): Promise<T>
```
Rutas (hash): `#/login`, `#/panel`, `#/operadores`, `#/tablero`, `#/descartados`, `#/reportes`, `#/importar`, `#/auditoria`, `#/usuarios`, `#/bases`; el menú solo muestra lo permitido por rol (consulta no ve importar/usuarios/auditoría; reclutador no ve usuarios/bases/auditoría).

- [ ] **Step 1: Test que falla:** `iniciarTemporizadorInactividad(30, cb)` llama `cb` tras 30 min simulados sin eventos y se reinicia con actividad.
- [ ] **Step 2:** Run `npx vitest run src/lib/auth` → FAIL; implementar; → PASS.
- [ ] **Step 3:** Implementar tokens de diseño (CSS variables), tipografías, shell con barra lateral mínima, pantalla de Login (errores genéricos, sin revelar si el correo existe) y cambio de contraseña forzado (usa `cambiar-password`).
- [ ] **Step 4:** Run `npm run build` → Expected: OK. Verificación visual con Playwright (captura de login y shell vacío en 1440 y 390 px).
- [ ] **Step 5:** Commit.

### Task 9: Pantalla Operadores (tabla, edición rápida, Realtime)

**Files:** Create `src/lib/store.ts`, `src/ui/paginas/operadores.tsx`, `src/ui/componentes/{tabla,drawer,filtros}.tsx`; Test `src/lib/store.test.ts`.

**Interfaces — Produces:** `store.ts`: `cargarOperadores(): Promise<void>` (paginación por cursor, lotes de 100), `suscribirOperadores(): ()=>void` (Realtime; al reconectar recarga), `operadores: Signal<OperadorInput & {id:string; version:number}[]>`, `aplicarEvento(ev)` puro y testeable. Pantalla: tabla con filtros (mes por `fecha_inicio`, base, reclutador, estatus, búsqueda por nombre), columnas de etapas como celdas editables (fecha o resultado), atajos (`Enter` guarda, `Esc` cancela, flechas navegan), panel lateral con detalle y observaciones, alta de operador. Errores de validación en línea; conflicto 409 muestra aviso "Este registro cambió" con botón Recargar que conserva el texto del usuario. Celdas bloqueadas (solo lectura) si `!puedeEditar`.

- [ ] **Step 1: Tests que fallan:** `aplicarEvento` crea/actualiza/quita según evento; evento con `version` menor al local se ignora; más de 100 documentos se cargan en varias páginas.
- [ ] **Step 2:** Run `npx vitest run src/lib/store` → FAIL; implementar; → PASS.
- [ ] **Step 3:** Implementar la pantalla y componentes.
- [ ] **Step 4:** Verificación en navegador (Playwright, dos contextos con distinto usuario): un cambio en uno aparece en el otro en < 3 s; edición simultánea del mismo registro produce el aviso de conflicto.
- [ ] **Step 5:** Commit.

### Task 10: Panel, Tablero y Descartados

**Files:** Create `src/ui/paginas/{panel,tablero,descartados}.tsx`.

**Interfaces — Consumes:** `operadores` del store, `totalDias`. Produce: Panel (conteo en proceso por etapa actual, promedio de días, lista de atrasados con umbral configurable, por defecto 15 días sin avance), Tablero por estatus (columnas, arrastrar solo cambia estatus vía `guardarOperador('actualizar')`), Descartados (lista con motivo y fecha; restaurar solo admin/gerente).

- [ ] **Step 1:** Test unitario de las agregaciones (`conteoPorEtapa`, `promedioDias`, `atrasados(ops, hoy, umbral)`) en `src/lib/metricas.ts` con casos del Excel.
- [ ] **Step 2:** Run → FAIL; implementar → PASS.
- [ ] **Step 3:** Implementar las 3 pantallas (estados vacíos incluidos).
- [ ] **Step 4:** Verificación visual con Playwright.
- [ ] **Step 5:** Commit.

### Task 11: Importar Excel y Reportes

**Files:** Create `src/ui/paginas/{importar,reportes}.tsx`; Modify `src/lib/excel.ts` (añadir `exportarOperadores(ops, formato): Blob`).

**Interfaces — Consumes:** `parsearHojaOperadores`, función `importar-excel`. Produce: flujo subir `.xlsx` → vista previa con errores por fila → confirmar; reportes exportan `.xlsx` (operadores filtrados, resumen por etapa, descartados) con encabezados idénticos al Excel original. Límite de tamaño de archivo 5 MB y solo `.xlsx`.

- [ ] **Step 1:** Test: exportar e importar de nuevo el mismo conjunto produce filas equivalentes (ida y vuelta).
- [ ] **Step 2:** Run → FAIL; implementar → PASS.
- [ ] **Step 3:** Cargar el Excel real de octubre (`Operadores_en_ProcesoFNG_2026.xlsx`) con la vista previa; Expected: 28 filas aceptadas, 0 errores.
- [ ] **Step 4:** Commit.

### Task 12: Usuarios, Bases y Auditoría

**Files:** Create `src/ui/paginas/{usuarios,bases,auditoria}.tsx`.

**Interfaces — Consumes:** `ejecutar('usuarios-admin'|'bases-admin', …)`, lectura de `auditoria`. Produce: Usuarios (alta con rol y contraseña temporal generada, cambio de rol, activar/desactivar, restablecer), Bases, Auditoría (filtros por usuario, entidad, fecha; detalle antes/después en dos columnas, solo lectura, paginación por cursor).

- [ ] **Step 1:** Implementar las tres pantallas con confirmaciones en acciones destructivas.
- [ ] **Step 2:** Verificación Playwright: admin crea un reclutador, éste inicia sesión y debe cambiar contraseña; el admin ve la entrada en auditoría; desactivarlo cierra su sesión activa.
- [ ] **Step 3:** Commit.

### Task 13: E2E, endurecimiento y revisión de seguridad

**Files:** Create `e2e/{login,operadores,permisos}.spec.ts`; Modify `index.html` si la CSP lo requiere.

- [ ] **Step 1:** Escribir los E2E: login correcto/incorrecto, captura de etapa, conflicto, matriz de menú por rol, expiración por inactividad.
- [ ] **Step 2:** Run `npm run test:e2e` → Expected: PASS.
- [ ] **Step 3:** Ejecutar la skill `securitymaxxing:audit` sobre el repo y las Functions; corregir hallazgos críticos/altos con pruebas; registrar el resultado en `docs/seguridad.md`.
- [ ] **Step 4:** Run `npm test && npm run build` → Expected: todo PASS.
- [ ] **Step 5:** Commit.

### Task 14: Despliegue en GitHub Pages y cierre

**Files:** Create `.github/workflows/deploy.yml`, `README.md` (operación, respaldo manual, rotación de llaves).

- [ ] **Step 1:** Workflow: en push a `main`, `npm ci && npm test && npm run build`, subir `dist` con `actions/upload-pages-artifact` y desplegar con `actions/deploy-pages` (versiones fijadas). Activar Pages con origen "GitHub Actions" (API con token del usuario o paso manual indicado en README).
- [ ] **Step 2:** Pedir al usuario registrar la plataforma web en Appwrite (hostname `hillaryr6298-cpu.github.io`); sin esto el login desde Pages fallará por CORS.
- [ ] **Step 3:** Push; esperar el workflow; abrir `https://hillaryr6298-cpu.github.io/fng-operadores/`; iniciar sesión como admin y verificar con Playwright.
- [ ] **Step 4:** Importar el Excel de octubre en producción (28 filas) y verificar conteos contra el Excel.
- [ ] **Step 5:** Entregar al usuario la lista de cierre: revocar la API key y el token de GitHub compartidos en el chat y crear nuevos con el mínimo permiso; cambiar la contraseña temporal del admin; documentar respaldo manual.
