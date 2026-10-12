# CRM Lube N Save

CRM independiente (separado de los demás proyectos del usuario). Se publica en **GitHub Pages** (sitio estático) y guarda sus datos en **Firebase**.

## Infraestructura
- Firebase project ID: `crm-lube-n-save` (nombre: "CRM Lube N Save"), creado con la cuenta brsantosc@gmail.com.
- Hosting: GitHub Pages (no Firebase Hosting). Firebase se usa solo para datos/auth (Firestore, Auth, etc.).
- Repo git en `main`. Remoto: `lubensave2026/crm` → https://lubensave2026.github.io/crm/
- Firestore en `nam5`. Seguridad: opción A (PIN en cliente + auth anónima); ver README.
- Sin relación con TallerFLOW: no tocarlo ni su Firebase `lube-n-save-flow`. El enlace "Abrir orden en TallerFLOW" se quitó (2026-10-09). Se conserva "Marcar en taller".

## Reglas de trabajo
- Este proyecto es aislado: no mezclar código, credenciales, memoria ni configuración de otros proyectos.
- Idioma de comunicación con el usuario: español.
- Al ser sitio estático en GitHub Pages, no hay backend propio: la lógica va en el cliente + reglas de seguridad de Firebase (Firestore Rules obligatorias, nunca dejar modo abierto).
- La config web de Firebase (apiKey, etc.) es pública por diseño; la seguridad depende de las Rules y Auth.
- **Manual y novedades:** el manual de usuario vive dentro de `index.html` (constantes `MAN` y `NOVEDADES`, pestaña "Manual de usuario"). Cada cambio visible para los usuarios debe: (1) actualizar la sección del manual afectada y (2) agregar una entrada ARRIBA en `NOVEDADES` con id ascendente (p. ej. `2026-10-20a`), para que a cada usuario le salga el aviso amarillo. `referencia/Manual_Asesor_CRM_LNS.docx` quedó obsoleto (no actualizarlo).
- Confirmar con el usuario antes de acciones externas/irreversibles (push, deploy, reglas en producción, borrado de datos).

## Estructura
- `index.html` (toda la app; la lógica pura va entre `/*@PURA-INICIO*/` y `/*@PURA-FIN*/` y la ejecutan los tests), `firestore.rules`, `README.md`.
- `referencia/` prototipo, plan y Excel real (xlsx/docx ignorados por git). `tests/` pruebas (`import-logic.mjs`, `ui-test.mjs`, `seed-usuarios.mjs`).
- Reglas del prototipo que no se cambian sin avisar a Byron: ver `referencia/plan.md` y el prompt original.

## Estado
- Fase 1 CERRADA y en vivo (2026-10-09): https://lubensave2026.github.io/crm/ . Verificado: importación (102 casos · Q1,068,512 · 54 avisos), reimportación sin duplicados, parcial OT 5381, sincronización en tiempo real entre dos usuarios.
- Auth anónima activa, usuarios Byron/Ricardo/Mario creados con `tests/seed-usuarios.mjs` (PIN de 6 dígitos, no guardados en archivos).
- Datos de prueba reales en producción: Ricardo ya registró contactos de prueba (OT 5381 parcial Q22,699, etc.).
- Datos de prueba borrados y reimportados (2026-10-09); producción limpia.
- Usuarios: cambio de PIN propio, y el jefe agrega/restablece/desactiva usuarios desde Ajustes. Plan a futuro: copias independientes por sede (Carretera al Salvador, Aguilar Batres) con el mismo código y bloque de configuración; cada sede usa su propio Clear Mechanic y no tiene TallerFLOW; metas e incentivos los define cada encargado con Jacobo.
- Enlaces de inspección (2026-10-12): carga de "Formas de Inspección" (columna Orden digital) → `crm_enlaces/zona10`; botón "Ver reporte" y enlace en el mensaje de WhatsApp. La carga semanal incluye ambos reportes. Pendiente del usuario: bajar Formas de Inspección con rango más amplio para cubrir OT < 5212 (casos 5211 y 5209).
- Manual de usuario en la app + avisos de novedades por usuario (2026-10-12; lo visto se guarda en localStorage por usuario y dispositivo).
- Fase 2 hecha: respaldo en Excel (Semana → Respaldo, jefe/asesor, aviso a los 7 días al jefe) y plurales corregidos. Pendiente: ajustes de uso que pida Byron tras probar con Ricardo.
