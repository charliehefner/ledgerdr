

## Fix: Account selection drifts when switching tabs

**Root cause**: `useState` initializer runs only once on component mount. When you switch from P&L to a project tab, `hiddenStorageKey` changes (e.g. `budget-hidden-accounts-pl-2025` → `budget-hidden-accounts-project-2025`), but the `hiddenCodes` state retains the old tab's value. Then the `useEffect` writes that stale value to the new key, corrupting saved selections.

**Fix in `src/components/budget/BudgetGrid.tsx`** (lines 111–121):

Add a `useEffect` that re-reads `hiddenCodes` from localStorage whenever `hiddenStorageKey` changes:

```typescript
const hiddenStorageKey = `budget-hidden-accounts-${budgetType}-${fiscalYear}`;
const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(() => {
  try {
    const saved = localStorage.getItem(hiddenStorageKey);
    return saved ? new Set(JSON.parse(saved)) : new Set<string>();
  } catch { return new Set<string>(); }
});

// Re-read when key changes (tab switch or year change)
useEffect(() => {
  try {
    const saved = localStorage.getItem(hiddenStorageKey);
    setHiddenCodes(saved ? new Set(JSON.parse(saved)) : new Set<string>());
  } catch { setHiddenCodes(new Set<string>()); }
}, [hiddenStorageKey]);

// Persist — use a ref to avoid writing on key-change reads
const isKeyChange = useRef(false);
useEffect(() => {
  if (isKeyChange.current) { isKeyChange.current = false; return; }
  localStorage.setItem(hiddenStorageKey, JSON.stringify(Array.from(hiddenCodes)));
}, [hiddenCodes, hiddenStorageKey]);
```

Simpler alternative: skip the ref guard and just let the write effect run (it'll write the same data it just read — harmless). The key fix is the re-read effect.

