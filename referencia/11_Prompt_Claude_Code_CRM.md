# 11 · Prompt para Claude Code — CRM Lube N Save v2

> **Cómo usarlo:** abre Claude Code en una carpeta nueva (ej. `C:\Users\NUC\Desktop\CRM-LNS`), copia en esa carpeta los 3 archivos de referencia indicados abajo y pega todo el bloque de “PROMPT” como primer mensaje.

**Archivos que debes copiar a la carpeta del proyecto antes de empezar:**
1. `09_CRM_v2_prototipo.html` → renómbralo a `referencia/prototipo.html`
2. `10_Indicaciones_Integracion_TallerFLOW.md` → `referencia/plan.md`
3. `Lube N Save Zona 10 - Reporte de Actividad - Cotizaciones - 01-07-2026 - 30-09-2026.xlsx` → `referencia/cm_jul_sep_2026.xlsx` (**no subir este archivo a GitHub**: tiene datos de clientes)

---

## PROMPT (copiar desde aquí)

Hola. Soy Byron Santos, jefe de taller de Lube N Save Zona 10 (Guatemala). Vamos a convertir un prototipo funcional en una aplicación web real. Háblame en español, de tú, breve y directo. **Antes de escribir código, preséntame un plan corto y espera mi aprobación.** Trabaja por fases y detente al final de cada una para que yo pruebe.

### Contexto
- El prototipo `referencia/prototipo.html` ya funciona y tiene el diseño y la lógica aprobados: 5 pantallas (Hoy, Cartera, Caso, Importar Clear Mechanic, Semana), importación del Excel de Clear Mechanic con SheetJS, agenda diaria, bitácora, mensajes de WhatsApp e incentivo del asesor. Hoy guarda en `localStorage`; hay que pasarlo a Firebase.
- `referencia/plan.md` tiene el plan, el modelo de datos y las reglas. Léelo completo antes de proponer nada.
- **Respeta el diseño del prototipo** (negro #141414 / amarillo #FFE500, tipografías, textos). No lo rediseñes.

### Restricciones (no negociables)
1. **No tocar TallerFLOW** (ni su repositorio ni su Firebase `lube-n-save-flow`). La única relación es el enlace que ya existe: `https://lubensave2026.github.io/tallerFLOW/?nueva=1&placa=…&ot=…&modelo=…&cliente=…&km=…`
2. **Proyecto Firebase nuevo y exclusivo** para el CRM. Yo lo creo en la consola; tú me das los pasos exactos y me dices qué datos de configuración pegar.
3. **Firebase es la única fuente de verdad.** Nada de localStorage para datos (solo para preferencias de vista). En TallerFLOW tuvimos un bug de pérdida de datos por mezclar localStorage y Firebase; no lo repitas.
4. **Escrituras por documento** (`updateDoc` con campos puntuales, `arrayUnion` para la bitácora). Nunca reescribir colecciones o arreglos completos. La importación usa `writeBatch` (máx. 500 operaciones por lote).
5. **Un solo archivo HTML** (como TallerFLOW) más un `README.md`, salvo que propongas algo mejor y yo lo apruebe.
6. **No subir datos de clientes al repositorio.** Agrega `referencia/*.xlsx` al `.gitignore`.
7. **Prueba visual obligatoria:** antes de entregarme cada fase, corre Playwright/Chromium headless, toma capturas de las 5 pantallas (escritorio 1280 px y móvil 400 px) y revísalas. No te bases solo en que el JS no tenga errores de sintaxis.

### Stack
- HTML + JS sin framework, igual que el prototipo.
- Firebase JS SDK modular (v10, desde `https://www.gstatic.com/firebasejs/`), Firestore + Authentication (anónima) para poder aplicar reglas.
- SheetJS 0.18.5 desde cdnjs para leer el Excel.
- Publicación en GitHub Pages: repositorio `crm` en la cuenta `lubensave2026` → `https://lubensave2026.github.io/crm/`

### Modelo de datos (Firestore)
- `crm_casos/{OT}`: cliente, movil, vehiculo, placa, km, fecha (YYYY-MM-DD de la cotización más reciente), sem (rojo|amarillo|verde), estado (Pendiente|Rechazado|Sin respuesta|En negociación|Reprogramado|Recuperado|Perdido|En taller), proximo, motivo, seg {s48,s7,s30}, partidas {"<punto de inspección>": {punto,total,mo,estadoCM,fechaCM,recuperada}}, recuperos [{fecha,monto,mo,tipo,usuario}], bitacora [{fecha,canal,resultado,nota,usuario}], actualizado, actualizadoPor.
- `crm_agenda/{YYYY-MM-DD}`: {ots:[...], creadaPor, creada}. **Se crea con una transacción** para que dos dispositivos no generen agendas distintas el mismo día.
- `crm_config/zona10`: {min:2, max:5, meta, pct1, pct2, base:'total'|'mo', asesor:'Ricardo'}. Solo rol jefe edita.
- `crm_importaciones/{auto}`: {fecha, archivo, filas, nuevos, actualizados, recuperados, montoRecuperado, usuario}.
- `crm_usuarios/{id}`: {nombre, rol: jefe|asesor|consulta, pinHash (SHA-256 + sal)}.

### Acceso
- Pantalla de entrada con PIN. Usuarios iniciales: Byron (jefe), Ricardo (asesor), Mario (consulta, solo lectura). Yo te doy los PIN cuando lo pidas; no los escribas en el código.
- Rol **consulta**: ve todo, no ve botones de acción ni Ajustes. Rol **asesor**: todo menos Ajustes. Rol **jefe**: todo.
- Reglas de Firestore: solo usuarios autenticados; `crm_config` y `crm_usuarios` solo escribibles por el rol jefe (propón cómo validarlo en las reglas). Explícame las limitaciones de seguridad de un PIN en el cliente.

### Lógica que debe conservarse del prototipo (no la cambies sin avisarme)
- Importación: solo filas `Tipo = "Cotización - Total"`. Clave única **OT + Punto de Inspección**. Estados CM: "Aprobado…" → Aprobado, "Rechazado…" → Rechazado, resto → Pendiente. Si una partida antes Rechazada/Pendiente llega Aprobada → `recuperada=true` y entra a `recuperos` con tipo `clear-mechanic`. Las filas "Punto de Inspección" sin total y con estado aprobado/rechazado se cuentan como avisos de calidad.
- Urgencia automática "rojo" por palabras clave (frenos, fugas, dirección, bolsa de aire, llantas, bomba de agua, radiador, fajas, suspensión…), editable a mano.
- Agenda: entre `min` y `max` casos; primero reprogramados vencidos y seguimientos vencidos (48 h, 7 d, 30 d desde la fecha de cotización), después por puntaje = monto/1000 × urgencia (3/2/1) × factor antigüedad (≤7 d 1.2 · ≤30 d 1.0 · ≤60 d 0.8 · más 0.6).
- Autorizó parcial descuenta el monto del pendiente del caso. Perdido exige motivo.
- Aviso en "Hoy" si la última importación tiene más de 7 días.
- Incentivo: pct1 sobre lo recuperado hasta la meta + pct2 sobre el excedente, base total o mano de obra.

### Pruebas de aceptación (fase 1)
Con `referencia/cm_jul_sep_2026.xlsx`:
- Importación: **3,631 filas · 179 órdenes · 742 partidas · 102 casos nuevos · Q1,068,512 en cartera · 54 avisos de calidad.**
- Volver a importar el mismo archivo: **0 casos nuevos, 0 duplicados**, cartera igual.
- Registrar un "Autorizó parcial" de Q22,699 en la OT 5381: la cartera baja a Q1,045,813 y el reporte de la semana muestra Q22,699 recuperado.
- Abrir la app en dos navegadores con usuarios distintos: lo que registra uno aparece en el otro sin recargar.

### Fases
1. **Fase 1:** proyecto Firebase + PIN + migración del prototipo a Firestore + importación + pruebas de aceptación. Publicado en GitHub Pages.
2. **Fase 2:** respaldo semanal exportable (Excel de la cartera y de la bitácora) y ajustes de uso que yo te pida después de probar con Ricardo.

Empieza leyendo `referencia/plan.md` y `referencia/prototipo.html`, y preséntame tu plan para la fase 1 (pasos, archivos que vas a crear y qué necesitas de mí). No escribas código hasta que te diga “adelante”.

## (fin del prompt)
