# Capítulo 4 — Compras

## 1. Propósito

El módulo de Compras gestiona el ciclo completo: orden de compra (PO) →
recepción de mercancía → factura del proveedor → vinculación con Cuentas por
Pagar. Aplica las reglas DGII (NCF, retenciones B11) e integra adjuntos OCR
para facturas escaneadas.

## 2. Roles y permisos

| Acción | Admin | Management | Accountant | Supervisor | Otros |
|---|---|---|---|---|---|
| Ver POs | ✓ | ✓ | ✓ | ✓ | lectura |
| Crear PO | ✓ | ✓ | ✓ | ✓ | — |
| Recibir mercancía | ✓ | ✓ | ✓ | ✓ | — |
| Capturar factura | ✓ | ✓ | ✓ | — | — |
| Validar match PO ↔ factura | ✓ | — | ✓ | — | — |

## 3. Recorrido de pantalla

Página **Compras** con tres pestañas:

- **Órdenes de compra** — listado, búsqueda, creación, detalle de líneas.
- **Recepciones (Goods Receipts)** — qué llegó y cuándo, vinculado a la PO.
- **Facturas pendientes de match** — facturas capturadas en CxP cuya
  conciliación con PO + recepción aún está pendiente.

> [SCREENSHOT: Compras → tabla de POs con badges de estado]

Estados de PO:
- `open` — abierta, sin recepciones.
- `partially_received` — recepción parcial.
- `received` — totalmente recibida.
- `closed` / `cancelled`.

## 4. Flujos paso a paso

### 4.1 Crear una PO

1. Compras → **Nueva PO**.
2. Captura suplidor (autocompleta desde Contactos), fecha, moneda y notas.
3. Agrega líneas: ítem, cantidad, precio unitario, cuenta destino.
4. **Crear**. RPC `create_purchase_order` genera la PO con estado `open` y
   numera (`po_number`).

### 4.2 Recibir mercancía (Goods Receipt)

1. Compras → **Recepciones** → **Nueva recepción**.
2. Selecciona la PO (solo abiertas o parcialmente recibidas aparecen).
3. Por cada línea, captura cantidad recibida (≤ pendiente).
4. Notas y fecha.
5. **Recibir**. RPC `receive_goods` actualiza `qty_received` por línea, ajusta
   stock de inventario y avanza el estado de la PO.

### 4.3 Capturar la factura del proveedor

La factura entra desde **Cuentas por Pagar** (Capítulo 7) capturando NCF,
fecha, monto y vínculo a la PO. Adjunta el escaneo: el OCR (Gemini 2.5 Pro)
sugiere monto, NCF y fecha que el usuario confirma.

#### Reglas NCF / B11

- Tipos de NCF aceptados se validan contra DGII (B01, B02, B11, B14, B15).
- **B11 — Comprobante de Compras a informales**: si la factura es B11, se
  aplican automáticamente:
  - Retención **100 % ITBIS**: Dr ITBIS adelantado / Cr 2310 ITBIS por pagar.
  - Retención **ISR** según tasa del servicio.
  El proveedor recibe el neto.
- Duplicados: el sistema bloquea la captura si existe otra factura con mismo
  RNC + NCF en el período.

### 4.4 Validar match PO ↔ factura

1. Compras → **Facturas pendientes de match** → fila de factura.
2. **Validar match**. RPC `validate_po_invoice_match` verifica:
   - Cantidades facturadas ≤ recibidas.
   - Total factura concuerda con suma de líneas (± tolerancia).
   - Monedas y suplidor concuerdan.
3. Estado pasa a `matched` y la factura se libera para pago.

## 5. Reglas de negocio y validaciones

- **No se puede facturar más de lo recibido** por línea.
- **Período cerrado** bloquea recepciones e ingreso de facturas con fecha del
  período.
- **Adjuntos**: cada PO/recepción/factura admite múltiples archivos
  (`transaction_attachments`); ruta estándar
  `entity/{entity_id}/po/{po_id}/...`.
- **Tasa multi-moneda**: PO y factura pueden ir en moneda distinta a DOP; la
  tasa de la factura define el monto contable.
- **Edición**: una PO con recepciones no puede modificar líneas ya recibidas.

## 6. Impacto contable

Las POs **no postean** asientos por sí solas. Los asientos se generan en:

| Evento | Asiento |
|---|---|
| Recepción de mercancía | Dr Inventario (14xx) / Cr GR/IR (2120) |
| Factura | Dr GR/IR (2120) / Cr 2110 (CxP) ± impuestos |
| Factura B11 | + Dr ITBIS adelantado / Cr 2310 (retención) + Dr 2110 / Cr 2330 (ISR retenido) |
| Pago | Dr 2110 / Cr Banco (Capítulo 7) |

## 7. Errores comunes

- **"NCF duplicado"** — ya existe la factura para ese RNC + NCF.
- **"Cantidad excede recibida"** al validar match — captura una recepción
  faltante primero.
- **OCR falló** — el escaneo es de baja calidad; captura los campos a mano.
- **PO en `closed` no permite recepción** — reabrir requiere admin (se
  recomienda crear una nueva PO en su lugar).

## 8. Capítulos relacionados

- Capítulo 7 — Cuentas por Pagar (captura y pago de la factura)
- Capítulo 6a — Contabilidad core (asientos y períodos)
- Capítulo 9 — DGII (606 / 607 / 608, retenciones)
