# Capítulo 6b — Casa Matriz (Home Office)

## 1. Propósito

Casa Matriz registra los aportes que la oficina principal en el extranjero
(p. ej. **JORD AB** en USD) entrega a la entidad operativa local. Cada aporte
puede ser efectivo, equipo, gasto pagado por la matriz, o cargado a un
proyecto en curso (CIP). El módulo lleva el principal en moneda extranjera y
en DOP, devenga interés mensualmente, calcula la diferencia FX al pago y
permite revaluar el saldo abierto al cierre de período.

## 2. Roles y permisos

| Acción | Admin | Management | Accountant | Otros |
|---|---|---|---|---|
| Ver Casa Matriz | ✓ | ✓ | ✓ | lectura |
| Registrar aporte / repago | ✓ | ✓ | ✓ | — |
| Devengar interés manualmente | ✓ | ✓ | ✓ | — |
| Capitalizar interés al principal | ✓ | ✓ | ✓ | — |
| Revaluar al cierre | ✓ | — | ✓ | — |

## 3. Recorrido de pantalla

Contabilidad → pestaña **Casa Matriz**:

- Cabecera con **4 indicadores**: Principal en moneda extranjera, Principal en
  DOP histórico, Interés acumulado, Diferencia FX no realizada (a tasa de hoy).
- Botón **Nueva entrada** y menú con **Registrar repago** y **Devengar mes**.
- Botón **Exportar estado** (Excel / PDF) con todos los movimientos y totales.
- Tablas: **Aportes**, **Repagos** y **Devengos mensuales**.

> [SCREENSHOT: Vista Casa Matriz con los 4 indicadores arriba]

## 4. Flujos paso a paso

### 4.1 Registrar un aporte (advance)

1. **Nueva entrada**.
2. Captura **fecha**, **tipo**, **moneda**, **monto** y **tasa**.
3. **Tipo** determina la cuenta destino:
   - *Transferencia de efectivo* → cuenta bancaria receptora.
   - *Equipo (capitalizar a activo fijo)* → cuenta de activo (1xxx).
   - *Equipo (proyecto en curso – CIP)* → proyecto CIP existente.
   - *Equipo / inventario* → cuenta de inventario (14xx).
   - *Gasto pagado por la matriz* → cuenta de gasto.
   - *Otro* → cualquier cuenta postable.
4. **Tasa de interés** (anual) y **base** (actual/365, actual/360, 30/360, sin
   interés). Por defecto las transferencias de equipo entran a **0%** y las de
   efectivo **heredan** la tasa de la matriz (4% para JORD AB). Se puede
   sobrescribir por aporte.
5. Referencia y descripción libres.
6. **Registrar**. Postea **Dr [destino] / Cr 2160** (Cuenta por pagar a Casa
   Matriz). El aporte se vincula al asiento vía `journal_source_links` para
   permitir drilldown.

### 4.2 Registrar un repago

1. Menú → **Registrar repago**.
2. Captura fecha, moneda, monto, tasa y banco de salida.
3. **Postear repago** → **Dr 2160 / Cr Banco**. La diferencia entre la tasa de
   los aportes consumidos (FIFO) y la tasa de hoy se postea a **8510** como
   diferencia FX realizada.

### 4.3 Devengo de interés mensual

El cron `home-office-interest-monthly` se ejecuta los días 28–31 a las 23:55 y
revisa si es el último día del mes. Si lo es, llama a
`post_home_office_interest_accrual` para cada combinación party + entidad,
generando un único devengo por mes:

- Calcula días del mes según `interest_basis`.
- Aplica `interest_rate_pct` por aporte (no una sola tasa global).
- Postea **Dr 7510 (Gasto interés) / Cr 2160 (acumulado)**.

Para correrlo manualmente: menú → **Devengar mes**.

### 4.4 Capitalizar interés al principal

En la tabla de devengos, fila con estado `accrued` → **Capitalizar**. El
interés deja de ser un acumulado separado y se suma al principal del aporte
asociado, generando un nuevo "tramo" con la tasa y base vigentes. Útil cuando
el contrato lo permite (interés compuesto).

### 4.5 Revaluación FX al cierre

Ver Capítulo 6d — FX. Botón **Reevaluar FX** en la barra de Contabilidad
incluye automáticamente Casa Matriz junto con AP/AR.

### 4.6 Exportar estado

Botón **Exportar estado** en la cabecera produce Excel o PDF con todos los
aportes, repagos y devengos del party seleccionado, más la fila de totales y
los 4 indicadores.

## 5. Reglas de negocio y validaciones

- Cada aporte guarda **interés por aporte** (`interest_rate_pct`,
  `interest_basis`); el cron usa el valor por aporte, no uno global.
- Repagos consumen aportes en orden **FIFO** y disminuyen
  `balance_remaining_fc`. Cuando un aporte queda en cero, su revaluación FX
  abierta se desactiva por trigger `trg_ho_deactivate_fx_revals`.
- Anular un aporte (`status = voided`) también desactiva sus revaluaciones FX
  abiertas.
- El balance se calcula desde la vista `home_office_balance`, no almacenada.
- **2160** es el pasivo a Casa Matriz; cualquier asiento que lo toque fuera
  de este módulo aparecerá descuadrado con el principal calculado.

## 6. Impacto contable

| Operación | Asiento |
|---|---|
| Aporte | Dr [destino: banco / activo / CIP / gasto] / Cr 2160 |
| Devengo de interés | Dr 7510 / Cr 2160 |
| Capitalización | Dr 2160 (interés) / Cr 2160 (principal) — reasigna |
| Repago | Dr 2160 / Cr Banco (+/- 8510 si FX) |
| Revaluación FX | Dr/Cr 2160 / Cr/Dr 8510 |

## 7. Errores comunes y solución

- **"Falta la cuenta destino"** — selecciona banco / proyecto CIP / cuenta
  según el tipo de aporte.
- **"Tasa de cambio inválida"** — captura un valor > 0; la tasa oficial del
  día se sugiere automáticamente para USD.
- **El indicador "FX no realizada" no aparece** — no hay tasa BCRD para hoy
  (ver Capítulo 6d).
- **Doble devengo en un mes** — ya existe un registro en
  `home_office_interest_accruals` para ese mes; el RPC lo ignora si está
  posteado, lo regenera si está descartado.

## 8. Capítulos relacionados

- Capítulo 6c — CIP (proyectos en curso)
- Capítulo 6d — FX (revaluación al cierre)
- Capítulo 11 — Intercompañía (Due To / Due From entre entidades hermanas)
