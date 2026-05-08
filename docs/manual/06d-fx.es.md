# Capítulo 6d — FX (Tasas de cambio y revaluación)

## 1. Propósito

Este capítulo cubre dos funciones distintas que suelen confundirse:

1. **Tasa diaria oficial (BCRD)** — captura automática de la tasa USD/DOP
   publicada por el Banco Central, usada como sugerencia en cualquier
   transacción multi-moneda.
2. **Revaluación FX al cierre** — recalcula el valor en DOP de los
   documentos abiertos en moneda extranjera al final del período (CxP, CxC y
   Casa Matriz), generando un asiento de ajuste a 8510.

## 2. Roles y permisos

| Acción | Admin | Accountant | Otros |
|---|---|---|---|
| Ver tasas | ✓ | ✓ | lectura |
| Forzar scrape de tasa | ✓ | ✓ | — |
| Ejecutar revaluación al cierre | ✓ | ✓ | — |

## 3. Tasa diaria oficial

### 3.1 ¿De dónde viene?

Una función agendada (cron) consulta el sitio del Banco Central de la
República Dominicana cada mañana y guarda la tasa USD/DOP en la tabla
`exchange_rates` con la fecha del día.

### 3.2 ¿Dónde se usa?

- Diálogos de Casa Matriz (sugerencia automática de tasa).
- Captura de facturas en moneda extranjera.
- Movimientos bancarios multi-moneda.
- Indicador "FX no realizada" en Casa Matriz.

### 3.3 Cuando no hay tasa

Si el cron falla o el día es feriado:

- Los formularios muestran el campo de tasa vacío y obligan al usuario a
  ingresarla manualmente.
- El indicador "FX no realizada" aparece como `—`.
- Acción: Admin → Configuración → ejecutar scrape manual, o ingresar la tasa
  a mano en la tabla de tasas.

## 4. Revaluación FX al cierre

### 4.1 Cuándo correrla

Al cierre de cada mes contable, **antes** de cerrar el período. Idealmente el
último día calendario del mes con la tasa BCRD de ese día.

### 4.2 Cómo correrla

1. Contabilidad → barra de herramientas → **Reevaluar FX al Cierre**.
2. Captura **Fecha de Corte (As-of Date)**.
3. Selecciona **Período Contable** (solo aparecen períodos `open`).
4. **Ejecutar Revaluación**. El sistema corre dos RPCs:
   - `revalue_open_ap_ar` — documentos abiertos de CxP y CxC en moneda
     extranjera.
   - `revalue_open_home_office` — saldos abiertos por aporte de Casa Matriz.
5. Toast confirma cantidad de documentos / tramos revaluados.

### 4.3 Qué hace el cálculo

Para cada documento o tramo abierto en moneda extranjera:

- Valor original = monto FC × tasa histórica (al alta).
- Valor a fecha = monto FC × tasa de la fecha de corte.
- Diferencia = Valor a fecha − Valor original.

Postea un asiento por documento:

- Si la diferencia favorece a la entidad: Dr documento / Cr 8510 (ganancia).
- Si la perjudica: Dr 8510 (pérdida) / Cr documento.

Cada revaluación queda en `fx_revaluations` con `is_active = true` hasta que:

- El documento se cancele (pago o anulación) y un trigger desactive la
  revaluación abierta, **o**
- Se ejecute una nueva revaluación que sustituya a la anterior.

### 4.4 Casa Matriz vs AP/AR

El botón **Reevaluar FX** ejecuta ambos RPCs juntos para un mismo período.
El asiento de Casa Matriz toca `2160` y queda vinculado al aporte específico
para drilldown.

## 5. Reglas de negocio y validaciones

- Solo períodos en estado `open` aceptan revaluaciones.
- La revaluación es **no destructiva**: no modifica los aportes ni
  documentos, solo crea filas en `fx_revaluations` y un asiento por
  diferencia.
- La cuenta **8510** centraliza tanto las ganancias como las pérdidas FX
  (signo según el caso).
- Una revaluación con monto cero no genera asiento.
- Al pagar / cancelar un aporte o documento abierto, su revaluación FX
  abierta se desactiva por trigger; la diferencia se "realiza" entonces y se
  postea desde el flujo de pago / repago, no aquí.

## 6. Impacto contable

| Caso | Asiento |
|---|---|
| CxC abierta, peso se devalúa (más DOP) | Dr CxC / Cr 8510 |
| CxC abierta, peso se aprecia | Dr 8510 / Cr CxC |
| CxP abierta, peso se devalúa | Dr 8510 / Cr CxP |
| Casa Matriz, peso se devalúa | Dr 8510 / Cr 2160 |

## 7. Errores comunes

- **"Seleccione una entidad específica"** — el botón requiere entidad fija;
  no funciona en vista consolidada.
- **No aparece nada por revaluar** — todos los documentos están en DOP o ya
  fueron revaluados a esa fecha.
- **Doble revaluación** — si corres dos veces para la misma fecha, la
  segunda calcula contra el último valor revaluado y posiblemente postea
  cero. No es un error, pero ensucia el journal.
- **La tasa BCRD no apareció hoy** — captura manualmente o reintenta el
  scrape antes de revaluar.

## 8. Capítulos relacionados

- Capítulo 6b — Casa Matriz
- Capítulo 7 — CxC / CxP
- Capítulo 6a — Períodos contables y cierre
