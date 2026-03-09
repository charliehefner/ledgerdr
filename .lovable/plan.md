

## Upgrade Service Receipt to Match Day Labor Receipt Style

### What changes
**Single file**: `src/components/hr/ServicesView.tsx` — rewrite the `generateReceipt` function.

### New receipt layout (matching Day Labor style)
The receipt will produce **two copies per page** (company + worker), separated by a dashed "CORTAR AQUÍ" cut line, with this structure per copy:

```text
                                           COPIA EMPRESA
         RECIBO DE SERVICIO
    Fecha: dd/MM/yyyy

  ┌──────────────────────────────────┐
  │ Prestador:  [Name]               │
  │ Cédula:     [Cedula]             │
  └──────────────────────────────────┘

  ┌──────────────────────────────────┐
  │ Cuenta    Descripción     Monto  │  (header row)
  │ 7040      Soldadura...   RD$X,XX │  (data row)
  └──────────────────────────────────┘

  ┌══════════════════════════════════┐
  │ TOTAL:              RD$ 5,000.00 │  (dark box, white text)
  └══════════════════════════════════┘

  (Amount in words)

  _______________        _______________
  Firma Prestador        Firma Autorizada

- - - - - ✂ CORTAR AQUÍ - - - - - -

         [Same layout — COPIA PRESTADOR]
```

### Key details
- Uses `roundedRect` info box for provider name/cedula (like day labor)
- Table-style header row with grey background for account, description, amount
- Dark total box with white text (matching day labor)
- Amount in Spanish words below total (already implemented, reuse `numberToSpanishWords`)
- Two signature lines side by side
- Two copies separated by dashed cut line with scissors icon
- Copy labels: "COPIA EMPRESA" / "COPIA PRESTADOR"
- Comments field rendered below description if present

### No other changes
The transaction creation logic and close flow remain identical.

