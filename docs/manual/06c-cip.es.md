# Capítulo 6c — CIP (Construcción / proyecto en curso)

## 1. Propósito

CIP (Construction in Progress) es el espacio donde se acumulan los costos de un activo que está en construcción o ensamblaje pero que aún no está listo para usar. El módulo concentra cada costo asociado al proyecto —materiales, equipos aportados por la matriz, facturas de proveedores, asientos manuales— en una cuenta CIP designada. Una vez que el proyecto entra en operación, el saldo acumulado se **capitaliza** a un activo fijo, comienza la depreciación y el proyecto se cierra.

En síntesis, CIP mantiene fuera del gasto y del registro regular de activos fijos el costo en proceso de los proyectos de largo plazo, hasta que el activo realmente empieza a producir valor.

## 2. Roles y permisos

El acceso se rige por rol. "lectura" es solo consulta y "—" significa que la acción no está disponible.

| Acción | Admin | Management | Accountant | Otros |
|---|---|---|---|---|
| Ver proyectos CIP | ✓ | ✓ | ✓ | lectura |
| Crear proyecto | ✓ | ✓ | ✓ | — |
| Capitalizar | ✓ | ✓ | ✓ | — |

## 3. Recorrido de pantalla

El módulo está en Contabilidad → pestaña **CIP**.

- Una tabla con cada proyecto y sus columnas: nombre, cuenta CIP (1080 / 1180 / 1280), saldo acumulado en DOP, estado (`open` o `capitalized`) y fecha de puesta en servicio.
- Un botón **Nuevo proyecto** en la parte superior. Para cualquier proyecto abierto con saldo mayor a cero, aparece la acción **Capitalizar** en su fila.

> [SCREENSHOT: tabla de proyectos CIP]

## 4. Flujos paso a paso

Esta sección recorre las tres acciones que se realizan sobre un proyecto CIP: crearlo, acumular costo en él y, finalmente, capitalizarlo.

### 4.1 Crear un proyecto

1. Haga clic en **Nuevo proyecto**.
2. Capture el nombre, la cuenta CIP destino y una descripción.
3. Las cuentas CIP disponibles dependen de lo que se está construyendo:
   - **1080** — Anticipos / intangibles en curso
   - **1180** — Construcción en curso (terrenos / edificios)
   - **1280** — Maquinaria y equipo en curso
4. Haga clic en **Crear**. El proyecto inicia en estado `open`.

> [SCREENSHOT: Formulario de nuevo proyecto CIP con selector de cuenta]

### 4.2 Acumular costos

Los costos pueden llegar al proyecto CIP por tres caminos distintos, cada uno asociado a un módulo diferente.

- Un aporte de Casa Matriz tipo *Equipo (CIP)* (ver Capítulo 6b).
- Una factura de proveedor cuya cuenta destino es la cuenta CIP del proyecto (ver Capítulo 4).
- Un asiento manual (ver Capítulo 6a) usando la cuenta CIP junto con la dimensión `cip_project`.

El saldo acumulado que se muestra en la fila del proyecto se calcula sumando los aportes activos vinculados al proyecto vía `home_office_advances.cip_project_id`.

### 4.3 Capitalizar

Capitalizar es el paso final: cuando el proyecto entra en operación, el saldo acumulado se traslada de CIP a un activo fijo real.

1. En la fila del proyecto, haga clic en **Capitalizar**.
2. Capture:
   - Nombre del activo.
   - Serie o placa, cuando aplique.
   - Cuenta de activo destino (el selector se filtra a cuentas del catálogo donde `account_type = ASSET` y la cuenta es postable).
   - Fecha de puesta en servicio.
   - Vida útil en meses (default 60).
   - Valor residual.
3. Haga clic en **Capitalizar**. El RPC `capitalize_cip_project` realiza lo siguiente:
   - Crea el registro `fixed_asset` con costo igual al saldo acumulado.
   - Postea **Dr [cuenta de activo] / Cr [cuenta CIP]** por el monto total.
   - Marca el proyecto como `capitalized` y guarda la `placed_in_service_date`.
   - El activo queda listo para que el módulo de Activos Fijos genere la depreciación mensual (línea recta) en su asiento DEP (ver Capítulo 8).

> [SCREENSHOT: Diálogo de capitalizar con campos de vida útil y valor residual]

## 5. Reglas de negocio y validaciones

Las siguientes reglas mantienen los saldos CIP limpios y el registro final de activos fijos correcto.

- Solo se puede capitalizar un proyecto **abierto con saldo mayor a cero**.
- La capitalización es **todo o nada**: el saldo entero pasa al activo fijo. Si necesita dividir un proyecto entre varios activos, cree proyectos CIP separados desde el inicio.
- La fecha de puesta en servicio debe ser igual o posterior a la fecha del aporte más reciente — no se puede poner un activo en servicio antes de su último costo.
- Una vez que el proyecto está `capitalized`, queda inmutable; los aportes históricos vinculados ya no aceptan ediciones.

## 6. Impacto contable

| Operación | Asiento |
|---|---|
| Acumulación (vía aporte HO) | Dr 1080/1180/1280 / Cr 2160 |
| Acumulación (vía factura) | Dr 1080/1180/1280 / Cr 2110 |
| Capitalización | Dr [activo, p.ej. 1230] / Cr 1080/1180/1280 |
| Depreciación posterior | Dr 7150 / Cr 1450 (gestionado por Activos Fijos) |

Las cuentas CIP (1080 / 1180 / 1280) deben siempre netear con la suma de los proyectos abiertos que se ven en la pestaña. Un drilldown de cualquiera de esas cuentas en el balance debe coincidir con esta vista.

## 7. Errores comunes

- **"Sin proyectos CIP"** al registrar un aporte de Casa Matriz tipo CIP — primero cree el proyecto en esta pestaña y luego registre el aporte.
- **"Cuenta de activo requerida"** al capitalizar — seleccione una cuenta postable del catálogo en el rango 1xxx.
- **Saldo en cero al intentar capitalizar** — no hay aportes vinculados al proyecto. Use el drilldown de la cuenta CIP en el balance para ubicar movimientos que pudieran haberse posteado con la dimensión de proyecto incorrecta.

## 8. Capítulos relacionados

- Capítulo 6b — Casa Matriz
- Capítulo 4 — Compras (facturas con cuenta CIP)
- Capítulo 8 — Activos Fijos (depreciación posterior)

## Glosario

- **CIP (Construction in Progress / Proyecto en curso)** — Categoría en la que se acumula el costo de un activo en construcción o ensamblaje, aún no puesto en servicio.
- **Proyecto CIP** — Bucket nominal específico dentro de CIP, vinculado a una de las cuentas CIP.
- **Cuenta 1080** — Anticipos e intangibles en curso.
- **Cuenta 1180** — Construcción en curso para terrenos y edificios.
- **Cuenta 1280** — Maquinaria y equipo en curso.
- **Capitalización** — Acto de mover el costo acumulado de un proyecto CIP fuera de CIP y hacia un activo fijo, momento en el que comienza la depreciación.
- **Fecha de puesta en servicio** — Fecha en que el activo comienza a producir valor; la depreciación se calcula desde esta fecha.
- **Vida útil** — Cantidad de meses sobre los que se deprecia el activo (default 60).
- **Valor residual** — Valor estimado del activo al final de su vida útil.
- **Asiento DEP** — Asiento de depreciación gestionado por el módulo de Activos Fijos (ver Capítulo 8).
- **`capitalize_cip_project`** — RPC de back-end que crea el activo fijo, postea el asiento de reclasificación y cierra el proyecto.
- **Dimensión `cip_project`** — Dimensión de línea de asiento que ata las entradas manuales a un proyecto CIP específico.
