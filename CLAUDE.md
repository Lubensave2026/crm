# CRM Lube N Save

CRM independiente (separado de los demás proyectos del usuario). Se publica en **GitHub Pages** (sitio estático) y guarda sus datos en **Firebase**.

## Infraestructura
- Firebase project ID: `crm-lube-n-save` (nombre: "CRM Lube N Save"), creado con la cuenta brsantosc@gmail.com.
- Hosting: GitHub Pages (no Firebase Hosting). Firebase se usa solo para datos/auth (Firestore, Auth, etc.).
- Repo git en `main`. Remoto: `lubensave2026/crm` → https://lubensave2026.github.io/crm/
- Firestore en `nam5`. Seguridad: opción A (PIN en cliente + auth anónima); ver README.
- No tocar TallerFLOW ni su Firebase `lube-n-save-flow`; solo existe el enlace de apertura de órdenes.

## Reglas de trabajo
- Este proyecto es aislado: no mezclar código, credenciales, memoria ni configuración de otros proyectos.
- Idioma de comunicación con el usuario: español.
- Al ser sitio estático en GitHub Pages, no hay backend propio: la lógica va en el cliente + reglas de seguridad de Firebase (Firestore Rules obligatorias, nunca dejar modo abierto).
- La config web de Firebase (apiKey, etc.) es pública por diseño; la seguridad depende de las Rules y Auth.
- Confirmar con el usuario antes de acciones externas/irreversibles (push, deploy, reglas en producción, borrado de datos).

## Estructura
- `index.html` (toda la app; la lógica pura va entre `/*@PURA-INICIO*/` y `/*@PURA-FIN*/` y la ejecutan los tests), `firestore.rules`, `README.md`.
- `referencia/` prototipo, plan y Excel real (xlsx/docx ignorados por git). `tests/` pruebas (`import-logic.mjs`, `ui-test.mjs`, `seed-usuarios.mjs`).
- Reglas del prototipo que no se cambian sin avisar a Byron: ver `referencia/plan.md` y el prompt original.

## Estado
- Fase 1 construida y probada con Firebase simulado. Pendiente: activar Auth anónima, ejecutar seed de usuarios, publicar en Pages y probar en vivo con 2 navegadores.
