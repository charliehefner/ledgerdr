-- Ensure existing data is valid (update auto-set trigger uses '01'-'13' format)

ALTER TABLE transactions ADD CONSTRAINT chk_dgii_tipo_bienes_servicios
  CHECK (dgii_tipo_bienes_servicios IS NULL OR dgii_tipo_bienes_servicios IN (
    '01','02','03','04','05','06','07','08','09','10','11','12','13'
  ));

ALTER TABLE transactions ADD CONSTRAINT chk_dgii_tipo_ingreso
  CHECK (dgii_tipo_ingreso IS NULL OR dgii_tipo_ingreso IN (
    '01','02','03','04','05','06'
  ));

ALTER TABLE transactions ADD CONSTRAINT chk_dgii_tipo_anulacion
  CHECK (dgii_tipo_anulacion IS NULL OR dgii_tipo_anulacion IN (
    '01','02','03','04','05','06','07','08','09','10'
  ));