

## Add CBS Prefix "15" for Oil and Grease

**What changes:** Update the Oil and Grease entry in the `accountCbsPairs` array in `src/pages/Reports.tsx` to include CBS prefix "15", matching the pattern already used by the other three categories.

**Technical detail:**
- In `src/pages/Reports.tsx`, locate the Oil and Grease entry in `accountCbsPairs` and change its `cbs` value from `""` to `"15"`.
- This will cause the existing OR filter logic to also capture any transaction whose `cbs_code` starts with "15", in addition to those with master accounts 4050/4060.

**Result — all four categories will be:**
- Agrochemicals: CBS "13" OR Account 4030
- Diesel: CBS "14" OR Account 4040
- Fertilizer: CBS "12" OR Accounts 4080/4082
- Oil and Grease: CBS "15" OR Accounts 4050/4060

