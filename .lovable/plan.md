
## Update Diesel Label from (L) to (gal)

### Change
Update the translation key `industrial.estimatedDiesel` in both i18n files to use `(gal)` instead of `(L)`:

**src/i18n/en.ts:**
- Change: `"industrial.estimatedDiesel": "Est. Diesel (L)"` → `"industrial.estimatedDiesel": "Est. Diesel (gal)"`

**src/i18n/es.ts:**
- Change: `"industrial.estimatedDiesel": "Diesel Est. (L)"` → `"industrial.estimatedDiesel": "Diesel Est. (gal)"`

### Impact
All Industrial sub-tabs (PlantHoursView, CarretasView, TrucksView) use this translation key for:
- Dialog form labels
- Table column headers
- PDF/Excel export headers

All will automatically show "(gal)" instead of "(L)" after the change.
