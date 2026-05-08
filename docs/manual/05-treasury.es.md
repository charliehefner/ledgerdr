# Capítulo 5 — Tesorería

## 1. Propósito

El módulo de Tesorería gestiona todo el efectivo y los equivalentes de
efectivo: cuentas bancarias, tarjetas de crédito, caja chica, transferencias
internas entre cuentas, pagos de tarjetas y anticipos a suplidores. Es la
ventana donde se registra el movimiento real del dinero antes de cerrarlo
contra contabilidad.

## 2. Roles y permisos

| Rol | Conciliación | Cuentas bancarias | Tarjetas | Caja chica | Transferencias internas | Pagos TC | Anticipos |
|---|---|---|---|---|---|---|---|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Accountant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supervisor | lectura | lectura | lectura | lectura | lectura | lectura | lectura |
| Office | — | — | — | **escritura** | — | — | — |
| Viewer | lectura | lectura | lectura | lectura | lectura | lectura | lectura |

El rol **Office** entra directamente a la pestaña Caja Chica (las demás
quedan ocultas).

## 3. Recorrido de pantalla

`Tesorería` se divide en pestañas:

- **Conciliación bancaria** — importa estados de cuenta y empareja líneas con
  movimientos contables.
- **Cuentas bancarias** — alta y mantenimiento de cuentas por entidad y moneda.
- **Tarjetas de crédito** — registro de tarjetas y sus movimientos.
- **Caja chica** — vales, reposiciones, cierres semanales.
- **Transferencias internas** — entre dos cuentas propias (bancos, caja,
  tarjeta).
- **Pagos de tarjeta** — pagos del banco hacia la TC, con manejo de comisiones.
- **Anticipos a suplidores** — pagos por adelantado registrados en cuenta
  **1690**, listos para aplicar contra una factura futura.

> [SCREENSHOT: pestañas de Tesorería, ancho completo]

## 4. Flujos paso a paso

### 4.1 Crear una cuenta bancaria

1. Tesorería → **Cuentas bancarias** → **Nueva**.
2. Captura: nombre, banco, número, **moneda** (DOP/USD/EUR/SEK), tipo,
   cuenta del catálogo (`chart_account_id`) y entidad.
3. Guardar. La cuenta queda activa (`is_active = true`).

### 4.2 Registrar una transferencia interna

Una transferencia interna **no es** un gasto ni un ingreso: es un movimiento
de cuenta a cuenta. Postea contra la cuenta puente **0000 — Transferencias
Internas**.

1. Tesorería → **Transferencias Internas** → **Nueva**.
2. Selecciona cuenta origen, cuenta destino, fecha y monto.
3. Si las monedas difieren, captura tasa de cambio. La diferencia FX
   realizada se postea a **8510**.
4. Guardar. Se generan dos asientos balanceados a través de 0000.

### 4.3 Pago de tarjeta de crédito

1. Tesorería → **Pagos de Tarjeta** → **Nuevo pago**.
2. Selecciona la TC, banco emisor del pago, fecha, monto y comisiones (si las
   hay).
3. El sistema postea Dr Tarjeta / Cr Banco (+ comisiones a su cuenta).

### 4.4 Anticipo a suplidor

1. Tesorería → **Anticipos a Suplidores** → **Nuevo**.
2. Captura suplidor, banco origen, fecha, monto y referencia.
3. Postea **Dr 1690 / Cr Banco**. El anticipo queda disponible para aplicar
   contra una factura futura desde Cuentas por Pagar (ver Capítulo 7).

### 4.5 Caja chica (rol Office incluido)

1. Tesorería → **Caja chica** → **Nuevo vale** para cada gasto.
2. Al cierre del fondo, **Reponer** genera el asiento de reposición desde el
   banco a caja.
3. Cierres semanales bloquean los vales del período.

### 4.6 Conciliación bancaria

1. Tesorería → **Conciliación**.
2. Importar el estado de cuenta del banco (formato soportado por la entidad).
3. El sistema sugiere emparejamientos automáticos por monto y fecha.
4. Marca como conciliados los que cuadran; investiga las diferencias.
5. Las comisiones bancarias detectadas se categorizan automáticamente.

## 5. Reglas de negocio y validaciones

- **Cuenta puente 0000** se usa exclusivamente para transferencias internas;
  su saldo final del día debe ser cero.
- **Cuenta 1690** se usa exclusivamente para anticipos a suplidores.
- **Períodos cerrados** bloquean cualquier inserción de movimiento con fecha
  dentro del período.
- **Multi-moneda**: cada movimiento guarda monto en moneda original, tasa
  usada y monto en DOP. La diferencia FX realizada se aísla a **8510**.

## 6. Impacto contable

| Operación | Asiento típico |
|---|---|
| Transferencia interna | Dr Banco destino / Cr 0000; Dr 0000 / Cr Banco origen |
| Pago de TC | Dr Pasivo TC / Cr Banco |
| Anticipo a suplidor | Dr 1690 / Cr Banco |
| Reposición caja chica | Dr 1110 (caja) / Cr Banco |
| Conciliación de comisión | Dr Gasto bancario / Cr Banco |

## 7. Errores comunes y solución

- **"Cuenta destino sin chart_account_id"** — la cuenta bancaria no está
  vinculada a una cuenta del catálogo; edítala y completa el campo.
- **"Período cerrado"** — la fecha capturada cae en un período bloqueado;
  cambia la fecha o pide al admin abrir el período.
- **Diferencia FX inesperada** — la tasa capturada difiere de la oficial del
  día; verifica BCRD del día (ver Capítulo 6d — FX).

## 8. Capítulos relacionados

- Capítulo 6 — Contabilidad (asientos, períodos, catálogo)
- Capítulo 6d — FX (tasas oficiales y revaluación)
- Capítulo 7 — Cuentas por Cobrar y Pagar (aplicación de anticipos)
