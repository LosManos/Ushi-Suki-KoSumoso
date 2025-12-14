---
description: How to implement keyboard shortcuts correctly on Mac
---

# Keyboard Shortcuts on Mac

## The Problem with Alt (Option) Key

On Mac, when you press **Alt (Option) + a letter key**, the operating system produces special characters instead of the expected letter. For example:
- `Alt + C` → `ç`
- `Alt + S` → `ß`
- `Alt + A` → `å`

This means that checking `e.key.toLowerCase() === 'c'` will **NOT** work when Alt is held, because `e.key` will contain the special character (`ç`) instead of `c`.

## The Solution: Use `e.code`

Always use `e.code` instead of `e.key` when implementing shortcuts that involve the **Alt/Option key**.

The `e.code` property returns the **physical key** pressed (like `"KeyC"`, `"KeyS"`, `"KeyA"`) regardless of any modifier-induced character transformations.

### ❌ Incorrect (won't work on Mac with Alt key)
```typescript
if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'c') {
  // This won't trigger on Mac because e.key will be 'ç', not 'c'
}
```

### ✅ Correct (works on Mac)
```typescript
// On Mac, Alt (Option) produces special characters in e.key (e.g. ç for c),
// so we use e.code (e.g. KeyC) to reliably detect the physical key pressed.
if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyC') {
  // This works because e.code is always 'KeyC' regardless of modifiers
}
```

## Common e.code Values

| Physical Key | e.code Value |
|--------------|--------------|
| A | `KeyA` |
| B | `KeyB` |
| C | `KeyC` |
| ... | ... |
| Z | `KeyZ` |
| 1 | `Digit1` |
| 2 | `Digit2` |
| Enter | `Enter` |
| Space | `Space` |
| Escape | `Escape` |

## When to Use Which

- **`e.key`**: Safe for shortcuts that only use `Cmd/Ctrl` and/or `Shift` (no Alt)
- **`e.code`**: Required for any shortcut involving the **Alt/Option key**

## Existing Example in Codebase

See `ConnectionForm.tsx` for a reference implementation:
```typescript
// Custom shortcuts (Windows-style Alt keys)
// On Mac, Alt (Option) often produces special characters in e.key (e.g. ß for s),
// so we must use e.code (e.g. KeyS) to reliably detect the intended key.
if (e.altKey && !e.ctrlKey && !e.metaKey) {
    switch (e.code) {
        case 'KeyS': { ... }
        case 'KeyC': { ... }
    }
}
```
