# LedgerDR — Guía Técnica del Sistema Contable

**Preparado para:** Revisión de Auditoría Externa  
**Versión:** 1.0 — Marzo 2026  
**Sistema:** LedgerDR (Aplicación Web)

---

## 1. Visión General del Sistema

LedgerDR implementa un sistema de **contabilidad de partida doble** con el siguiente flujo operativo:

```
Documento Fuente (Transacción) → Asiento de Diario → Mayor General → Estados Financieros
```

- Todas las transacciones financieras se registran primero como documentos fuente en la tabla `transactions`.
- Un proceso de generación automática (función servidor) convierte cada transacción en un asiento de diario balanceado.
- Los estados financieros se derivan exclusivamente de los asientos contabilizados (`posted = true`).
- Los asientos contabilizados son **inmutables** a nivel de base de datos; las correcciones se realizan mediante asientos de reversión.

---

## 2. Catálogo de Cuentas (Chart of Accounts)

El sistema mantiene un catálogo corporativo de aproximadamente **419 cuentas** con las siguientes características:

| Rango de Código | Tipo de Cuenta | Descripción |
|---|---|---|
| 10xx | Activo Circulante | Efectivo, bancos, cuentas por cobrar, inventarios |
| 11xx | Activo Circulante | Inversiones a corto plazo, anticipos |
| 12xx | Cuentas por Cobrar | Clientes, documentos por cobrar |
| 13xx–14xx | Activo Fijo | Terrenos, edificios, maquinaria, vehículos |
| 15xx | Depreciación Acumulada | Contra-cuentas de activos fijos |
| 16xx | Otros Activos | ITBIS pagado (1650), diferidos |
| 20xx–21xx | Pasivo Circulante | Proveedores (2100), ITBIS por pagar (2110) |
| 2160 | Pasivo | ITBIS Retenido por pagar |
| 2170 | Pasivo | ISR Retenido por pagar |
| 2180 | Pasivo | Retenciones de nómina (SFS, AFP) |
| 22xx–24xx | Pasivo a Largo Plazo | Préstamos, obligaciones |
| 25xx–29xx | Capital | Capital social, reservas, resultados acumulados |
| 30xx–39xx | Ingresos | Ventas, ingresos por servicios, otros ingresos |
| 40xx–49xx | Costo de Ventas | COGS, materiales, mano de obra directa |
| 50xx–59xx | Gastos Operativos | Sueldos, alquiler, servicios, seguros |
| 60xx–69xx | Gastos Administrativos | Nómina administrativa, depreciación, amortización |
| 6210 | Gasto | Contribuciones patronales TSS |
| 70xx–79xx | Gastos Financieros | Intereses, comisiones bancarias |
| 80xx–84xx | Otros Gastos | Extraordinarios, pérdidas |
| 8510 | Financiero | Diferencia cambiaria (Ganancia/Pérdida) |

**Estructura jerárquica:** Las cuentas soportan relaciones padre-hijo (`parent_id`) para agrupación en reportes. Solo las cuentas marcadas como `allow_posting = true` aceptan movimientos directos.

**Descripciones bilingües:** Cada cuenta tiene `english_description` y `spanish_description`, alternando según el idioma activo del usuario.

---

## 3. Registro de Transacciones

### 3.1 Tipos de Transacción

| Dirección | Clave Interna | Uso |
|---|---|---|
| **Compra** | `purchase` | Gastos, compras a proveedores |
| **Venta** | `sale` | Ingresos, facturación a clientes |
| **Transferencia** | `payment` | Movimiento entre cuentas bancarias/caja |

### 3.2 Campos Principales

- **Fecha** (`transaction_date`): Fecha del documento fuente.
- **Fecha de Vencimiento** (`due_date`): Fecha de pago esperada; activa la generación automática de documento CxP/CxC.
- **Cuenta Contable** (`master_acct_code`): Código de la cuenta del catálogo.
- **Método de Pago** (`pay_method`): UUID de cuenta bancaria o código legacy.
- **Monto** (`amount`): Monto total incluyendo ITBIS.
- **ITBIS** (`itbis`): Impuesto sobre transferencias (18% estándar).
- **Centro de Costo** (`cost_center`): `general`, `agricultural`, o `industrial`.
- **Moneda** (`currency`): DOP, USD, o EUR.
- **Tasa de Cambio** (`exchange_rate`): Tasa aplicada al momento del registro.

### 3.3 Retenciones (Documentos B11)

- **ITBIS Retenido** (`itbis_retenido`): Retención de ITBIS aplicada al proveedor.
- **ISR Retenido** (`isr_retenido`): Retención de impuesto sobre la renta.
- Ambas retenciones reducen el monto acreditado a la cuenta bancaria en el asiento generado.

### 3.4 Validaciones

- **Tope de ITBIS al 18%** del monto neto, con posibilidad de sobrescritura documentada (`itbis_override_reason`) para pagos acumulados.
- **Detección de duplicados** por fecha, monto y descripción similar.
- **Tasa de cambio automática** desde datos del Banco Central (BCRD) para monedas extranjeras.

---

## 4. Sistema de Asientos de Diario

### 4.1 Tipos de Diario

| Código | Nombre | Origen |
|---|---|---|
| **GJ** | General Journal | Entrada manual |
| **PJ** | Purchase Journal | Auto-generado desde compras |
| **SJ** | Sales Journal | Auto-generado desde ventas |
| **PRJ** | Payroll Journal | Generado al cerrar período de nómina |
| **CDJ** | Cash Disbursement Journal | Pagos de CxP y transferencias |
| **CRJ** | Cash Receipt Journal | Cobros de CxC |
| **DEP** | Depreciation Journal | Generado por depreciación mensual |
| **RJ** | Reversal Journal | Reversión automática de asientos |
| **CLJ** | Closing Journal | Asientos de cierre de período |
| **ADJ** | Adjustment Journal | Revaluación cambiaria |

### 4.2 Generación Automática desde Transacciones

Una función servidor procesa todas las transacciones sin asiento vinculado y genera diarios balanceados:

**Compra (PJ):**
```
Débito:  Cuenta de gasto (master_acct_code)     → Monto neto (amount - itbis)
Débito:  1650 ITBIS Pagado                       → Monto ITBIS
Crédito: 2160 ITBIS Retenido                     → itbis_retenido (si aplica)
Crédito: 2170 ISR Retenido                       → isr_retenido (si aplica)
Crédito: Cuenta bancaria (pay_method)            → amount - retenciones
```

**Venta (SJ):**
```
Débito:  Cuenta bancaria (pay_method)            → amount
Crédito: Cuenta de ingreso (master_acct_code)    → Monto neto
Crédito: 2110 ITBIS por Pagar                    → Monto ITBIS
```

**Transferencia (CDJ):**
```
Débito:  Cuenta destino (destination_acct_code)  → amount
Crédito: Cuenta origen (pay_method)              → amount
```

> **Nota sobre multi-moneda en transferencias:** Ambas líneas usan el monto en DOP (sourceAmount) para mantener el asiento balanceado. La moneda y tasa de cambio se registran en el encabezado del diario.

### 4.3 Flujo de Aprobación

1. Los asientos se crean en estado **borrador** (`posted = false`).
2. Un usuario autorizado revisa y aprueba mediante la función `post_journal`.
3. `post_journal` valida que débitos = créditos a nivel servidor antes de contabilizar.
4. Una vez contabilizado, el asiento es **inmutable** — un trigger de base de datos impide modificaciones.

### 4.4 Correcciones y Anulaciones

- **Corrección:** Se crea un asiento de reversión (RJ) que anula el asiento original, seguido de un nuevo asiento correcto.
- **Anulación de transacción:** Cuando una transacción se marca como `is_void = true`, un trigger de base de datos genera y contabiliza automáticamente un asiento de reversión y anula cualquier documento CxP/CxC vinculado.

---

## 5. Sub-Mayor de Cuentas por Pagar / Cobrar (AP/AR)

### 5.1 Creación Automática de Documentos

Un documento AP/AR se genera automáticamente cuando una transacción tiene:
- Una **fecha de vencimiento** (`due_date`), o
- Un método de pago tipo **Crédito** (se asigna vencimiento a 30 días por defecto).

| Tipo de Documento | Dirección | Cuenta GL |
|---|---|---|
| Factura Proveedor | Payable | 21xx (Cuentas por Pagar) |
| Invoice | Receivable | 12xx (Cuentas por Cobrar) |
| Nota de Crédito | Payable/Receivable | Contrapartida |
| Nota de Débito | Payable/Receivable | Ajuste |

### 5.2 Registro de Pagos

Al registrar un pago contra un documento AP/AR:
1. Se crea un registro en `ap_ar_payments` con monto, fecha y cuenta bancaria.
2. Se genera un **nuevo asiento de diario** (CDJ para pagos, CRJ para cobros):
   - **Pago CxP:** Débito CxP (21xx) / Crédito Banco
   - **Cobro CxC:** Débito Banco / Crédito CxC (12xx)
3. El saldo restante del documento se actualiza.
4. Cuando el saldo llega a cero, el estado cambia a `paid`.

> **Importante:** Los pagos generan asientos **nuevos y separados** — no se reversa el asiento original. El asiento original registra la obligación; el pago registra la liquidación.

### 5.3 Reporte de Antigüedad (Aging)

El sistema genera reportes de antigüedad segmentados por períodos (Corriente, 1-30, 31-60, 61-90, 90+ días) con totales separados por moneda (DOP/USD/EUR).

---

## 6. Estados Financieros

Todos los estados financieros se generan a partir de la función de base de datos `account_balances_from_journals`, que agrega saldos exclusivamente desde **asientos contabilizados** (`posted = true`, `deleted_at IS NULL`).

| Estado Financiero | Método | Cuentas |
|---|---|---|
| **Balanza de Comprobación** | Saldos deudor/acreedor por cuenta | Todas |
| **Estado de Resultados (P&L)** | Ingresos − Costos − Gastos | 30xx–84xx |
| **Balance General** | Activo = Pasivo + Capital | 10xx–29xx |
| **Flujo de Efectivo** | Método indirecto | Derivado de P&L + Balance |

### Alerta de Transacciones No Vinculadas

Una función servidor (`count_unlinked_transactions`) verifica si existen transacciones no anuladas sin asiento de diario correspondiente dentro del período seleccionado. Si las encuentra, se muestra un banner de advertencia en cada estado financiero para garantizar la integridad del mayor.

---

## 7. Gestión de Períodos Contables

### Ciclo de Vida de un Período

```
Abierto (open) → Cerrado (closed) → Reportado (reported) → Bloqueado (locked)
```

- **Abierto:** Acepta nuevos asientos y modificaciones.
- **Cerrado:** Se generan asientos de cierre (CLJ). No se permiten nuevos asientos ordinarios.
- **Reportado:** Período incluido en informes fiscales. Solo ajustes autorizados.
- **Bloqueado:** Completamente inmutable. Un trigger de base de datos impide cualquier inserción o modificación de asientos en este período.

> Las transiciones son **unidireccionales** — no se puede reabrir un período cerrado. Esto se aplica a nivel de base de datos.

### Revaluación Cambiaria al Cierre

Al cerrar un período, el sistema puede generar asientos de ajuste (ADJ) para revaluar saldos en moneda extranjera:
- Obtiene la tasa de cierre del BCRD.
- Calcula la diferencia entre el saldo al tipo de cambio original y al tipo de cierre.
- Registra la ganancia/pérdida contra la cuenta **8510 — Diferencia Cambiaria**.
- Un registro de revaluación (`revaluation_log`) previene duplicados.

---

## 8. Tesorería

### Cuentas Bancarias

Cada cuenta bancaria está vinculada a una cuenta del catálogo contable (`chart_account_id`). El **Saldo Contable** mostrado en la interfaz se calcula en tiempo real sumando débitos y créditos de asientos contabilizados contra esa cuenta del catálogo.

### Conciliación Bancaria

- Importación de estados de cuenta en formato CSV, OFX o TXT.
- Conciliación manual o asistida línea por línea.
- Auto-categorización de comisiones bancarias.

### Caja Chica y Tarjetas de Crédito

Gestionadas como cuentas bancarias adicionales con cuentas contables propias, siguiendo el mismo modelo de saldo contable.

---

## 9. Multi-Moneda

- **Monedas soportadas:** DOP (Peso Dominicano), USD, EUR.
- **Fuente de tasas:** Banco Central de la República Dominicana (BCRD), consultado automáticamente.
- **Registro:** Cada transacción y asiento almacena `currency` y `exchange_rate`.
- **Transferencias cross-currency:** El asiento usa el monto equivalente en DOP en ambas líneas para mantener el balance; la información de moneda se preserva en el encabezado.
- **Revaluación:** Al cierre de período, los saldos en USD/EUR se ajustan a la tasa de cierre contra la cuenta 8510.

---

## 10. Cumplimiento Fiscal DGII

### Reportes Implementados

| Formato | Nombre | Contenido |
|---|---|---|
| **606** | Compras de Bienes y Servicios | Todas las compras con NCF, RNC, ITBIS |
| **607** | Ventas de Bienes y Servicios | Todas las ventas con NCF |
| **608** | Comprobantes Anulados | NCF anulados en el período |
| **IT-1** | Declaración de ITBIS | Resumen mensual de ITBIS |
| **IR-3** | Retenciones de ISR | Detalle de retenciones aplicadas |

### Clasificación Automática

Un trigger de base de datos (`trg_auto_dgii_tipo_bienes`) clasifica automáticamente el tipo de bien/servicio según el prefijo de la cuenta contable:
- Código `72xx` → Tipo `02` (Servicios)
- Código `12xx` → Tipo `10` (Activos)
- Códigos de gasto → Tipo `01` (Gastos)

### Método de Pago DGII

El código de forma de pago (01=Efectivo, 02=Cheque, 03=Transferencia) se resuelve dinámicamente desde el `account_type` de la cuenta bancaria vinculada.

---

## 11. Activos Fijos y Depreciación

- **Categorías:** Terrenos, Edificios, Maquinaria, Vehículos, Equipos, Mobiliario.
- **Método:** Línea recta (straight-line) exclusivamente.
- **Cuentas automáticas:** Cada categoría tiene reglas predefinidas (`asset_depreciation_rules`) que mapean:
  - Cuenta de activo (13xx–14xx)
  - Depreciación acumulada (15xx)
  - Gasto de depreciación (6xxx)
- **Generación:** Los asientos DEP se generan mensualmente, debitando gasto de depreciación y acreditando depreciación acumulada.
- **Vinculación:** Los activos pueden vincularse a equipos (`fuel_equipment`) o implementos (`implements`) del sistema operativo.

---

## 12. Pista de Auditoría

### Triggers de Auditoría

Ocho tablas críticas tienen triggers que registran automáticamente cada INSERT, UPDATE y DELETE en la tabla `accounting_audit_log`:

1. `journals` — Asientos de diario
2. `journal_lines` — Líneas de asiento
3. `chart_of_accounts` — Catálogo de cuentas
4. `transactions` — Transacciones fuente
5. `accounting_periods` — Períodos contables
6. `bank_accounts` — Cuentas bancarias
7. `ap_ar_documents` — Documentos CxP/CxC
8. `ap_ar_payments` — Pagos de CxP/CxC

### Formato del Registro

Cada entrada de auditoría contiene:
- `action`: INSERT, UPDATE, o DELETE
- `table_name`: Tabla afectada
- `record_id`: ID del registro modificado
- `old_values`: Estado anterior (JSON) — solo para UPDATE/DELETE
- `new_values`: Estado nuevo (JSON) — solo para INSERT/UPDATE
- `user_id`: Usuario que realizó la acción
- `created_at`: Marca de tiempo

### Inmutabilidad de Asientos Contabilizados

Un trigger de base de datos impide la modificación directa de cualquier asiento donde `posted = true`. Las correcciones solo pueden realizarse mediante:
1. Crear un asiento de reversión (RJ) que anule el original.
2. Crear un nuevo asiento correcto.

---

## 13. Controles de Integridad de Datos

| Control | Implementación | Nivel |
|---|---|---|
| Balance de asientos | Validación en `post_journal` antes de contabilizar | Servidor |
| Tope ITBIS 18% | Trigger con override documentado | Base de datos |
| Períodos bloqueados | Trigger impide INSERT/UPDATE en períodos locked | Base de datos |
| Reversión automática | Trigger al anular transacción (`is_void`) | Base de datos |
| Cascada a AP/AR | Trigger anula documentos CxP/CxC al anular transacción | Base de datos |
| Protección contra schema poisoning | `SET search_path TO public` en 16+ funciones críticas | Base de datos |
| Row-Level Security (RLS) | Políticas por tabla que restringen acceso por usuario/rol | Base de datos |
| Detección de duplicados | Verificación por fecha + monto + descripción | Aplicación |
| Alerta de transacciones sin asiento | RPC `count_unlinked_transactions` en estados financieros | Servidor |

### Roles de Usuario

El sistema implementa control de acceso basado en roles almacenados en una tabla separada (`user_roles`):
- **admin** — Acceso completo
- **management** — Acceso a reportes y aprobaciones
- **accountant** — Acceso a módulos contables
- **field_worker** — Acceso limitado a operaciones de campo
- **driver** — Portal de combustible únicamente

La generación de asientos y funciones administrativas requieren roles `admin`, `management`, o `accountant`.

---

## 14. Presupuesto vs. Real

### Estructura

- Grid de presupuesto P&L mapeado a rangos de cuentas BAS (30xx–8xxx).
- Soporte para presupuestos por proyecto con código de proyecto.
- Distribución mensual (month_1 a month_12) con total anual calculado.

### Columna de Real (Actual)

- Los montos reales se calculan desde asientos contabilizados.
- Las transacciones en USD/EUR se convierten automáticamente a DOP usando la tasa oficial del período.
- La variación (Budget − Actual) se calcula y muestra por línea.

---

## Anexo: Funciones de Base de Datos Críticas

| Función | Propósito |
|---|---|
| `post_journal` | Contabiliza un asiento validando balance D=C |
| `create_journal_from_transaction` | Crea encabezado de diario vinculado a transacción |
| `account_balances_from_journals` | Calcula saldos para estados financieros |
| `trial_balance` | Genera balanza de comprobación |
| `count_unlinked_transactions` | Cuenta transacciones sin asiento vinculado |
| `has_role` | Verifica rol de usuario (SECURITY DEFINER) |

Todas las funciones críticas usan `SECURITY DEFINER` con `SET search_path TO public` para prevenir ataques de schema poisoning.

---

*Documento generado para revisión de auditoría. Para consultas técnicas sobre la implementación, referir a `docs/DATABASE_TECHNICAL_SPEC.md` y `docs/accounting_schema_corrected.sql`.*
