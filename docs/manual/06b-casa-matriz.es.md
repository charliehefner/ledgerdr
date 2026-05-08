# Capítulo 6b — Casa Matriz (Home Office)

## 1. Propósito

El módulo Casa Matriz registra los aportes que la oficina principal en el extranjero —por ejemplo **JORD AB** en USD— entrega a la entidad operativa local. Estos aportes pueden tomar varias formas: efectivo, equipo, gasto pagado por la matriz, o valor cargado a un proyecto en curso (CIP). Cualquiera sea la forma, el módulo lleva el principal tanto en moneda extranjera como en DOP, devenga interés mensualmente, calcula la diferencia FX en el momento del repago y permite revaluar cualquier saldo abierto al cierre del período.

En la práctica, Casa Matriz es la cuenta corriente entre la matriz y la entidad local — una cuenta intercompañía de largo plazo que requiere un tratamiento cuidadoso porque cruza monedas y devenga interés.

## 2. Roles y permisos

El acceso se rige por rol. "lectura" significa solo consulta y "—" significa que la acción no está disponible.

| Acción | Admin | Management | Accountant | Otros |
|---|---|---|---|---|
| Ver Casa Matriz | ✓ | ✓ | ✓ | lectura |
| Registrar aporte / repago | ✓ | ✓ | ✓ | — |
| Devengar interés manualmente | ✓ | ✓ | ✓ | — |
| Capitalizar interés al principal | ✓ | ✓ | ✓ | — |
| Revaluar al cierre | ✓ | — | ✓ | — |

La revaluación al cierre se restringe a Admin y Accountant porque es una acción de cierre que interactúa con tasas FX y se refleja en los estados financieros.

## 3. Recorrido de pantalla

El módulo está en Contabilidad → pestaña **Casa Matriz**.

- Una franja de cabecera con cuatro indicadores clave: Principal en moneda extranjera, Principal en DOP histórico, Interés acumulado y Diferencia FX no realizada (a tasa de hoy).
- Un botón **Nueva entrada**, más un menú con **Registrar repago** y **Devengar mes**.
- Un botón **Exportar estado** que produce un reporte en Excel o PDF con todos los movimientos y totales.
- Tres tablas debajo de la cabecera: **Aportes**, **Repagos** y **Devengos mensuales**.

> [SCREENSHOT: Vista Casa Matriz con los 4 indicadores arriba]

## 4. Flujos paso a paso

Esta sección recorre las operaciones del día a día: registrar aportes y repagos, ejecutar el devengo mensual, capitalizar intereses y producir un estado.

### 4.1 Registrar un aporte (advance)

1. Haga clic en **Nueva entrada**.
2. Capture **fecha**, **tipo**, **moneda**, **monto** y **tasa**.
3. El **tipo** determina la cuenta destino del débito:
   - *Transferencia de efectivo* → la cuenta bancaria receptora.
   - *Equipo (capitalizar a activo fijo)* → la cuenta de activo (1xxx).
   - *Equipo (proyecto en curso – CIP)* → un proyecto CIP existente.
   - *Equipo / inventario* → la cuenta de inventario (14xx).
   - *Gasto pagado por la matriz* → la cuenta de gasto correspondiente.
   - *Otro* → cualquier cuenta postable.
4. Defina la **tasa de interés** (anual) y la **base** (actual/365, actual/360, 30/360, o sin interés). Por defecto, los tipos de equipo entran a **0 %** y los de efectivo **heredan** la tasa de la matriz (4 % para JORD AB). Ambos valores se pueden sobrescribir por aporte.
5. Agregue una referencia y descripción libres.
6. Haga clic en **Registrar**. El sistema postea **Dr [destino] / Cr 2160** (Cuenta por pagar a Casa Matriz). El aporte se vincula al asiento vía `journal_source_links` para permitir drilldown.

> [SCREENSHOT: Formulario de nuevo aporte con selector de tipo]

### 4.2 Registrar un repago

1. Desde el menú, elija **Registrar repago**.
2. Capture fecha, moneda, monto, tasa y banco de salida.
3. Haga clic en **Postear repago**. El sistema postea **Dr 2160 / Cr Banco**. La diferencia entre la tasa de los aportes consumidos (FIFO) y la tasa de hoy se postea a **8510** como diferencia FX realizada.

### 4.3 Devengo de interés mensual

El cron `home-office-interest-monthly` se ejecuta los días 28–31 a las 23:55 y verifica si es el último día del mes. Cuando lo es, llama a `post_home_office_interest_accrual` para cada combinación party + entidad, generando un único devengo por mes:

- Los días se calculan según el `interest_basis` de cada aporte.
- Se aplica el `interest_rate_pct` por aporte — no existe una tasa global única.
- El sistema postea **Dr 7510 (Gasto interés) / Cr 2160 (acumulado)**.

Para ejecutarlo manualmente fuera del cron, elija **Devengar mes** desde el menú.

### 4.4 Capitalizar interés al principal

En la tabla de devengos, sobre cualquier fila con estado `accrued`, haga clic en **Capitalizar**. El interés deja de ser un acumulado separado y se incorpora al principal del aporte asociado como un nuevo "tramo", con la tasa y base vigentes. Use esta opción cuando el contrato entre matriz y entidad permita interés compuesto.

### 4.5 Revaluación FX al cierre

La revaluación FX al cierre para Casa Matriz se ejecuta desde el flujo central descrito en el Capítulo 6d — FX. El botón **Reevaluar FX** en la barra de Contabilidad incluye automáticamente los saldos de Casa Matriz junto con los de AP y AR.

### 4.6 Exportar estado

El botón **Exportar estado** de la cabecera produce un documento Excel o PDF con todos los aportes, repagos y devengos del party seleccionado, más una fila de totales y los cuatro indicadores de cabecera.

> [SCREENSHOT: Primera página del estado exportado]

## 5. Reglas de negocio y validaciones

Estas reglas gobiernan el comportamiento del módulo bajo el capó. Conocerlas ayuda a interpretar correctamente los números.

- Cada aporte guarda **su propia configuración de interés** (`interest_rate_pct`, `interest_basis`); el cron usa los valores por aporte, no una tasa global.
- Los repagos consumen aportes en orden **FIFO** y disminuyen `balance_remaining_fc`. Cuando un aporte queda en cero, el trigger `trg_ho_deactivate_fx_revals` desactiva las revaluaciones FX abiertas de ese aporte.
- Anular un aporte (`status = voided`) también desactiva sus revaluaciones FX abiertas.
- El balance se calcula desde la vista `home_office_balance` al momento de leer; no es un valor almacenado.
- **2160** está reservada para el pasivo a Casa Matriz. Cualquier asiento que la toque desde fuera de este módulo aparecerá como descuadre frente al principal calculado.

## 6. Impacto contable

| Operación | Asiento |
|---|---|
| Aporte | Dr [destino: banco / activo / CIP / gasto] / Cr 2160 |
| Devengo de interés | Dr 7510 / Cr 2160 |
| Capitalización | Dr 2160 (interés) / Cr 2160 (principal) — reasigna |
| Repago | Dr 2160 / Cr Banco (+/- 8510 si FX) |
| Revaluación FX | Dr/Cr 2160 / Cr/Dr 8510 |

El patrón a recordar: toda la actividad pasa por **2160** en un lado y por banco / activo / CIP / gasto (en aportes) o por **8510** (en ajustes FX y FX realizada al repago) en el otro.

## 7. Errores comunes y solución

- **"Falta la cuenta destino"** — seleccione banco, proyecto CIP o cuenta según el tipo de aporte.
- **"Tasa de cambio inválida"** — capture un valor mayor a cero; para USD, la tasa oficial del día se sugiere automáticamente.
- **El indicador "FX no realizada" no aparece** — no hay tasa BCRD para hoy (ver Capítulo 6d).
- **Doble devengo en un mes** — ya existe un registro en `home_office_interest_accruals` para ese mes; el RPC lo ignora si está posteado y lo regenera solo si el anterior se descarta.

## 8. Capítulos relacionados

- Capítulo 6c — CIP (proyectos en curso)
- Capítulo 6d — FX (revaluación al cierre)
- Capítulo 11 — Intercompañía (Due To / Due From entre entidades hermanas)

## Glosario

- **Casa Matriz (Home Office)** — Empresa matriz en el extranjero que aporta fondos, equipo o gastos pagados a nombre de la entidad local.
- **JORD AB** — Empresa matriz en esta configuración; su moneda funcional es USD.
- **Aporte (advance)** — Contribución de la matriz a la entidad local, valuada en moneda extranjera y DOP, con su propia tasa y base de interés.
- **Repago** — Pago de la entidad local hacia la matriz; consume aportes en orden FIFO y dispara la diferencia FX realizada.
- **Cuenta 2160** — Cuenta por pagar a Casa Matriz; saldo corriente de lo que la entidad local debe a la matriz.
- **Cuenta 7510** — Gasto por interés generado por los devengos mensuales.
- **Cuenta 8510** — Diferencia FX realizada (ganancia o pérdida) por repagos y ajustes de revaluación.
- **Base de interés** — Convención de conteo de días para calcular el interés (actual/365, actual/360, 30/360 o sin interés).
- **Capitalización** — Incorporar el interés acumulado al principal de un aporte como un nuevo tramo, de modo que el propio interés empiece a generar interés.
- **CIP (proyecto en curso)** — Activo en construcción de largo plazo que puede ser destino de un aporte tipo equipo (ver Capítulo 6c).
- **Consumo FIFO** — Al registrar un repago, los aportes se consumen del más antiguo al más reciente.
- **`home_office_balance`** — Vista de base de datos que calcula el saldo abierto al momento de leer.
- **BCRD** — Banco Central de la República Dominicana, fuente de la tasa de cambio oficial diaria.
- **RPC** — Función de back-end invocada por la aplicación (por ejemplo `post_home_office_interest_accrual`).
