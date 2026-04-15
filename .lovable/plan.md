

## Register Nomina 95 Correction Transactions

### What we'll do
Insert 12 transactions (one per underpaid employee, excluding Oscar Junior Roso) into the `transactions` table with:
- **Description**: "Nomina 95 Corrección"
- **Date**: 2026-04-15 (same as Nomina 95)
- **Account**: 7010 (Payroll), account_id `52ed233c-893a-407a-ab08-eb8caa851abd`
- **Entity**: `30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf`
- **Currency**: DOP, Pay method: Transfer BHD, Cost center: general
- **Direction**: purchase

### Transactions to insert

| Employee | Amount (DOP) |
|----------|-------------|
| Edwin Viscaino | 977.95 |
| Edy Rodriguez | 634.15 |
| Eladio Rodriguez | 110.22 |
| Enrique Jiminez Guzmán | 104.50 |
| Jose Alberto Rosario Rosario | 110.22 |
| Jose Luis Cespedes | 831.45 |
| Juan Ventura Castro | 125.66 |
| Luis Miguel Avelino | 1,034.48 |
| Reynaldo Cedeno | 1,132.21 |
| Rolando Coca | 2,023.71 |
| Virgilio Lopez | 286.58 |
| Yack Maikol Frias | 330.67 |
| **Total** | **7,701.80** |

Oscar Junior Roso is excluded per your instruction (his difference was -$14.40).

### Technical detail
- Single batch of 12 `INSERT` statements using the Supabase insert tool
- Same account (7010), entity, currency, and pay method as the original Nomina 95 transactions
- No schema changes required

