# Suncoast - Testing Guide

## 🧪 Manual Testing Checklist

### ✅ Acceptance Tests (Required)

#### Test 1: Place Rooms with Mouse Clicks
**Steps:**
1. Start game (`npm run dev`)
2. Click "🏠 Room ($50)" button
3. Move mouse over grid
4. Click on an empty tile

**Expected:**
- ✅ Room appears as blue rectangle
- ✅ Label shows "R" and building ID
- ✅ Money decreases by $50 (100 → 50)
- ✅ Success toast appears
- ✅ Build mode exits automatically

#### Test 2: Place Bars with Mouse Clicks
**Steps:**
1. Ensure you have $120
2. Click "🍹 Bar ($120)" button
3. Move mouse over grid
4. Click on empty tiles (needs 2 horizontal)

**Expected:**
- ✅ Bar appears as pink rectangle (2 tiles wide)
- ✅ Label shows "B" and building ID
- ✅ Money decreases by $120
- ✅ Success toast appears

#### Test 3: Money Decreases on Build
**Steps:**
1. Note current money (e.g., $100)
2. Build a room ($50)
3. Check money display

**Expected:**
- ✅ Money = previous - cost (100 - 50 = 50)
- ✅ HUD updates immediately

#### Test 4: Money Increases on Next Day
**Steps:**
1. Build 1 room (income: $10/day)
2. Build 1 bar (income: $25/day)
3. Note current money
4. Click "☀️ Next Day"

**Expected:**
- ✅ Day increases by 1
- ✅ Money increases by $35 (10 + 25)
- ✅ Income/Day shows $35
- ✅ Success toast appears

#### Test 5: Preview Turns Red on Invalid Placement
**Steps:**
1. Build a room at position (5, 5)
2. Enter build mode again
3. Hover over position (5, 5)

**Expected:**
- ✅ Preview shows red overlay
- ✅ Click does nothing
- ✅ Error toast: "Invalid placement!"

#### Test 6: Preview Turns Red on Insufficient Money
**Steps:**
1. Spend money until you have < $50
2. Click "🏠 Room ($50)" button
3. Hover over empty tile

**Expected:**
- ✅ Preview shows red overlay
- ✅ Click shows error toast: "Not enough money!"

#### Test 7: State Persists on Refresh
**Steps:**
1. Build 2-3 buildings
2. Note day, money, building positions
3. Refresh page (F5)

**Expected:**
- ✅ All buildings restored
- ✅ Day and money unchanged
- ✅ Welcome back toast appears

#### Test 8: Reset Save Clears State
**Steps:**
1. Build some buildings
2. Click "🔄 Reset" button
3. Confirm dialog

**Expected:**
- ✅ Confirmation dialog appears
- ✅ After confirm: Day = 1, Money = 100
- ✅ All buildings cleared
- ✅ Grid is empty
- ✅ Success toast appears

---

## 🔍 Detailed Feature Tests

### Building Placement Tests

#### Test: Room Placement (1x1)
- [ ] Can place room on empty tile
- [ ] Cannot place room on occupied tile
- [ ] Cannot place room out of bounds (x < 0)
- [ ] Cannot place room out of bounds (x >= 20)
- [ ] Cannot place room out of bounds (y < 0)
- [ ] Cannot place room out of bounds (y >= 12)
- [ ] Room occupies exactly 1 tile

#### Test: Bar Placement (2x1)
- [ ] Can place bar on 2 empty horizontal tiles
- [ ] Cannot place bar if right tile is occupied
- [ ] Cannot place bar if left tile is occupied
- [ ] Cannot place bar at x=19 (would go out of bounds)
- [ ] Bar occupies exactly 2 tiles
- [ ] Bar is drawn horizontally (not vertically)

#### Test: Placement Validation
- [ ] Green preview on valid placement
- [ ] Red preview on invalid placement
- [ ] Red preview when insufficient money
- [ ] Preview follows mouse cursor
- [ ] Preview disappears on mouse leave
- [ ] Preview updates when money changes

### UI Interaction Tests

#### Test: Build Mode
- [ ] Click "Room" → button shows active state
- [ ] Click "Bar" → button shows active state
- [ ] Click "Cancel" → build mode exits
- [ ] Successful placement → build mode exits
- [ ] Only one button active at a time
- [ ] Cancel button disabled when not in build mode

#### Test: HUD Updates
- [ ] Day display updates on next day
- [ ] Money display updates on build
- [ ] Money display updates on next day
- [ ] Income/Day shows sum of all buildings
- [ ] Income/Day = 0 when no buildings
- [ ] All displays update in real-time

#### Test: Toast Notifications
- [ ] Success toast on building placed
- [ ] Error toast on invalid placement
- [ ] Error toast on insufficient money
- [ ] Success toast on next day
- [ ] Success toast on reset
- [ ] Welcome toast on load
- [ ] Toast auto-dismisses after 3 seconds
- [ ] New toast replaces old toast

### Economic System Tests

#### Test: Income Calculation
- [ ] 0 buildings → $0 income
- [ ] 1 room → $10 income
- [ ] 1 bar → $25 income
- [ ] 2 rooms → $20 income
- [ ] 1 room + 1 bar → $35 income
- [ ] 10 rooms → $100 income

#### Test: Cost Deduction
- [ ] Room costs exactly $50
- [ ] Bar costs exactly $120
- [ ] Money deducted immediately on placement
- [ ] Cannot build if money < cost
- [ ] Can build if money = cost exactly

#### Test: Day Progression
- [ ] Day starts at 1
- [ ] Day increments by 1 each time
- [ ] Income collected on each day advance
- [ ] Can advance day with $0
- [ ] Can advance day multiple times

### Save/Load Tests

#### Test: Auto-Save
- [ ] Game saves every 2 seconds
- [ ] Game saves after building placement
- [ ] Game saves after next day
- [ ] No errors in console during save
- [ ] localStorage contains valid JSON

#### Test: Load on Startup
- [ ] Existing save loads automatically
- [ ] No save → starts new game
- [ ] Corrupted save → starts new game (no crash)
- [ ] All state properties restored correctly

#### Test: Reset Functionality
- [ ] Reset requires confirmation
- [ ] Cancel confirmation → no reset
- [ ] Confirm → state resets to initial
- [ ] localStorage cleared after reset
- [ ] Can build after reset

### Rendering Tests

#### Test: Grid Rendering
- [ ] 20 vertical lines drawn
- [ ] 12 horizontal lines drawn
- [ ] Grid lines are gold color
- [ ] Background is sand color
- [ ] Grid covers entire canvas

#### Test: Building Rendering
- [ ] Rooms are blue
- [ ] Bars are pink
- [ ] Buildings have borders
- [ ] Labels show correct letter (R/B)
- [ ] IDs are unique and sequential
- [ ] Buildings don't overlap grid lines

#### Test: Preview Rendering
- [ ] Hover shows white highlight
- [ ] Valid preview is green
- [ ] Invalid preview is red
- [ ] Preview has border
- [ ] Preview size matches building size
- [ ] Preview clears on mouse leave

### Edge Case Tests

#### Test: Boundary Conditions
- [ ] Can place at (0, 0)
- [ ] Can place at (19, 11)
- [ ] Cannot place at (-1, 0)
- [ ] Cannot place at (20, 0)
- [ ] Cannot place at (0, 12)
- [ ] Bar cannot place at (19, 0) - would overflow

#### Test: Money Edge Cases
- [ ] Can build with exactly enough money
- [ ] Cannot build with $1 less than cost
- [ ] Money can reach $0
- [ ] Money can be negative? (No - validation prevents)
- [ ] Very large money values (10000+)

#### Test: Building Limits
- [ ] Can place 240 buildings (fill entire grid)
- [ ] Building IDs increment correctly
- [ ] No duplicate building IDs
- [ ] All buildings render when grid is full

---

## 🐛 Bug Testing Scenarios

### Scenario 1: Rapid Clicking
**Steps:**
1. Enter build mode
2. Click same tile 10 times rapidly

**Expected:**
- ✅ Only 1 building placed
- ✅ Money deducted once
- ✅ No duplicate buildings

### Scenario 2: Mode Switching
**Steps:**
1. Click "Room" button
2. Click "Bar" button (without placing)
3. Place building

**Expected:**
- ✅ Bar is placed (not room)
- ✅ Correct cost deducted ($120)

### Scenario 3: Cancel During Hover
**Steps:**
1. Enter build mode
2. Hover over tile (preview shows)
3. Click "Cancel"

**Expected:**
- ✅ Preview disappears
- ✅ Build mode exits
- ✅ Click on grid does nothing

### Scenario 4: Multiple Refreshes
**Steps:**
1. Build buildings
2. Refresh page
3. Build more buildings
4. Refresh page again

**Expected:**
- ✅ All buildings persist
- ✅ Building IDs don't conflict
- ✅ No duplicates

### Scenario 5: localStorage Full
**Steps:**
1. Fill localStorage with other data
2. Try to save game

**Expected:**
- ✅ Error logged to console
- ✅ Game continues to work
- ✅ No crash

---

## 📊 Performance Tests

### Test: Frame Rate
**Steps:**
1. Open DevTools → Performance
2. Start recording
3. Move mouse around grid
4. Place several buildings
5. Stop recording

**Expected:**
- ✅ 60 FPS maintained
- ✅ No frame drops
- ✅ Smooth animations

### Test: Memory Usage
**Steps:**
1. Open DevTools → Memory
2. Take heap snapshot
3. Play game for 5 minutes
4. Take another snapshot

**Expected:**
- ✅ No memory leaks
- ✅ Stable memory usage
- ✅ No growing arrays

### Test: Load Time
**Steps:**
1. Clear cache
2. Reload page
3. Measure time to interactive

**Expected:**
- ✅ < 1 second load time
- ✅ Game immediately playable
- ✅ No loading screens needed

---

## 🔧 Browser Compatibility

### Test in Multiple Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (latest)

### Features to Verify
- [ ] Canvas rendering works
- [ ] localStorage works
- [ ] Mouse events work
- [ ] Buttons work
- [ ] Styles render correctly

---

## ✅ Test Results Template

```
Date: ___________
Tester: ___________
Browser: ___________
OS: ___________

Acceptance Tests: ___/8 passed
Feature Tests: ___/___ passed
Edge Cases: ___/___ passed
Bug Scenarios: ___/5 passed
Performance: ___/3 passed
Browser Compat: ___/4 passed

Overall Status: PASS / FAIL

Notes:
_________________________________
_________________________________
_________________________________
```

---

## 🎯 Automated Testing (Future)

### Unit Tests (Recommended)
```typescript
// Example test structure
describe('reducer', () => {
  it('should place building and deduct money', () => {
    const state = { ...initialState, money: 100 };
    const action = placeBuilding('room', 0, 0);
    const newState = reducer(state, action);
    
    expect(newState.money).toBe(50);
    expect(newState.buildings.length).toBe(1);
  });
});
```

### Integration Tests
- Test Store + Reducer
- Test UIManager + Store
- Test SaveSystem + localStorage

### E2E Tests
- Use Playwright or Cypress
- Automate acceptance tests
- Run on CI/CD

---

**All acceptance tests must pass before release! ✅**



