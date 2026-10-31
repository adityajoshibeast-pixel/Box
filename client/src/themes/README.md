# Themes Backup & Configuration Guide

This project supports switching between themes:
1. **Pastel Modern Theme (Original)**: Soft lavender, mint, peach, and sky blue palette.
2. **Halloween Theme (Current)**: Atmospheric dark midnight theme featuring animated flying bats, floating glowing ghosts, flickering Jack-o'-lanterns, swaying spiders on cobwebs, witch flying across a harvest moon, and glowing spooky cards.

---

## Files Structure

- `client/src/themes/pastel.css`: Complete original Pastel theme stylesheet.
- `client/src/index.css.backup-pastel`: Exact full backup of original `index.css`.
- `client/src/themes/halloween.css`: Halloween theme stylesheet with all colors, glow effects, and spooky styles.
- `client/src/components/HalloweenDecorations.jsx`: Animated Halloween characters and atmospheric elements (bats, ghosts, pumpkins, cobwebs, moon, witch, mist).

---

## How to restore the Pastel Theme in the future (Future me kaise wapas layein):

Option 1 (Full Restore):
Simply copy `client/src/themes/pastel.css` (or `client/src/index.css.backup-pastel`) back over `client/src/index.css`:
```powershell
Copy-Item "client\src\themes\pastel.css" "client\src\index.css"
```
And in `client/src/App.jsx`, remove or disable `<HalloweenDecorations />`.

Option 2 (Dynamic Switcher):
The CSS is structured with clean class scoping (`.theme-halloween` or `.viewer-shell`), so you can toggle between themes easily.
