# CRM Lube N Save

Sistema para recuperar presupuestos no autorizados en Clear Mechanic (Lube N Save Zona 10).
Un solo archivo (`index.html`), Firebase (Firestore + Auth anónima) y GitHub Pages: https://lubensave2026.github.io/crm/

## Cómo funciona
- **Datos:** Firestore, proyecto `crm-lube-n-save` (independiente de TallerFLOW). Colecciones `crm_casos`, `crm_agenda`, `crm_config`, `crm_importaciones`, `crm_usuarios`. No se guarda ningún dato en localStorage (solo la pestaña activa y el último usuario).
- **Escrituras:** por documento (`updateDoc`, `arrayUnion` para bitácora y recuperos). La importación usa `writeBatch` en lotes de 450 operaciones. La agenda del día se crea con una transacción.
- **Acceso:** PIN de 6 dígitos por usuario. Roles: `jefe` (todo), `asesor` (todo menos Ajustes), `consulta` (solo lectura).
- **Importación:** solo filas `Cotización - Total`; clave OT + punto de inspección; reimportar no duplica.
- **TallerFLOW:** solo el enlace "Abrir orden en TallerFLOW". El CRM no lee ni escribe su Firebase.

## Respaldo semanal
En **Semana → Respaldo** (jefe y asesor) se descarga `CRM_LNS_Respaldo_AAAA-MM-DD.xlsx` con las hojas Resumen, Cartera, Partidas, Bitácora y Recuperos (incluye casos cerrados). La fecha del último respaldo se guarda en `crm_config/zona10.ultimoRespaldo`; si pasan más de 7 días, el jefe ve un aviso en "Hoy". El archivo trae datos de clientes: guardarlo fuera del repositorio (los `.xlsx` están en `.gitignore`). No hay restauración desde el Excel; si se perdiera la base, la cartera se reconstruye importando de Clear Mechanic, pero se perdería la bitácora.

## Puesta en marcha (una sola vez)
1. Firebase: Firestore creado (nam5) y Authentication → método **Anónimo** activado.
2. Reglas: `firebase deploy --only firestore:rules --project crm-lube-n-save`
3. Usuarios y PIN (los escribes tú; no quedan en ningún archivo):
   ```
   cd tests && npm install && node seed-usuarios.mjs
   ```
4. GitHub Pages: Settings → Pages → rama `main`, carpeta `/ (root)`.

## Pruebas
```
cd tests && npm install
node import-logic.mjs   # importación con el Excel real (referencia/*.xlsx, no se sube al repo)
node ui-test.mjs        # Chromium headless con Firebase simulado; capturas en tests/out/
```
Esperado con el Excel jul–sep 2026: 3,631 filas · 179 órdenes · 742 partidas · 102 casos · Q1,068,512 · 54 avisos.

## Límites de seguridad (importante)
Con autenticación anónima, las reglas de Firestore solo saben que "hay una sesión", no quién es ni su rol.
- Los roles y la restricción de `crm_config`/`crm_usuarios` se aplican **en la interfaz**, no en las reglas.
- Quien abra la app puede leer los hashes de PIN; un PIN de 6 dígitos se podría adivinar por fuerza bruta. Por eso: no difundir la URL y no guardar en el sistema nada más sensible que lo operativo.
- Para seguridad real haría falta una Cloud Function que verifique el PIN y emita un token con el rol (plan Blaze).
- El repositorio es público (Pages gratis): no contiene datos de clientes. `referencia/*.xlsx` y `*.docx` están en `.gitignore`.

## Notas
- Las llaves de `partidas` reemplazan `. / ~ * [ ] \`` por `_` (Firestore las trata como rutas); el nombre original queda en `punto`.
- "Hoy" usa la hora de Guatemala.
- Las entradas de bitácora/recuperos llevan `usuario` y `ts` (para que `arrayUnion` no fusione contactos idénticos).
