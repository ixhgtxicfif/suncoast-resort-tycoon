# Suncoast - Quick Start Guide

## 🚀 Get Started in 30 Seconds

```bash
npm install
npm run dev
```

Open browser to: **http://localhost:3000**

## 🎮 How to Play

1. **Build Room** → Click grid → Room placed ($50)
2. **Build Bar** → Click grid → Bar placed ($120)
3. **Next Day** → Collect income from all buildings
4. **Repeat** → Build more, earn more!

## 🏗️ Buildings Quick Reference

| Building | Size | Cost | Income |
|----------|------|------|--------|
| 🏠 Room  | 1×1  | $50  | $10/day |
| 🍹 Bar   | 2×1  | $120 | $25/day |

## 🎯 Tips

- Start with Rooms (cheaper)
- Save up for Bars (better income)
- Green preview = valid placement
- Red preview = invalid/no money
- Auto-saves every 2 seconds

## 🔧 Commands

```bash
npm install    # Install dependencies
npm run dev    # Start game (port 3000)
npm run build  # Build for production
```

## 📂 Key Files

- `src/main.ts` - Entry point
- `src/state/` - Game state management
- `src/render/Renderer.ts` - Canvas drawing
- `src/ui/UIManager.ts` - Button controls
- `index.html` - UI layout & styles

## 🐛 Troubleshooting

**Game won't start?**
- Run `npm install` first
- Check Node.js is installed
- Try port 3000 in browser

**Can't place buildings?**
- Check you have enough money
- Check tiles are empty
- Bar needs 2 horizontal tiles

**Save not working?**
- Enable localStorage in browser
- Check browser console for errors

## 📚 More Info

- **README.md** - Full architecture overview
- **GAME_GUIDE.md** - Detailed gameplay guide
- **PROJECT_SUMMARY.md** - Complete project details

---

**Have fun building your beach resort! 🏖️**



