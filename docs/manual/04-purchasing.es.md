# Capítulo 4 — Compras

## 1. Propósito

El módulo de Compras gestiona cada paso del proceso por el cual la mercancía entra a la empresa y se convierte en una obligación con el proveedor. Acompaña la transacción desde el momento en que se emite la orden de compra (PO), pasando por la llegada física de los bienes al almacén, hasta la factura del proveedor y su vinculación final con Cuentas por Pagar. A lo largo del flujo, el sistema aplica las reglas de la DGII —en particular la validación de NCF y el régimen de retención para proveedores informales (B11)— e integra el OCR sobre los adjuntos escaneados para hacer la captura más rápida y precisa.

En síntesis, Compras es el lugar donde la empresa compromete un gasto futuro, confirma lo que efectivamente fue entregado y concilia esa realidad con lo que el proveedor termina facturando.

## 2. Roles y permisos

El acceso a Compras se rige por rol. La siguiente tabla muestra qué puede hacer cada rol; "lectura" indica que el usuario puede ver la información pero no modificarla, y "—" indica que la acción no está disponible.

| Acción | Admin | Management | Accountant | Supervisor | Otros |
|---|---|---|---|---|---|
| Ver POs | ✓ | ✓ | ✓ | ✓ | lectura |
| Crear PO | ✓ | ✓ | ✓ | ✓ | — |
| Recibir mercancía | ✓ | ✓ | ✓ | ✓ | — |
| Capturar factura | ✓ | ✓ | ✓ | — | — |
| Validar match PO ↔ factura | ✓ | — | ✓ | — | — |

Solo Admin y Accountant pueden validar el match entre la PO, la recepción y la factura. Esto es intencional: la validación es el punto de control que libera la factura para pago.

## 3. Recorrido de pantalla

La página de **Compras** está organizada en tres pestañas, cada una vinculada a una etapa del flujo.

- **Órdenes de compra** — el listado maestro. Desde aquí puede buscar, filtrar, abrir una PO para ver sus líneas o crear una nueva.
- **Recepciones (Goods Receipts)** — el registro de qué llegó y cuándo, siempre vinculado a la PO de origen.
- **Facturas pendientes de match** — facturas que Cuentas por Pagar capturó pero cuya conciliación con la PO y la recepción aún está pendiente.

> [SCREENSHOT: Compras → tabla de POs con badges de estado]

Una PO transita por uno de cinco estados, asignados automáticamente por el sistema según las recepciones y facturas registradas (no se cambian manualmente):

- `open` — abierta, sin recepciones.
- `partially_received` — recepción parcial.
- `received` — totalmente recibida.
- `closed` / `cancelled` — cerrada o cancelada.

## 4. Flujos paso a paso

Esta sección recorre las acciones más frecuentes del usuario: crear una PO, recibir mercancía, capturar la factura del proveedor y validar el match.

### 4.1 Crear una PO

1. Compras → **Nueva PO**.
2. Capture el suplidor (el campo autocompleta desde Contactos), la fecha, la moneda y las notas.
3. Agregue una línea por ítem, indicando cantidad, precio unitario y cuenta destino.
4. Haga clic en **Crear**. El RPC `create_purchase_order` genera la PO con estado `open` y le asigna el siguiente `po_number`.

> [SCREENSHOT: Formulario Nueva PO con editor de líneas]

### 4.2 Recibir mercancía (Goods Receipt)

1. Compras → **Recepciones** → **Nueva recepción**.
2. Seleccione la PO. Solo aparecen las que están en estado `open` o `partially_received`.
3. Por cada línea, capture la cantidad recibida. La cantidad debe ser menor o igual a la pendiente de esa línea.
4. Agregue notas y fecha de la recepción.
5. Haga clic en **Recibir**. El RPC `receive_goods` actualiza `qty_received` en cada línea, ajusta el stock de inventario y avanza el estado de la PO.

> [SCREENSHOT: Formulario de recepción mostrando cantidades pendientes vs recibidas]

### 4.3 Capturar la factura del proveedor

La factura no se captura directamente desde Compras. Entra al sistema desde **Cuentas por Pagar** (Capítulo 7), donde el usuario registra el NCF, la fecha, el monto y el vínculo con la PO. Al adjuntar el escaneo, el motor de OCR (Gemini 2.5 Pro) lee el documento y sugiere monto, NCF y fecha para que el usuario confirme.

#### Reglas NCF / B11

El manejo de NCF es una de las áreas con más reglas dentro de Compras, porque está directamente atada al cumplimiento DGII.

- Los tipos de NCF aceptados se validan contra DGII: B01, B02, B11, B14, B15.
- **B11 — Comprobante de Compras a informales**: cuando la factura es B11, el sistema aplica automáticamente:
  - Retención **100 % ITBIS**: Dr ITBIS adelantado / Cr 2310 ITBIS por pagar.
  - Retención **ISR** según la tasa del servicio.
  El proveedor recibe el monto neto después de las retenciones.
- Duplicados: el sistema bloquea la captura si ya existe otra factura con el mismo RNC + NCF dentro del mismo período.

### 4.4 Validar match PO ↔ factura

1. Vaya a Compras → **Facturas pendientes de match** y abra la fila de la factura.
2. Haga clic en **Validar match**. El RPC `validate_po_invoice_match` verifica tres condiciones:
   - Las cantidades facturadas son menores o iguales a las recibidas.
   - El total de la factura concuerda con la suma de sus líneas (dentro de la tolerancia configurada).
   - La moneda y el suplidor coinciden con la PO.
3. Si las verificaciones pasan, el estado de la factura cambia a `matched` y la factura queda liberada para pago.

> [SCREENSHOT: Cola de facturas pendientes de match con una factura seleccionada]

## 5. Reglas de negocio y validaciones

Las siguientes reglas aplican a todo el flujo de Compras. Tenerlas claras de antemano evita las sorpresas más comunes al cierre de mes.

- **No se puede facturar más de lo recibido** por línea.
- **Un período cerrado** bloquea tanto las recepciones como las facturas con fecha dentro de ese período.
- **Adjuntos**: cada PO, recepción y factura admite múltiples archivos en `transaction_attachments`, almacenados bajo la ruta estándar `entity/{entity_id}/po/{po_id}/...`.
- **Multi-moneda**: la PO y la factura pueden emitirse en monedas distintas a DOP. La tasa de la factura —no la de la PO— define el monto contable.
- **Edición**: una vez que la PO tiene recepciones, las líneas ya recibidas no pueden modificarse. Las líneas no tocadas siguen siendo editables.

## 6. Impacto contable

La PO en sí misma es un documento de planificación y **no genera** asientos contables. Los movimientos se producen únicamente cuando algo físico ocurre con el inventario o el dinero:

| Evento | Asiento |
|---|---|
| Recepción de mercancía | Dr Inventario (14xx) / Cr GR/IR (2120) |
| Factura | Dr GR/IR (2120) / Cr 2110 (CxP) ± impuestos |
| Factura B11 | + Dr ITBIS adelantado / Cr 2310 (retención) + Dr 2110 / Cr 2330 (ISR retenido) |
| Pago | Dr 2110 / Cr Banco (Capítulo 7) |

La cuenta GR/IR (2120, "Goods Received / Invoice Received") funciona como puente entre la recepción física y los montos facturados. Un saldo en esta cuenta al cierre del mes indica que la empresa ha recibido mercancía aún no facturada, o que existen montos facturados sin recepción asociada — un diagnóstico útil al revisar CxP en el cierre.

## 7. Errores comunes

Los siguientes errores son los más frecuentes en el día a día. Cada uno apunta a una causa específica y a un próximo paso claro.

- **"NCF duplicado"** — ya existe una factura registrada con esa combinación de RNC + NCF. Busque en CxP antes de volver a capturar.
- **"Cantidad excede recibida"** al validar match — capture primero la recepción faltante y luego reintente el match.
- **OCR falló** — la calidad del escaneo es demasiado baja para que el modelo lea con confianza. Capture los campos a mano.
- **PO en `closed` no permite recepción** — reabrir una PO cerrada requiere Admin; en la mayoría de los casos lo más limpio es crear una nueva PO.

## 8. Capítulos relacionados

- Capítulo 7 — Cuentas por Pagar (captura y pago de la factura)
- Capítulo 6a — Contabilidad core (asientos y períodos)
- Capítulo 9 — DGII (606 / 607 / 608, retenciones)

## Glosario

- **PO (Purchase Order / Orden de Compra)** — Documento que compromete a la empresa a comprar bienes o servicios al suplidor en condiciones acordadas. No genera asientos por sí solo.
- **Recepción de mercancía (Goods Receipt)** — Registro interno que confirma la llegada física de los ítems de una PO. Dispara el asiento de inventario.
- **Match a tres puntas (three-way match)** — Control que compara PO, recepción y factura del proveedor antes de autorizar el pago.
- **NCF (Número de Comprobante Fiscal)** — Número fiscal autorizado por la DGII que avala la factura del proveedor. Cada tipo (B01, B02, B11, B14, B15) tiene su propio tratamiento tributario.
- **B11** — Tipo de NCF para facturas emitidas a proveedores informales. Dispara automáticamente la retención del 100 % de ITBIS y la retención de ISR según la tasa aplicable.
- **ITBIS** — Impuesto sobre Transferencias de Bienes Industrializados y Servicios (IVA dominicano).
- **ISR** — Impuesto sobre la Renta.
- **RNC** — Registro Nacional del Contribuyente (cédula tributaria dominicana).
- **GR/IR (cuenta 2120)** — Cuenta puente "Goods Received / Invoice Received"; reconcilia recepción física y monto facturado.
- **CxP (Cuentas por Pagar)** — Cuenta de pasivo 2110 donde se acumulan las facturas de proveedores hasta su pago.
- **RPC** — Función de back-end invocada por la aplicación (por ejemplo `create_purchase_order`, `receive_goods`, `validate_po_invoice_match`).
- **DGII** — Dirección General de Impuestos Internos (autoridad tributaria de la República Dominicana).
