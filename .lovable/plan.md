

## Link Existing Closed Service to Its Transaction

### What
Update the single closed service entry to reference its matching transaction, so the transaction number (299) displays in the "Mostrar Cerrados" view.

### How
Run a single data UPDATE using the insert tool:

```sql
UPDATE service_entries 
SET transaction_id = '124be4eb-4664-450d-8bb1-0567b7bb2678'
WHERE id = '09ebcb03-5f2d-44ab-bdb3-de0fd6c13bff';
```

This links Juan Williams Corrales' closed service (2026-03-06, $10,000) to transaction #299 (document "Recibo"). No code or schema changes needed.

