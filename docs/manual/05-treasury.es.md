# Capítulo 5 — Tesorería

## 1. Propósito

El módulo de Tesorería es la ventana operativa donde se registra todo movimiento real de dinero antes de que se cierre contra contabilidad. Gestiona el efectivo y los equivalentes de efectivo de la empresa: cuentas bancarias, tarjetas de crédito, caja chica, transferencias internas entre cuentas propias, pagos de tarjeta y anticipos a suplidores.

Si Compras lleva el control de lo que la empresa se ha comprometido a gastar y Cuentas por Pagar el control de lo que debe, Tesorería es el punto donde el dinero efectivamente sale o entra — y donde se concilian los libros con lo que realmente muestra el banco.

## 2. Roles y permisos

El acceso a Tesorería se rige por rol. La siguiente tabla muestra qué puede hacer cada rol en las siete áreas del módulo. "lectura" significa que el usuario puede ver pero no modificar; "escritura" significa lectura y escritura completas; "—" indica que el área queda oculta.

| Rol | Conciliación | Cuentas bancarias | Tarjetas | Caja chica | Transferencias internas | Pagos TC | Anticipos |
|---|---|---|---|---|---|---|---|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Accountant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supervisor | lectura | lectura | lectura | lectura | lectura | lectura | lectura |
| Office | — | — | — | **escritura** | — | — | — |
| Viewer | lectura | lectura | lectura | lectura | lectura | lectura | lectura |

El rol **Office** entra directamente a la pestaña Caja Chica y no ve el resto; las demás pestañas quedan ocultas para no exponerle opciones que no le aplican.

## 3. Recorrido de pantalla

Tesorería se divide en pestañas, cada una asociada a un tipo específico de movimiento de dinero.

- **Conciliación bancaria** — importa estados de cuenta y empareja líneas con movimientos contables.
- **Cuentas bancarias** — alta y mantenimiento de cuentas por entidad y moneda.
- **Tarjetas de crédito** — registro de tarjetas y de los movimientos realizados con ellas.
- **Caja chica** — captura de vales, reposiciones y cierres semanales.
- **Transferencias internas** — movimientos entre dos cuentas propias (bancos, caja o tarjeta).
- **Pagos de tarjeta** — pagos desde un banco hacia la TC, con manejo de comisiones.
- **Anticipos a suplidores** — pagos por adelantado registrados en cuenta **1690**, listos para aplicar contra una factura futura.

> [SCREENSHOT: pestañas de Tesorería, ancho completo]

## 4. Flujos paso a paso

Esta sección recorre las acciones más comunes en Tesorería, en el orden en que normalmente se encuentran.

### 4.1 Crear una cuenta bancaria

1. Tesorería → **Cuentas bancarias** → **Nueva**.
2. Capture: nombre, banco, número, **moneda** (DOP/USD/EUR/SEK), tipo, cuenta del catálogo (`chart_account_id`) y entidad.
3. Guardar. La cuenta queda activa (`is_active = true`).

> [SCREENSHOT: Formulario de nueva cuenta bancaria]

### 4.2 Registrar una transferencia interna

Una transferencia interna **no es** un gasto ni un ingreso: es un movimiento entre dos cuentas que la empresa posee. Para mantener ambos lados balanceados, el sistema postea contra la cuenta puente **0000 — Transferencias Internas**.

1. Tesorería → **Transferencias Internas** → **Nueva**.
2. Seleccione cuenta origen, cuenta destino, fecha y monto.
3. Si las monedas difieren, capture la tasa de cambio. Cualquier diferencia FX realizada se postea a **8510**.
4. Guardar. Se generan dos asientos balanceados a través de 0000.

### 4.3 Pago de tarjeta de crédito

1. Tesorería → **Pagos de Tarjeta** → **Nuevo pago**.
2. Seleccione la TC, el banco que emite el pago, la fecha, el monto y las comisiones si aplican.
3. El sistema postea Dr Tarjeta / Cr Banco; las comisiones se registran en su cuenta correspondiente.

### 4.4 Anticipo a suplidor

Un anticipo a suplidor es un pago realizado antes de que exista una factura. Queda parqueado en **1690** hasta que pueda aplicarse contra una factura real en Cuentas por Pagar.

1. Tesorería → **Anticipos a Suplidores** → **Nuevo**.
2. Capture suplidor, banco origen, fecha, monto y referencia.
3. El sistema postea **Dr 1690 / Cr Banco**. El anticipo queda disponible para aplicar contra una factura futura desde Cuentas por Pagar (ver Capítulo 7).

### 4.5 Caja chica (rol Office incluido)

Caja chica es la única pestaña en la que un usuario Office puede escribir, dado que normalmente es quien gestiona los gastos pequeños del día a día.

1. Tesorería → **Caja chica** → **Nuevo vale** para cada gasto.
2. Al cierre del fondo, ejecute **Reponer** para generar el asiento de reposición desde el banco hacia caja.
3. Los cierres semanales bloquean los vales del período.

> [SCREENSHOT: Lista de vales de caja chica con indicador de cierre semanal]

### 4.6 Conciliación bancaria

1. Tesorería → **Conciliación**.
2. Importe el estado de cuenta del banco en el formato soportado por esa entidad.
3. El sistema sugiere emparejamientos automáticos por monto y fecha.
4. Marque como conciliados los que cuadran e investigue las diferencias.
5. Las comisiones bancarias detectadas se categorizan automáticamente.

> [SCREENSHOT: Vista de conciliación con líneas auto-emparejadas resaltadas]

## 5. Reglas de negocio y validaciones

Las siguientes reglas aplican a todo Tesorería. Tenerlas claras de antemano evita saldos confusos al cierre de mes.

- **Cuenta puente 0000** se usa exclusivamente para transferencias internas; su saldo al cierre del día debe ser cero.
- **Cuenta 1690** se usa exclusivamente para anticipos a suplidores y no debe usarse para nada más.
- **Períodos cerrados** bloquean la inserción de cualquier movimiento con fecha dentro del período.
- **Multi-moneda**: cada movimiento guarda el monto en moneda original, la tasa usada y el monto en DOP. La diferencia FX realizada se aísla a **8510** para que no contamine las cuentas operativas.

## 6. Impacto contable

| Operación | Asiento típico |
|---|---|
| Transferencia interna | Dr Banco destino / Cr 0000; Dr 0000 / Cr Banco origen |
| Pago de TC | Dr Pasivo TC / Cr Banco |
| Anticipo a suplidor | Dr 1690 / Cr Banco |
| Reposición caja chica | Dr 1110 (caja) / Cr Banco |
| Conciliación de comisión | Dr Gasto bancario / Cr Banco |

Las dos cuentas a vigilar son **0000** (que debe netear a cero cada día) y **1690** (que debe limpiarse a medida que los anticipos se aplican a facturas). Un saldo persistente en cualquiera de las dos es señal de que algo no cerró limpio.

## 7. Errores comunes y solución

- **"Cuenta destino sin chart_account_id"** — la cuenta bancaria no está vinculada a una cuenta del catálogo. Edítela y complete el campo.
- **"Período cerrado"** — la fecha capturada cae en un período bloqueado. Ajuste la fecha o, si corresponde, pida al Admin reabrir el período.
- **Diferencia FX inesperada** — la tasa capturada difiere de la oficial del día. Verifique la tasa BCRD del día (ver Capítulo 6d — FX).

## 8. Capítulos relacionados

- Capítulo 6 — Contabilidad (asientos, períodos, catálogo)
- Capítulo 6d — FX (tasas oficiales y revaluación)
- Capítulo 7 — Cuentas por Cobrar y Pagar (aplicación de anticipos)

## Glosario

- **Tesorería** — Área operativa que cubre todos los movimientos reales de efectivo y equivalentes de efectivo.
- **Cuenta bancaria** — Cuenta que la empresa mantiene en un banco, en una moneda definida y vinculada a una cuenta del catálogo.
- **Transferencia interna** — Movimiento entre dos cuentas propias de la empresa; pasa por la cuenta puente 0000.
- **Cuenta puente 0000** — Cuenta de tránsito de Transferencias Internas; su saldo neto del día debe ser cero.
- **Cuenta 1690** — Anticipos a suplidores; pagos parqueados aquí hasta que se apliquen a una factura.
- **Cuenta 8510** — Cuenta de diferencia FX realizada (ganancia o pérdida); aislada de los resultados operativos.
- **Caja chica** — Fondo de efectivo de bajo monto gestionado a nivel de oficina; se repone desde una cuenta bancaria.
- **Pago de TC** — Pago desde un banco hacia una tarjeta de crédito que reduce el pasivo de la tarjeta.
- **Anticipo a suplidor** — Pago hecho a un suplidor antes de que exista una factura; se aplica posteriormente contra una factura de CxP.
- **Conciliación bancaria** — Proceso de empatar las líneas de un estado de cuenta importado contra los asientos ya registrados en el sistema.
- **BCRD** — Banco Central de la República Dominicana, fuente de la tasa de cambio oficial diaria.
- **DOP / USD / EUR / SEK** — Monedas soportadas en Tesorería (peso dominicano, dólar estadounidense, euro, corona sueca).
