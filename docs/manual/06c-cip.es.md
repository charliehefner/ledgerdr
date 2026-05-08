# Capítulo 6c — CIP (Construcción / proyecto en curso)

## 1. Propósito

CIP (Construction in Progress) acumula costos de un activo que aún no está
listo para uso. Una vez completado, el saldo acumulado se **capitaliza** a un
activo fijo, comienza la depreciación y el proyecto se cierra.

## 2. Roles y permisos

| Acción | Admin | Management | Accountant | Otros |
|---|---|---|---|---|
| Ver proyectos CIP | ✓ | ✓ | ✓ | lectura |
| Crear proyecto | ✓ | ✓ | ✓ | — |
| Capitalizar | ✓ | ✓ | ✓ | — |

## 3. Recorrido de pantalla

Contabilidad → pestaña **CIP**:

- Tabla con: nombre, cuenta CIP (1080 / 1180 / 1280), saldo acumulado en DOP,
  estado (`open` / `capitalized`), fecha de puesta en servicio.
- Botón **Nuevo proyecto** y, por proyecto abierto con saldo > 0, botón
  **Capitalizar**.

> [SCREENSHOT: tabla de proyectos CIP]

## 4. Flujos paso a paso

### 4.1 Crear un proyecto

1. **Nuevo proyecto**.
2. Captura nombre, cuenta CIP destino y descripción.
3. Cuentas CIP disponibles:
   - **1080** — Anticipos / intangibles en curso
   - **1180** — Construcción en curso (terrenos / edificios)
   - **1280** — Maquinaria y equipo en curso
4. Crear. Estado inicial: `open`.

### 4.2 Acumular costos

Los costos llegan al CIP de tres maneras:

- Aporte de Casa Matriz tipo *Equipo (CIP)* (Capítulo 6b).
- Factura de proveedor con cuenta destino = cuenta CIP del proyecto
  (Capítulo 4).
- Asiento manual (Capítulo 6a) con cuenta CIP del proyecto y dimensión
  `cip_project`.

El saldo acumulado se calcula sumando todos los aportes activos vinculados al
proyecto (`home_office_advances.cip_project_id`).

### 4.3 Capitalizar

Cuando el proyecto entra en operación:

1. En la fila → **Capitalizar**.
2. Captura:
   - Nombre del activo.
   - Serie / placa.
   - Cuenta de activo destino (filtrada a `account_type = ASSET`,
     postable).
   - Fecha de puesta en servicio.
   - Vida útil en meses (default 60).
   - Valor residual.
3. **Capitalizar**. El RPC `capitalize_cip_project`:
   - Crea el `fixed_asset` con costo = saldo acumulado.
   - Postea **Dr [cuenta de activo] / Cr [cuenta CIP]** por el monto total.
   - Marca el proyecto como `capitalized` con `placed_in_service_date`.
   - El activo queda listo para que el módulo de Activos Fijos genere la
     depreciación mensual (línea recta) en su asiento DEP (ver Capítulo 8).

## 5. Reglas de negocio y validaciones

- Solo se puede capitalizar un proyecto **abierto con saldo > 0**.
- La capitalización **no acepta** capitalización parcial: el saldo entero pasa
  al activo fijo. Si necesitas dividir, crea proyectos separados desde el
  inicio.
- La fecha de puesta en servicio debe ser ≥ a la fecha del aporte más
  reciente.
- Una vez `capitalized`, el proyecto queda inmutable; los aportes históricos
  ya no aceptan ediciones.

## 6. Impacto contable

| Operación | Asiento |
|---|---|
| Acumulación (vía aporte HO) | Dr 1080/1180/1280 / Cr 2160 |
| Acumulación (vía factura) | Dr 1080/1180/1280 / Cr 2110 |
| Capitalización | Dr [activo, p.ej. 1230] / Cr 1080/1180/1280 |
| Depreciación posterior | Dr 7150 / Cr 1450 (gestionado por Activos Fijos) |

## 7. Errores comunes

- **"Sin proyectos CIP"** al registrar un aporte tipo CIP — primero crea el
  proyecto en esta pestaña.
- **"Cuenta de activo requerida"** al capitalizar — selecciona una cuenta
  postable del catálogo (1xxx).
- **Saldo en cero al intentar capitalizar** — no hay aportes vinculados; usa
  el drilldown de la cuenta CIP en el balance para ubicar movimientos
  faltantes.

## 8. Capítulos relacionados

- Capítulo 6b — Casa Matriz
- Capítulo 4 — Compras (facturas con cuenta CIP)
- Capítulo 8 — Activos Fijos (depreciación posterior)
