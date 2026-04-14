

## Remove Number Input Spinners from Budget Grid

### Problem
All `type="number"` inputs in the Budget grid show browser-native increment/decrement arrows (spinners). These are unnecessary for financial data entry and add visual clutter.

### Solution
Add CSS rules to `src/index.css` to hide the number input spinners globally (or scoped to the budget grid). This is a tiny CSS-only change — no component logic changes needed.

### Changes

**`src/index.css`** — Add these rules to hide number input spinners across all browsers:
```css
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

This removes the arrows globally, which is appropriate since the app is a financial/ERP tool where spinner arrows are generally unwanted. Single file, ~8 lines of CSS.

