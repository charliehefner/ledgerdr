# Capítulo 6d — FX (Tasas de cambio y revaluación)

## 1. Propósito

Este capítulo cubre dos funciones FX distintas que con frecuencia se confunden, pero que cumplen roles muy diferentes.

1. **Tasa diaria oficial (BCRD)** — el sistema captura automáticamente la tasa USD/DOP que el Banco Central de la República Dominicana publica cada mañana. Esa tasa se usa como sugerencia por defecto en cualquier transacción multi-moneda.
2. **Revaluación FX al cierre** — al final del mes, el sistema recalcula el valor en DOP de los documentos abiertos en moneda extranjera (CxP, CxC y Casa Matriz) usando la tasa de la fecha de corte, y postea la diferencia a la cuenta 8510.

La primera mantiene las transacciones del día a día consistentemente valuadas; la segunda mantiene el balance honesto al cierre.

## 2. Roles y permisos

El acceso se rige por rol. "lectura" es solo consulta y "—" significa que la acción no está disponible.

| Acción | Admin | Accountant | Otros |
|---|---|---|---|
| Ver tasas | ✓ | ✓ | lectura |
| Forzar scrape de tasa | ✓ | ✓ | — |
| Ejecutar revaluación al cierre | ✓ | ✓ | — |

## 3. Tasa diaria oficial

### 3.1 ¿De dónde viene?

Una función agendada (cron) consulta el sitio del Banco Central de la República Dominicana cada mañana y guarda la tasa USD/DOP del día en la tabla `exchange_rates`.

### 3.2 ¿Dónde se usa?

La tasa capturada alimenta varios puntos de la aplicación como sugerencia por defecto — nunca como un valor obligatorio:

- Diálogos de Casa Matriz (sugerencia automática de tasa al registrar aportes y repagos).
- Captura de facturas en moneda extranjera.
- Movimientos bancarios multi-moneda.
- Indicador "FX no realizada" en la vista de Casa Matriz.

### 3.3 Cuando no hay tasa

Si el cron falla, o el día es feriado y BCRD no publica tasa, el sistema maneja el vacío de forma visible:

- Los formularios muestran el campo de tasa vacío y obligan al usuario a ingresarla manualmente.
- El indicador "FX no realizada" aparece como `—`.
- Para resolverlo: Admin → Configuración → ejecutar scrape manual, o ingresar la tasa a mano para esa fecha.

## 4. Revaluación FX al cierre

### 4.1 Cuándo correrla

La revaluación debe ejecutarse al cierre de cada mes contable, **antes** de cerrar el período. Lo ideal es el último día calendario del mes, usando la tasa BCRD de ese mismo día.

### 4.2 Cómo correrla

1. Contabilidad → barra de herramientas → **Reevaluar FX al Cierre**.
2. Capture la **Fecha de Corte (As-of Date)**.
3. Seleccione el **Período Contable** (en el selector solo aparecen períodos en estado `open`).
4. Haga clic en **Ejecutar Revaluación**. El sistema corre dos RPCs en secuencia:
   - `revalue_open_ap_ar` — re-valúa los documentos abiertos de CxP y CxC en moneda extranjera.
   - `revalue_open_home_office` — re-valúa los tramos abiertos de aportes de Casa Matriz.
5. Un toast de confirmación reporta la cantidad de documentos y tramos revaluados.

> [SCREENSHOT: Diálogo de revaluación al cierre con fecha de corte y selector de período]

### 4.3 Qué hace el cálculo

Para cada documento o tramo abierto en moneda extranjera, el sistema calcula:

- Valor original = monto FC × tasa histórica (al alta).
- Valor a fecha = monto FC × tasa de la fecha de corte.
- Diferencia = Valor a fecha − Valor original.

Luego postea un asiento por documento:

- Si la diferencia favorece a la entidad, el asiento es Dr documento / Cr 8510 (ganancia).
- Si la perjudica, es Dr 8510 (pérdida) / Cr documento.

Cada revaluación queda almacenada en `fx_revaluations` con `is_active = true` hasta que ocurra una de dos cosas:

- El documento se cancela (pago o anulación) y un trigger desactiva la revaluación abierta, o
- Una nueva revaluación sustituye a la anterior.

### 4.4 Casa Matriz vs AP/AR

El botón **Reevaluar FX** ejecuta ambos RPCs juntos para el mismo período, así que un solo clic cubre CxP, CxC y Casa Matriz. El asiento de Casa Matriz toca la cuenta `2160` y queda vinculado al aporte específico para permitir drilldown.

## 5. Reglas de negocio y validaciones

Las siguientes reglas gobiernan el comportamiento de la revaluación. Conocerlas evita sorpresas al cierre.

- Solo períodos en estado `open` aceptan revaluaciones.
- La revaluación es **no destructiva**: no modifica los aportes ni los documentos; solo crea filas en `fx_revaluations` y un asiento por diferencia.
- La cuenta **8510** centraliza tanto las ganancias como las pérdidas FX, con el signo correspondiente.
- Una revaluación con diferencia cero no genera asiento — el cálculo corre, pero no se postea nada.
- Al pagar o anular un aporte o documento abierto, su revaluación FX abierta se desactiva por trigger; la diferencia se "realiza" entonces y se postea desde el flujo de pago o repago, no desde aquí.

## 6. Impacto contable

| Caso | Asiento |
|---|---|
| CxC abierta, peso se devalúa (más DOP) | Dr CxC / Cr 8510 |
| CxC abierta, peso se aprecia | Dr 8510 / Cr CxC |
| CxP abierta, peso se devalúa | Dr 8510 / Cr CxP |
| Casa Matriz, peso se devalúa | Dr 8510 / Cr 2160 |

El modelo mental: un peso que se devalúa requiere más DOP para liquidar la misma obligación en moneda extranjera, así que los pasivos en moneda extranjera (CxP, 2160) crecen del lado del crédito; las cuentas por cobrar en moneda extranjera (CxC) también crecen, pero del lado del débito.

## 7. Errores comunes

- **"Seleccione una entidad específica"** — el botón de revaluación requiere una entidad fija. No funciona desde la vista consolidada.
- **No aparece nada por revaluar** — todos los documentos abiertos están en DOP, o todos los documentos en moneda extranjera ya fueron revaluados a esa fecha.
- **Doble revaluación** — correr la revaluación dos veces para la misma fecha calcula contra el último valor revaluado y, por lo general, postea cero. No es un error, pero ensucia el journal.
- **La tasa BCRD no apareció hoy** — capture la tasa manualmente o reintente el scrape antes de revaluar.

## 8. Capítulos relacionados

- Capítulo 6b — Casa Matriz
- Capítulo 7 — CxC / CxP
- Capítulo 6a — Períodos contables y cierre

## Glosario

- **BCRD** — Banco Central de la República Dominicana, fuente de la tasa de cambio oficial diaria USD/DOP.
- **Tasa diaria oficial** — Tasa USD/DOP capturada cada mañana desde BCRD; se usa como sugerencia en transacciones multi-moneda.
- **`exchange_rates`** — Tabla de la base de datos donde se almacena la tasa diaria.
- **Revaluación FX al cierre** — Recalculo a fin de mes del valor en DOP de los documentos abiertos en moneda extranjera, con la diferencia posteada a 8510.
- **Fecha de corte (As-of Date)** — Fecha cuya tasa se usa para revaluar los saldos abiertos en moneda extranjera.
- **Cuenta 2160** — Cuenta por pagar a Casa Matriz; afectada por las revaluaciones FX de Casa Matriz.
- **Cuenta 8510** — Cuenta de ganancia/pérdida FX; centraliza ganancias y pérdidas con el signo correspondiente.
- **`fx_revaluations`** — Tabla que almacena cada resultado de revaluación, con `is_active = true` mientras el documento subyacente sigue abierto.
- **Documento / tramo abierto** — Documento de CxP o CxC, o tramo de aporte de Casa Matriz, que aún no se ha liquidado completamente.
- **FX realizada** — Diferencia FX reconocida cuando un documento se liquida efectivamente (pago, anulación o repago); se postea desde el flujo de pago, no desde la revaluación.
- **FX no realizada** — Diferencia FX reconocida mientras el documento sigue abierto; se postea por revaluación y se reversa cuando el documento se liquida.
- **`revalue_open_ap_ar`** — RPC que revalúa los documentos abiertos de CxP y CxC en moneda extranjera.
- **`revalue_open_home_office`** — RPC que revalúa los tramos abiertos de aportes de Casa Matriz.
