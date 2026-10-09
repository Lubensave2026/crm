# 10 · CRM Lube N Save v2 — Plan de implementación (versión simplificada)

**Actualizado:** 09/10/2026 · proyecto PUBLICIDAD
**Decisión de Byron:** el CRM funciona **solo con Clear Mechanic**. **TallerFLOW no se integra** en esta etapa y **no se le hace ningún cambio**.

---

## 1. Qué es

Sistema para recuperar presupuestos no autorizados en Clear Mechanic (CM). Línea base jul–sep 2026: Q1,869,672 cotizado · 43% aprobado en quetzales · **Q1,068,512 dormido en 102 OT**.

Pantallas: **Hoy** (2 a 5 casos/día) · **Cartera** · **Caso** (partidas, bitácora, mensaje de WhatsApp) · **Importar Clear Mechanic** · **Semana** (reporte del sábado + incentivo del asesor).

Prototipo funcional: `09_CRM_v2_prototipo.html` (guarda solo en el navegador).

## 2. Flujo de datos

```
Clear Mechanic ──(Excel semanal)──> CRM ──(enlace existente, sin cambios)──> TallerFLOW
```

- **Carga semanal (cada lunes):** “Reporte de Actividad – Cotizaciones” de los **últimos 30 días**. Unos 5 minutos.
- **Barrida trimestral:** subir el trimestre completo para rescatar casos viejos.
- La importación nunca duplica (clave: OT + punto de inspección) y detecta lo que pasó a “Aprobado”.
- Si pasan más de 7 días sin carga, la pantalla Hoy muestra un aviso.

## 3. Relación con TallerFLOW

- **Ninguna integración de datos.** El CRM no lee ni escribe en TallerFLOW.
- Solo se conserva el botón **“Abrir orden en TallerFLOW”**, que usa el enlace que TallerFLOW ya acepta hoy:
  `https://lubensave2026.github.io/tallerFLOW/?nueva=1&placa=…&ot=…&modelo=…&cliente=…&km=…`
- Para evitar contactar a un cliente cuyo carro ya está en el taller: botón **“Marcar en taller”** en el caso + la siguiente carga semanal detecta la aprobación.

## 4. Implementación (Fase 1 — única por ahora)

| Punto | Definición |
|---|---|
| Dónde vive | GitHub Pages, carpeta nueva: `https://lubensave2026.github.io/crm/` |
| Guardado | Firebase (Firestore) en colecciones propias `crm_*`. Puede ser un proyecto Firebase nuevo o el mismo `lube-n-save-flow` **sin tocar sus colecciones**. Recomendado: proyecto nuevo, para aislar por completo. |
| Acceso | PIN por usuario (jefe: Byron · asesor: Ricardo · bodega: Mario, solo lectura) |
| Lector de Excel | SheetJS 0.18.5 (cdnjs) |
| Quién lo hace | La sesión con acceso al repositorio de GitHub (Claude Code o Cowork), usando el prototipo 09 como base |

### Colecciones
- `crm_casos/{OT}` — cliente, móvil, vehículo, placa, km, fecha, urgencia (rojo/amarillo/verde), estado, próximo contacto, motivo de pérdida, seguimientos {s48,s7,s30}, partidas {punto: total, M.O., estado CM, recuperada}, recuperos [fecha, monto, M.O., tipo], bitácora [fecha, canal, resultado, nota, usuario].
- `crm_agenda/{YYYY-MM-DD}` — OT asignadas del día (se congela al primer acceso).
- `crm_config/zona10` — mín./máx. de casos, meta mensual, % del incentivo, base (total o M.O.). Solo jefe edita.
- `crm_importaciones/{auto}` — historial de cargas.
- `crm_usuarios/{id}` — nombre, rol, PIN (hash).

### Reglas técnicas
1. Firebase es la única fuente de verdad (nada de localStorage como respaldo de datos).
2. Escrituras por documento; bitácora con `arrayUnion`; importación con `writeBatch` (máx. 500 operaciones por lote).
3. Prueba visual con Playwright/Chromium y capturas antes de publicar.
4. Probar la importación con el archivo real `Lube N Save Zona 10 - Reporte de Actividad - Cotizaciones - 01-07-2026 - 30-09-2026.xlsx`. Resultado esperado: 102 casos · Q1,068,512 · 54 avisos de calidad.

## 5. Incentivo del asesor (propuesta, sujeta a aprobación de gerencia)

Configurable: % hasta la meta mensual y % mayor sobre el excedente. Ejemplo del prototipo: meta Q60,000 · 1% / 2%. Base recomendada: **mano de obra recuperada** (protege el margen de repuestos).

## 6. Integración futura con TallerFLOW (opcional, solo si hace falta)

Queda documentada para más adelante, no se implementa ahora:
- Leer órdenes de TallerFLOW para marcar casos “En taller” automáticamente.
- Parámetro `origen=crm` en TallerFLOW para etiquetar órdenes recuperadas.
- Aviso en TallerFLOW cuando reingresa un vehículo con presupuesto dormido.
