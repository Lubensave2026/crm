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
- App instalable (2026-10-13): `manifest.webmanifest` + `icons/` generados del logo `referencia/logotipo general.jpg` (recorte central 640 px) + logo en el login; sin service worker a propósito. `tests/pwa-check.mjs` valida manifiesto e íconos.
- Ajuste por descuento (2026-10-13): solo jefe, en el caso, "Ajustar a recuperación total (descuento)" → campo `descuento` del caso, partidas cerradas, el monto recuperado no cambia; se ve en Semana y en el respaldo. Casos cerrados ya no muestran mensaje sugerido.
- Cierre mensual (2026-10-13): `crm_cierres/{AAAA-MM}` guarda meta, %, base, recuperado, incentivo, autorizaciones y contactos del mes con la config vigente; solo el jefe cierra (reemplazable con confirmación); hoja "Cierres mensuales" en el respaldo. Lógica pura: `calcMes`, `incentivoCalc`, `listaMeses`.
- Caso que ya estaba autorizado (2026-10-13): solo jefe, "Quitar de lo recuperado (ya estaba autorizado)" quita los recuperos `clear-mechanic` del caso (arrayRemove), deja las partidas Aprobado sin `recuperada` y Recuperado→En taller. Pruebas: datos fijos en `tests/fixtures/` (gitignored; copias de los Excel jul–sep y Formas de Inspección) — no dependen de `referencia/`.
- Importador y formato de Clear Mechanic (2026-10-13): el reporte nuevo cambió "Fecha / Hora" por "Fecha / Hora de apertura de Orden"; se aceptan ambos y la fecha es obligatoria (si falta, se rechaza el archivo). Las columnas extra se ignoran: NO hace falta borrar columnas del reporte; solo no renombrar/quitar las usadas (OR #, fecha de apertura, Nombre, Apellido, Móvil, Marca, Modelo, Año, Kilometraje, Placas, Tipo, Punto de Inspección, Cotización - M.O., Cotización - Total, ¿Aprobado o Rechazado?; y en Formas: OR # y Orden digital). Volver a importar repara casos con fecha vacía. Sección "Pendientes de días anteriores" en Hoy.
- Correcciones del jefe en casos cerrados (2026-10-13): "Marcar como Recuperado" (solo estado, si ya hay `recuperos`) y "Registrar recuperación" (pide monto; canal Sistema, no cuenta como contacto) para casos En taller/Perdido. Las recargas de Clear Mechanic no cambian el estado ni lo recuperado de casos existentes (probado); una orden nueva con otra OT ya aprobada no crea caso.
- Fase 2 hecha: respaldo en Excel (Semana → Respaldo, jefe/asesor, aviso a los 7 días al jefe) y plurales corregidos. Pendiente: ajustes de uso que pida Byron tras probar con Ricardo.
