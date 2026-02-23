# Suncoast - Game Guide

## 🎮 Gameplay Overview

Suncoast is a simple tycoon game where you build and manage a beach resort. Your goal is to place buildings strategically to maximize daily income and grow your business.

## 🏗️ Buildings

### Room (🏠)
- **Size**: 1x1 tile
- **Cost**: $50
- **Income**: $10 per day
- **Best for**: Early game, filling small spaces

### Bar (🍹)
- **Size**: 2x1 tiles (horizontal)
- **Cost**: $120
- **Income**: $25 per day
- **Best for**: Better income-to-cost ratio

## 📊 Game Mechanics

### Starting Resources
- **Day**: 1
- **Money**: $100
- **Grid**: 20x12 tiles of sandy beach

### Building Process
1. Click a building button (Room or Bar)
2. Your cursor enters "build mode"
3. Hover over the grid to see placement preview
   - **Green preview**: Valid placement
   - **Red preview**: Invalid (blocked or insufficient funds)
4. Click to place the building
5. Money is deducted immediately
6. Building starts generating income

### Advancing Time
- Click "Next Day" button
- Day counter increases by 1
- All building income is collected instantly
- Money increases by total daily income

### Placement Rules
✅ **Valid Placement**
- All tiles must be within grid bounds
- All tiles must be empty (sand)
- You must have enough money

❌ **Invalid Placement**
- Overlapping existing buildings
- Out of grid bounds
- Insufficient money

## 💡 Strategy Tips

1. **Start with Rooms**: At $50 each, rooms are affordable early game
2. **Save for Bars**: Bars cost $120 but earn $25/day (better ROI)
3. **Plan Ahead**: Leave space for 2-wide bars
4. **Income Compounds**: More buildings = more income = faster growth

### Example Strategy
- Day 1: Build 1 Room ($50) → $50 remaining
- Day 2: Collect $10 → Build 1 Room ($50) → $10 remaining
- Day 3: Collect $20 → $30 total
- Day 4: Collect $20 → $50 total → Build 1 Room
- Continue until you can afford Bars!

## 🎨 Visual Guide

### Grid Display
- **Yellow/Sand**: Empty buildable tiles
- **Gold Lines**: Grid boundaries
- **Blue Rectangles**: Rooms (marked with "R" + ID)
- **Pink Rectangles**: Bars (marked with "B" + ID)
- **White Highlight**: Hovered tile
- **Green Overlay**: Valid build preview
- **Red Overlay**: Invalid build preview

### HUD (Top Bar)
- **Day**: Current day number
- **Money**: Current cash balance
- **Income/Day**: Total daily income from all buildings

### Controls
- **🏠 Room ($50)**: Enter room placement mode
- **🍹 Bar ($120)**: Enter bar placement mode
- **❌ Cancel**: Exit build mode
- **☀️ Next Day**: Advance time and collect income
- **🔄 Reset**: Clear save and restart (with confirmation)

## 💾 Save System

### Auto-Save
- Game automatically saves every 2 seconds
- Also saves after building placement
- Also saves after advancing day

### Persistence
- Refresh the page → your progress is restored
- Close browser → your progress is saved
- Uses browser localStorage (no server needed)

### Reset Save
- Click "Reset" button
- Confirm the dialog
- All progress is cleared
- Game restarts from Day 1 with $100

## 🎯 Acceptance Tests

### Test 1: Basic Building
1. Start game
2. Click "Room" button
3. Click on grid
4. ✅ Room appears, money decreases by $50

### Test 2: Income Generation
1. Build a room
2. Click "Next Day"
3. ✅ Day increases, money increases by $10

### Test 3: Invalid Placement
1. Build a room at (0,0)
2. Try to build another room at (0,0)
3. ✅ Preview shows red, click does nothing, error toast appears

### Test 4: Insufficient Funds
1. Spend all money
2. Try to build something
3. ✅ Preview shows red, error toast: "Not enough money!"

### Test 5: Bar Placement
1. Save $120
2. Click "Bar" button
3. Place on grid
4. ✅ Bar occupies 2 horizontal tiles

### Test 6: Save Persistence
1. Build some buildings
2. Refresh page
3. ✅ All buildings and progress restored

### Test 7: Reset
1. Click "Reset" button
2. Confirm dialog
3. ✅ Game resets to initial state

## 🐛 Troubleshooting

**Q: Preview is always red?**
- Check if you have enough money
- Check if tiles are empty
- Make sure bar has 2 horizontal tiles available

**Q: Save not working?**
- Check browser localStorage is enabled
- Try different browser if issues persist

**Q: Game not loading?**
- Check browser console for errors
- Ensure JavaScript is enabled
- Try clearing browser cache

## 🚀 Future Ideas

This MVP could be extended with:
- More building types (Restaurant, Pool, Hotel)
- Building upgrades
- Tourists/visitors system
- Random events
- Seasonal effects
- Staff management
- Achievements
- Multiple save slots

---

**Enjoy building your beach resort! 🏖️**



