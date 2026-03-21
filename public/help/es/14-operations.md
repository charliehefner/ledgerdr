# Capítulo 5: Operaciones

Este capítulo cubre todos los módulos que apoyan la gestión diaria del campo y los equipos: registro de operaciones de campo, manejo de combustible y equipos, seguimiento del inventario de agroquímicos, registro de mano de obra eventual, programación de trabajadores y mantenimiento de contratos de servicio. Lea este capítulo si es Supervisor, Encargado de Finca o Contador responsable del ingreso de datos operativos.

> **¿Quién puede acceder a Operaciones?**
> Los Supervisores tienen acceso completo a los módulos de Operaciones, Combustible, Mantenimiento, Cronograma y Lluvia. Los Contadores comparten el acceso operativo completo y además pueden crear transacciones vinculadas a operaciones. Los roles de Gerencia y Administrador tienen acceso completo a todos los módulos. Los Visores pueden leer todos los datos operativos pero no pueden crear ni editar registros.

---

## 5.1 Mapa del Módulo de Operaciones

La sección de Operaciones de Ledger DR es accesible desde el menú de navegación izquierdo. Contiene los siguientes submódulos:

| Submódulo | Propósito |
|---|---|
| Operaciones de Campo | Registrar operaciones mecánicas y manuales por finca, fecha, implemento y operador |
| Combustible | Registrar despachos de combustible y recargas de tanques; monitorear el consumo de equipos |
| Mantenimiento de Equipos | Registrar cambios de aceite y mantenimientos rutinarios por horómetro |
| Inventario | Gestionar existencias de agroquímicos e insumos; registrar compras y consumo |
| Mano de Obra Eventual | Registrar y cerrar entradas semanales de jornaleros por campo y tarea |
| Cronograma | Plan de trabajo semanal para empleados fijos y jornaleros |
| Contratos de Servicio | Registrar contratos de equipos de terceros por unidad de trabajo y pago |
| Lluvia | Registrar lecturas diarias de precipitación en las cuatro estaciones meteorológicas |

---

## 5.2 Fincas y Campos

Todas las operaciones se asignan a un campo específico. Los campos pertenecen a fincas. Entender la jerarquía finca-campo es esencial antes de registrar cualquier operación.

### 5.2.1 Lista de Fincas

El sistema gestiona actualmente ocho fincas:

- La Java
- Madrigal
- Palmarito
- Bebe
- La Virgencita
- Solar
- Caoba
- Carriles

Las fincas son administradas por los administradores del sistema. Si falta una finca, contacte a su administrador — no cree entradas duplicadas.

### 5.2.2 Campos

Hay 84 campos registrados en todas las fincas. Cada campo tiene un código corto (ej., C02, BN5, AP01) y un tamaño en hectáreas. Al registrar una operación, seleccione el campo del menú desplegable. Los campos inactivos no aparecen en el desplegable.

> **Códigos de campo**
> Los códigos de campo son identificadores alfanuméricos cortos asignados cuando se crea el campo. Si no puede encontrar un campo en el desplegable, puede estar desactivado. Solicite a su administrador que lo reactive, o verifique que haya seleccionado el filtro de finca correcto primero.

---

## 5.3 Registro de Operaciones de Campo

Una operación de campo es cualquier actividad agrícola mecánica o manual realizada en un campo específico en una fecha determinada — rastreo, siembra, pulverización, cosecha, etc. Las operaciones son el registro de productividad central del sistema.

Navegue a **Operaciones > Operaciones de Campo** y haga clic en **+ Nueva Operación**.

### 5.3.1 Tipos de Operación

El sistema tiene 41 tipos de operación activos, divididos en mecánicos (requiere tractor) y manuales (sin tractor). El tipo seleccionado determina qué otros campos son relevantes.

**Operaciones mecánicas** (requieren tractor): Cultivador, Distribuir semilla, Tapar mecánico, Mulcher, Canterizador, Rastra, Rastra 2, Rastra 3, Chapear, Cosecha, Pala, Mantenimiento, Pulverizar, Autovolteo, Drenar, Resiembra (mecánica), Siembra, Transporte de semilla, Transporte de fertilizante, Transporte de agua para agroquímicos, Aporque, Transporte de Equipos, Transporte de Piedra, Picador Industria, Transporte de personal.

**Operaciones manuales** (sin tractor): Remover Pajón, Recoger piedra, Siembra manual, Tapar manual, Deshierbo manual, Recoger palos/raíces, Sacado de pajón, Chapeo manual, Chapeo Trimmer, Drenar Agua, Corte de semilla, Resiembra, Retapado, Fertilización, Pulverizar (manual), Empalizada.

> **Operaciones mecánicas vs. manuales**
> Las operaciones mecánicas requieren seleccionar un Tractor y pueden requerir un Implemento. El campo Tractor es opcional en el formulario pero se recomienda firmemente — sin él, el seguimiento del horómetro y la reconciliación de combustible son imposibles. Las operaciones manuales no requieren tractor; ingrese el Número de Trabajadores en su lugar.

### 5.3.2 Campos del Formulario de Operación

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Fecha de Operación | Requerido | La fecha en que se realizó el trabajo. Por defecto, hoy. No puede ser una fecha futura. |
| Tipo de Operación | Requerido | Seleccionar de 41 tipos activos. Determina si se muestran los campos de tractor e implemento. |
| Campo | Requerido | El campo específico de la finca donde se realizó la operación. |
| Tractor | Recomendado | Requerido para todas las operaciones mecánicas. Seleccionar de los 10 tractores registrados. Dejarlo en blanco desactiva el seguimiento del horómetro y los reportes de eficiencia de combustible. |
| Implemento | Opcional | El implemento acoplado al tractor. No requerido para transporte u operaciones simples. |
| Operador | Recomendado | Nombre del operador del tractor. Texto libre. Usado en reportes de productividad y trazabilidad de equipos. |
| Horas Inicio | Recomendado | Lectura del horómetro al inicio de la operación. Requerido para los cálculos de galones por hora. |
| Horas Fin | Recomendado | Lectura del horómetro al final. Debe ser ≥ Horas Inicio. |
| Hectáreas Trabajadas | Recomendado | Área cubierta en hectáreas. Se usa para calcular el costo por hectárea y las tasas de aplicación. Por defecto, 0. |
| Número de Trabajadores | Condicional | Cantidad de trabajadores manuales involucrados. Requerido para operaciones manuales. |
| Notas | Opcional | Notas en texto libre sobre condiciones, problemas u observaciones. |

> ⚠️ **Siempre ingrese las hectáreas trabajadas**
> Las Hectáreas Trabajadas es la métrica de productividad más importante. Actualmente el 82% de las operaciones en el sistema tienen este campo en cero, lo que hace que los reportes de costo por hectárea sean poco confiables. Por favor ingrese el área real completada en cada operación, aunque sea una estimación.

### 5.3.3 Referencia de Tractores y Equipos

| Nombre | Tipo / Marca | Horas Actuales |
|---|---|---|
| Pala Volvo | Volvo L70H (cargador) | 541 h |
| Shaktiman | Shaktiman 3636 Tejas | 51 h |
| Landini 90S | Landini 90S | 2,027 h |
| JD3006 | John Deere 6150R | 7,141 h |
| JD2326 | John Deere 6150R | 7,190 h |
| JD 7280R | John Deere 7280R | 5,074 h |
| MF4297 | Massey Ferguson 4297 | 4,660 h |
| JD 7230R | John Deere 7230R | 5,522 h |
| Drone | Drone (pulverizador aéreo) | 0 h |
| Contrato | Equipo de contrato externo | 2,588 h |

Los implementos disponibles incluyen: Cultivadora (Baldan), Rastra Tatú, Rastra Maschio, Mulcher (FAE), Cosechadora (Colhicana), Canterizador (Agromatão), Chapeadora, Pulverizador, Tapador, Sanjeador, Autovolteo, Cobra (Elho), Trimmer (Stihl) y Carreta de cana.

### 5.3.4 Adjuntar Insumos de Inventario

Si la operación involucró la aplicación de agroquímicos, fertilizantes u otros insumos de inventario, puede adjuntar los insumos consumidos directamente al registro de la operación.

1. Guarde la operación primero.
2. Abra la operación guardada y desplácese hasta la sección **Insumos** en la parte inferior de la vista de detalle.
3. Haga clic en **+ Agregar Insumo**.
4. Seleccione el artículo de inventario del menú desplegable (solo se muestran los artículos activos).
5. Ingrese la cantidad utilizada en la unidad base del artículo (litros, kg o galones según corresponda).
6. Haga clic en **Guardar Insumo**. Repita para cada producto aplicado.

> **Insumos y existencias**
> Cada insumo que adjunte registra la cantidad utilizada contra ese artículo de inventario. Este es el mecanismo principal para rastrear el consumo de agroquímicos por campo y operación. Ver Sección 5.6 para la gestión de Inventario.

### 5.3.5 Edición y Eliminación de Operaciones

Las operaciones pueden editarse por Supervisores, Contadores y Gerencia en cualquier momento. Use el ícono de edición desde la lista de operaciones o desde la vista de detalle de la operación.

> ⚠️ **Eliminar una operación también elimina sus insumos**
> Si elimina una operación que tiene insumos adjuntos, todos los registros de insumos de esa operación se eliminan permanentemente. Esto afectará los reportes de consumo de inventario. Prefiera editar en lugar de eliminar siempre que sea posible.

---

## 5.4 Gestión de Combustible

El módulo de Combustible rastrea el consumo de diesel en los tres tanques y diez equipos de la finca. Hay dos tipos de transacciones: **recargas** (diesel añadido a un tanque) y **despachos** (diesel dispensado de un tanque a un equipo).

### 5.4.1 Tanques de Combustible

| Nombre del Tanque | Tipo de Uso | Capacidad | Nivel Actual |
|---|---|---|---|
| Mobile | Agricultura | 560 gal | 462 gal |
| Main Tank | Agricultura | 1,200 gal | 0 gal |
| Planta Tank | Industria | 1,000 gal | 110 gal |

> ⚠️ **Los niveles mostrados pueden no estar actualizados**
> Limitación conocida del sistema: las transacciones de despacho de combustible actualmente actualizan el contador de la bomba pero pueden no deducir automáticamente los galones del nivel mostrado del tanque. Siempre verifique el medidor físico del tanque al planificar compras de combustible. Está programada una corrección para la deducción automática del nivel del tanque.

### 5.4.2 Registro de un Despacho de Combustible

Un despacho se registra cuando se bombea diesel de un tanque a un equipo. Navegue a **Operaciones > Combustible > + Nueva Transacción de Combustible** y seleccione **Despacho**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Tanque | Requerido | De qué tanque se extrae el combustible. |
| Equipo | Requerido | El tractor o equipo que recibe el combustible. |
| Fecha y Hora | Requerido | Por defecto, ahora. |
| Galones | Requerido | Galones despachados. Debe ser mayor que cero. |
| Lectura Inicial de Bomba | Requerido | Lectura del odómetro de la bomba antes de comenzar el despacho. |
| Lectura Final de Bomba | Requerido | Lectura del odómetro de la bomba al terminar el despacho. La diferencia debe coincidir con el campo Galones. |
| Lectura del Horómetro | Recomendado | Horómetro actual del equipo al momento del abastecimiento. Se usa para calcular la eficiencia en galones por hora. |
| Notas | Opcional | Cualquier observación relevante. |

> **Envíos por el portal de conductores**
> Los conductores con rol de Driver pueden enviar despachos de combustible directamente desde un portal adaptado para móviles. Estos envíos aparecen en **Operaciones > Combustible > Envíos Pendientes** para su revisión antes de ser confirmados en el sistema.

### 5.4.3 Registro de una Recarga de Tanque

Navegue a **Operaciones > Combustible > + Nueva Transacción de Combustible** y seleccione **Recarga**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Tanque | Requerido | El tanque que se está recargando. |
| Fecha | Requerido | La fecha de entrega. |
| Galones | Requerido | Galones entregados. |
| Notas | Recomendado | Registrar el nombre del proveedor y el número de referencia de la entrega. |

> **Recarga y el módulo de contabilidad**
> Las compras grandes de combustible también deben registrarse como una transacción en **Contabilidad > Transacciones** (ver Capítulo 4) para capturar el costo financiero. La recarga de combustible registra solo el volumen físico.

### 5.4.4 Revisión del Consumo de Combustible

La vista de lista de combustible muestra todos los despachos y recargas en orden cronológico inverso. Filtre por tanque, equipo o rango de fechas. Cada despacho muestra la eficiencia calculada en galones por hora donde se proporcionó una lectura del horómetro.

> **Detección de consumo excesivo**
> Un aumento significativo en los galones por hora de un tractor específico puede indicar un problema mecánico o un error de ingreso de datos. Revise cualquier lectura que difiera en más del 30% del promedio histórico del mismo equipo.

---

## 5.5 Mantenimiento de Equipos

El submódulo de Mantenimiento registra los eventos de servicio rutinario para cada equipo. Cada tractor tiene un intervalo de mantenimiento (por defecto 250 horas) que activa una advertencia cuando el horómetro actual se acerca al umbral del próximo servicio.

### 5.5.1 Contador de Mantenimiento

La lista de equipos muestra las horas restantes de cada tractor hasta el próximo servicio programado, calculado como:

> *Horas hasta el mantenimiento = Intervalo de mantenimiento − (Horómetro actual − Lectura del horómetro en el último mantenimiento)*

Cuando un tractor llega a 0 horas restantes, el sistema muestra una insignia de advertencia de mantenimiento en la tarjeta del equipo y en el formulario de operaciones cuando ese tractor es seleccionado.

### 5.5.2 Registro de un Evento de Mantenimiento

Navegue a **Operaciones > Equipos > seleccionar el tractor > pestaña Mantenimiento > + Registrar Mantenimiento**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Fecha de Mantenimiento | Requerido | La fecha en que se realizó el servicio. Por defecto, hoy. |
| Tipo de Mantenimiento | Requerido | Actualmente solo Rutinario. Tipos adicionales pueden ser agregados por administradores. |
| Lectura del Horómetro | Requerido | El horómetro del tractor en el momento del servicio. Esto reinicia el contador de mantenimiento. |
| Notas | Recomendado | Registrar el trabajo realizado: grado del aceite, números de parte de filtros, nombre del técnico, problemas observados. |

> ⚠️ **Correcciones del horómetro**
> El sistema solo acepta lecturas del horómetro iguales o mayores a la última lectura registrada. Si se hizo un registro de mantenimiento con un valor incorrecto (demasiado alto), el contador de mantenimiento quedará basado en un punto de referencia erróneo. Contacte a su administrador para corregir esto — no puede solucionarse creando un nuevo registro de mantenimiento.

---

## 5.6 Inventario

El módulo de Inventario gestiona los niveles de existencias de todos los agroquímicos, fertilizantes y otros insumos agrícolas. El inventario actual contiene 27 artículos activos.

### 5.6.1 Visualización de Niveles de Existencias

Navegue a **Operaciones > Inventario** para ver todos los artículos activos con su cantidad actual, unidad de compra, unidad de uso y dosis recomendada por hectárea donde esté configurada.

> ⚠️ **Las alertas de stock mínimo no están configuradas aún**
> Ninguno de los 27 artículos de inventario tiene actualmente un umbral de stock mínimo establecido, por lo que no se activarán alertas de bajo inventario. Los supervisores deben revisar manualmente los niveles de existencias antes de planificar operaciones de pulverización o fertilización.

### 5.6.2 Registro de una Compra

Navegue a **Operaciones > Inventario > seleccionar el artículo > + Nueva Compra**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Fecha de Compra | Requerido | La fecha en que se recibieron los productos. |
| Cantidad | Requerido | La cantidad recibida en la unidad de compra del artículo (litros, kg, galones). |
| Precio Unitario | Requerido | Precio por unidad de compra en DOP. |
| Precio Total | Requerido | Calculado automáticamente como Cantidad × Precio Unitario. Puede modificarlo si el total de la factura difiere. |
| Unidad de Empaque | Recomendado | El formato de empaque (ej., litro, galón, saco, tambor). |
| Cantidad por Empaque | Recomendado | Unidades por empaque. Se usa para convertir entre unidades de compra y unidades de almacenamiento. |
| Proveedor | Recomendado | Nombre del suplidor o distribuidor. |
| Número de Documento | Recomendado | Número de factura u orden de compra. Siempre regístrelo con fines de auditoría. |
| Notas | Opcional | Condición de la entrega, número de lote o fecha de vencimiento. |

> **Vincular compras a contabilidad**
> Para compras superiores a RD$5,000, cree también una transacción correspondiente en **Contabilidad > Transacciones** (ver Capítulo 4). La compra de inventario registra la entrada física de existencias; la transacción contable registra el gasto financiero. Los dos registros no se vinculan automáticamente — debe crear ambos.

### 5.6.3 Referencia de Artículos de Inventario

**Herbicidas post-emergentes**
Agromina 72 SL, Ametrex 50 SC, Cañarex 65 WG, Terbutrizell, Glifosato, Crezendo 45.5 CS, Rainbomina, Revolver, Profitol 75 WG, Picloran, MSMA, Dinamic (polvo), Dinamix (polvo)

**Herbicidas pre-emergentes**
Pledge 51 WG (kg), Enfoke 75 WG (gramo), Karmex, Mayoral 35 SL

**Fertilizantes**
DAP (kg), Cover Fertilizer (kg), Nutrihojas (litro)

**Coadyuvantes y acondicionadores**
Bivert (adherente), Bionex (adherente), Abland (condicionador), pH Ned (condicionador)

**Combustible (gestionado automáticamente desde los niveles de tanque)**
Diesel Agrícola (galones), Diesel Industrial (galones)

> **Artículo duplicado: Dinamic**
> Actualmente hay dos artículos llamados "Dinamic" en el sistema (ambos herbicidas post-emergentes, ambos en kg). Antes de registrar el uso de Dinamic, verifique cuál artículo debe referenciar su operación. Solicite a su administrador que fusione o renombre el duplicado.

---

## 5.7 Mano de Obra Eventual (Jornaleros)

El módulo de Mano de Obra Eventual rastrea el trabajo realizado por jornaleros pagados por día o tarea. Las entradas se agrupan por semana y pueden cerrarse una vez verificadas y pagadas.

### 5.7.1 Registro de una Entrada de Jornalero

Navegue a **Operaciones > Mano de Obra Eventual > + Nueva Entrada**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Fecha de Trabajo | Requerido | La fecha real en que se realizó el trabajo. |
| Fecha de Cierre de Semana | Requerido | El sábado que finaliza la semana laboral a la que pertenece esta entrada. Se usa para reportes semanales y agrupación de pagos. |
| Descripción de la Operación | Requerido | Una breve descripción de la tarea realizada (ej., Chapeo manual, Siembra manual). Texto libre — no se vincula con los tipos de operación formales. |
| Nombre del Campo | Recomendado | El campo donde se realizó el trabajo. Ingrese el código del campo (ej., Java 2, BN5) para consistencia. |
| Nombre del Trabajador | Recomendado | Nombre del jornalero. Dejar en blanco solo si se registra un total grupal. |
| Número de Trabajadores | Requerido | Cantidad de trabajadores para esta entrada. Por defecto, 1. |
| Monto | Requerido | Pago total por esta entrada en DOP. Para un grupo, este es el total combinado. |

### 5.7.2 Cierre de Semana

Una vez verificadas y pagadas todas las entradas de jornaleros de una semana, marque la semana como cerrada. Navegue a **Operaciones > Mano de Obra Eventual**, filtre por fecha de cierre de semana y haga clic en **Cerrar Semana**.

- Las entradas cerradas son de solo lectura y no pueden editarse.
- Cerrar una semana no crea automáticamente una transacción contable — debe crear la entrada de pago manualmente en **Contabilidad > Transacciones**.

> **Registro de jornaleros**
> Los jornaleros registrados se mantienen en **Operaciones > Jornaleros**, donde se registran su cédula y estado activo. Puede registrar entradas para trabajadores no registrados usando texto libre en el campo Nombre del Trabajador, pero se prefieren los trabajadores registrados para los reportes de nómina y verificación de identidad.

---

## 5.8 Cronograma (Plan de Trabajo Semanal)

El Cronograma es el plan de trabajo semanal para todos los empleados fijos y jornaleros registrados. Muestra la tarea asignada a cada trabajador para cada día y franja horaria (mañana / tarde) de la semana actual.

### 5.8.1 Navegación del Cronograma

Navegue a **Operaciones > Cronograma**. La vista muestra la semana actual (lunes a sábado) con cada trabajador como fila y cada día-franja como columna. Use las flechas de semana para navegar a semanas anteriores o futuras.

- Las fechas de cierre de semana van de sábado a sábado. Actualmente hay ocho semanas abiertas.
- Los empleados aparecen con tipo **Empleado**; los jornaleros con tipo **Jornalero**.
- Las franjas de mañana y tarde se rastrean por separado.
- Los días 1–6 corresponden de lunes a sábado.

### 5.8.2 Agregar una Entrada al Cronograma

Haga clic en cualquier celda vacía de la cuadrícula (trabajador × día × franja) para crear una nueva entrada.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Tarea | Recomendado | La operación o tarea asignada al trabajador. Texto libre. |
| Es Feriado | Opcional | Marcar si esta franja cae en un día feriado oficial. Afecta el cálculo de nómina. |
| Es Vacaciones | Opcional | Marcar si el trabajador está en vacaciones aprobadas. Afecta el cálculo de nómina. |

> **Cronograma y nómina**
> El cronograma se integra directamente con el módulo de nómina. Marcar una franja como Es Feriado o Es Vacaciones aquí activa la regla de pago correspondiente al procesar la nómina. Mantenga siempre el cronograma actualizado antes de cerrar un período de nómina.

---

## 5.9 Contratos de Servicio

El módulo de Contratos de Servicio rastrea los contratos de equipos o mano de obra de terceros facturados por unidad — típicamente por hora, hectárea o tonelada.

### 5.9.1 Creación de un Contrato de Servicio

Navegue a **Operaciones > Contratos de Servicio > + Nuevo Contrato**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Nombre del Contrato | Requerido | Un nombre descriptivo que identifique este compromiso. |
| Propietario / Contratista | Requerido | El nombre de la empresa o persona que presta el servicio. |
| Cédula/RNC del Propietario | Recomendado | El RNC del contratista. Requerido para reportes de la DGII cuando los pagos superen los umbrales de reporte. |
| Tipo de Operación | Requerido | Tipo de trabajo contratado (Excavadora, Chapeo, Cosecha, Transporte, Otro). |
| Tipo de Unidad | Requerido | La unidad de facturación: horas, hectáreas o toneladas. |
| Precio por Unidad | Requerido | La tarifa acordada en DOP por unidad. |
| Finca | Opcional | La finca a la que está asociado este contrato. |
| Banco / Cuenta | Opcional | Datos bancarios del contratista para referencia de pago. |
| Comentarios | Opcional | Términos del contrato, notas o referencias. |

### 5.9.2 Registro de Entradas de Trabajo

Cada día o sesión de trabajo contratado se registra como una entrada. Abra el contrato y haga clic en **+ Agregar Entrada**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Fecha de Entrada | Requerido | Fecha en que se realizó el trabajo. |
| Descripción | Requerido | Breve descripción del trabajo realizado ese día. |
| Unidades Cobradas | Requerido | Número de horas, hectáreas o toneladas completadas en esta sesión. |
| Costo Calculado | Automático | Calculado automáticamente como Unidades Cobradas × Precio por Unidad. |
| Costo Ajustado | Opcional | Ingrese un monto diferente si el costo de la sesión se desvía de la tarifa estándar. |
| Comentarios | Opcional | Cualquier nota sobre la sesión. |

### 5.9.3 Registro de Pagos

Los pagos se registran bajo la pestaña **Pagos** del contrato. Haga clic en **+ Agregar Pago**.

1. Ingrese la fecha de pago, el monto en DOP y cualquier nota.
2. En el campo **Transacción**, vincule el pago a una transacción contable existente (creada en **Contabilidad > Transacciones**). Esto crea la trazabilidad de auditoría formal entre el registro operativo y el libro mayor financiero.
3. Haga clic en **Guardar**. El saldo pendiente del contrato se actualiza automáticamente.

> **Saldo del contrato**
> La vista de detalle del contrato muestra el valor total de trabajo (suma de todas las entradas), el total pagado (suma de todos los pagos) y el saldo pendiente.

---

## 5.10 Registros de Lluvia

El módulo de Lluvia captura las lecturas diarias de precipitación de cuatro estaciones meteorológicas de la finca.

### 5.10.1 Registro de una Lectura de Lluvia

Navegue a **Operaciones > Lluvia > + Nueva Lectura**.

| Campo | ¿Requerido? | Descripción |
|---|---|---|
| Fecha | Requerido | La fecha de la medición. Cada fecha solo puede tener un registro. |
| Palmarito (mm) | Recomendado | Precipitación en milímetros en la estación Palmarito. |
| Solar (mm) | Recomendado | Precipitación en milímetros en la estación Solar. |
| Virgencita (mm) | Recomendado | Precipitación en milímetros en la estación La Virgencita. |
| Caoba (mm) | Recomendado | Precipitación en milímetros en la estación Caoba. |

Deje un campo de estación en blanco si ese pluviómetro no fue leído ese día — no ingrese 0 a menos que se haya medido realmente cero lluvia. Un valor en blanco significa "no registrado"; un valor cero significa "no hubo lluvia".

> **Lluvia y planificación de operaciones**
> Una buena práctica es ingresar las lecturas de lluvia cada mañana antes de registrar las operaciones de campo. Los eventos de lluvia intensa (por encima de 20 mm) generalmente afectan si deben realizarse operaciones de pulverización o de contacto con el suelo. Los supervisores pueden consultar los últimos 7 días de lluvia desde la vista del Cronograma para orientar el plan de trabajo del día.

---

## 5.11 Casos Frecuentes

| Situación | Cómo registrarla |
|---|---|
| Operación de pulverización con mezcla de productos | Crear una Operación de Campo (tipo: Pulverizar), seleccionar tractor e implemento pulverizador, ingresar horas de inicio y fin. Después de guardar, agregar cada producto como Insumo (ej., Revolver 6.2 L + Abland 0.91 L). Ingresar hectáreas trabajadas. |
| Deshierbo manual con jornaleros | Crear una Operación de Campo (tipo: Deshierbo manual o Chapeo manual), dejar Tractor en blanco, ingresar Número de Trabajadores. También crear una Entrada de Jornalero para la misma fecha y campo para registrar el monto del pago. |
| Abastecimiento de tractor en el tanque Mobile | Crear una Transacción de Combustible (Despacho), seleccionar tanque Mobile y el tractor, ingresar lecturas de bomba inicial y final, galones y horómetro actual. Si fue enviado por el portal del conductor, aprobar desde Envíos Pendientes. |
| Entrega de diesel al Main Tank | Crear una Transacción de Combustible (Recarga), seleccionar Main Tank, ingresar galones y nombre del proveedor en Notas. Luego crear una Transacción Contable por el costo (Capítulo 4). |
| Cambio de aceite al JD3006 | Navegar a Equipos > JD3006 > pestaña Mantenimiento > + Registrar Mantenimiento. Establecer tipo como Rutinario, ingresar la lectura del horómetro de hoy, anotar el grado del aceite y el filtro utilizado. |
| Pago semanal de jornaleros | Verificar todas las entradas de jornaleros de la semana, cerrar la semana, luego crear una transacción en Contabilidad > Transacciones por el monto total semanal. |
| Excavadora de tercero contratada por un día | Crear un Contrato de Servicio (o agregar una entrada a uno existente). Registrar las unidades (horas trabajadas). Después del pago, agregar un registro de Pago vinculado a la transacción contable correspondiente. |
| Herbicida con bajo inventario | Verificar Operaciones > Inventario para las existencias actuales. Cuando llegue la compra, registrar una Entrada de Compra de Inventario y crear una Transacción Contable por el costo. |

---

## 5.12 Referencia Rápida — Quién Hace Qué

| Tarea | Admin | Gerencia | Supervisor | Contador |
|---|:---:|:---:|:---:|:---:|
| Crear / editar operaciones de campo | ✓ | ✓ | ✓ | ✓ |
| Registrar despacho / recarga de combustible | ✓ | ✓ | ✓ | ✓ |
| Registrar evento de mantenimiento | ✓ | ✓ | ✓ | ✓ |
| Registrar compra de inventario | ✓ | ✓ | ✓ | ✓ |
| Agregar insumos de inventario a operación | ✓ | ✓ | ✓ | ✓ |
| Crear entrada de jornalero | ✓ | ✓ | ✓ | ✓ |
| Cerrar semana de jornaleros | ✓ | ✓ | ✓ | ✓ |
| Editar entradas del cronograma | ✓ | ✓ | ✓ | ✓ |
| Crear / gestionar contratos de servicio | ✓ | ✓ | — | ✓ |
| Agregar pago a contrato de servicio | ✓ | ✓ | — | ✓ |
| Registrar lluvia | ✓ | ✓ | ✓ | ✓ |
| Agregar / desactivar fincas y campos | ✓ | ✓ | — | — |
| Agregar / desactivar equipos | ✓ | ✓ | — | — |
| Agregar tipos de operación | ✓ | — | — | — |
| Aprobar envíos del portal de conductores | ✓ | ✓ | ✓ | ✓ |

---

## 5.13 Capítulos Relacionados

- **Capítulo 4: Registro de Transacciones** — registro de costos financieros vinculados a operaciones
- **Capítulo 6: Asientos Contables** — cómo los costos operativos se registran en el libro mayor
- **Capítulo 9: RRHH y Nómina** — seguimiento de tiempo de empleados fijos y procesamiento de nómina
- **Capítulo 10: Reportes DGII** — cómo aparecen los pagos de contratos de servicio y jornaleros en los reportes 606
