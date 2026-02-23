# Phase 1: Free Activities, Paths, New Buildings

## Analysis of Original Suncoast (2002) vs Current Implementation

### Key Differences (What makes original deeper with fewer clicks):
1. **Paths create spatial puzzle** — every placement has consequences through distance
2. **7 reputation components** — can't be universally good, must specialize  
3. **Staff salary sliders** — one simple decision cascades effects
4. **Beer type = strategy** — one dropdown changes resort character
5. **Free activities (sunbathe, swim, stroll)** — guests come for the beach, spend money on upsells
6. **Day/night cycle** — two economic modes per day

### Current state: 15 buildings, 5 needs, 1 reputation score, no paths, no free activities

---

## 1. Free Activities

### New Need Types
- `beach` — desire to sunbathe/swim, satisfied FREE by proximity to water
- `stroll` — desire to walk around, satisfied FREE by walking on paths

### How it Changes Economy
- Guests arrive primarily for the BEACH (not bars)
- Accommodation = anchor revenue
- Food/drink/entertainment = upsell margin
- Free activities keep guests happy without costing money → encourages longer stays

### Implementation
1. Add `beach` and `stroll` to `NeedType`
2. Water-adjacent sand tiles become "beach zones" (guests can sunbathe FREE)
3. Water tiles satisfy `swimming` (fun + relaxation, FREE)
4. Walking on paths satisfies `stroll` slowly (FREE)
5. Guest AI: when `beach` need is high, move to nearest beach tile (no building needed)
6. Guest AI: when no paid needs are urgent, guests "stroll" along paths

### Guest Logic
- `beach` need rises at moderate rate for all segments
- `family` and `couple` have highest beach desire
- Satisfying beach need: guest stands on sand next to water, beach drops by ~30
- Beach tiles have implicit capacity (max 2 guests per beach tile)

---

## 2. Path System

### Core Rules
- Path is a new tile type: `'path'`
- Paths cost $5 each to build (cheap but adds up)
- Resort entrance is at a fixed edge tile
- Buildings MUST be reachable via path from entrance
- Guests walk ONLY on paths (+ beach/water for free activities)
- Pathfinding: BFS from entrance to each building
- Guest chooses NEAREST building (by path distance) that satisfies need

### Building a Path
- New build mode: "Build Path" (like placing 1x1 tiles rapidly with drag)
- Can only place on owned `sand` tiles
- Auto-tiling: paths connect visually (corners, straights, crossings)

### Rendering
- Path tiles rendered as light gray/stone color with subtle texture
- Auto-tile based on neighbors (straight, corner, T-junction, crossroad)

### Pathfinding Algorithm
- BFS from entrance node
- Cache distance map, recalculate when paths/buildings change
- `getPathDistance(entrance, buildingId)` → number | null (null = unreachable)
- Guest picks building: sorted by (path distance + small random factor)

### Resort Entrance
- Fixed at grid edge (e.g., left side of initial owned land)
- Marked visually with a gate/archway
- All guests spawn here and depart from here

---

## 3. New Buildings (from Original Game)

### Tier 1 (Available from start)
| Building | Size | Cost | Maint | Category | Need | Notes |
|----------|------|------|-------|----------|------|-------|
| Beach Shower | 1x1 | $40 | 2 | infrastructure | hygiene | FREE, satisfies new `hygiene` need |
| Equipment Hire | 1x1 | $80 | 5 | entertainment | fun | Rents beach gear |
| Baywatch Tower | 1x1 | $100 | 6 | infrastructure | null | Lifeguard, boosts safety opinion |
| Ice Cream Stall | 1x1 | $45 | 3 | food_drink | hunger | Small cheap food |

### Tier 2 (Star 2+)
| Building | Size | Cost | Maint | Category | Need | Notes |
|----------|------|------|-------|----------|------|-------|
| Rep Office | 1x1 | $120 | 8 | infrastructure | null | Representatives boost happiness |
| Fast Food | 1x1 | $70 | 5 | food_drink | hunger | Quick, cheap food |

### Tier 3 (Star 3+)
| Building | Size | Cost | Maint | Category | Need | Notes |
|----------|------|------|-------|----------|------|-------|
| Handyman Shack | 1x1 | $110 | 5 | infrastructure | null | Auto-repairs damaged buildings |
| Windsurfing | 1x1 | $90 | 6 | entertainment | fun | Water sport, must be near water |
| Cocktail Bar | 1x1 | $130 | 10 | food_drink | thirst | Premium drinks |

### Tier 4 (Star 4+)
| Building | Size | Cost | Maint | Category | Need | Notes |
|----------|------|------|-------|----------|------|-------|
| Security Post | 1x1 | $150 | 8 | infrastructure | null | Prevents incidents, catches troublemakers |
| Souvenir Shop | 1x1 | $100 | 5 | food_drink | fun | Shopping, good revenue |
| First Aid | 1x1 | $90 | 5 | infrastructure | null | Treats injuries, boosts safety |
| Club | 2x1 | $250 | 18 | entertainment | fun | Nightlife, high capacity |

### Tier 5+ (Star 5)
| Building | Size | Cost | Maint | Category | Need | Notes |
|----------|------|------|-------|----------|------|-------|
| Stage | 2x1 | $200 | 12 | entertainment | fun | Live events, boosts social heat |
| Casino | 2x2 | $400 | 25 | entertainment | fun | High risk/reward income |
| Fun Pool | 2x2 | $350 | 20 | entertainment | fun | Water park with slides |
| Jacuzzi | 1x1 | $180 | 10 | entertainment | relaxation | VIP relaxation |

---

## Implementation Order

### Step 1: Free Activities (types + needs + guest AI)
- Add `beach` to NeedType
- Add beach zone detection (sand tiles adjacent to water)
- Modify guest activity to seek beach tiles when `beach` need high
- Beach satisfies fun + relaxation + beach need for FREE
- No income from beach visits

### Step 2: Path System (tiles + pathfinding + building)
- Add `'path'` to TileType
- Add path building mode (drag to paint paths)
- Add entrance marker
- Implement BFS pathfinding
- Modify guest movement to use paths
- Add path rendering with auto-tiling
- Buildings unreachable = no visitors (with warning)

### Step 3: New Buildings (definitions + offerings + unlocks)
- Add all new BuildingType values
- Define costs, capacities, offerings
- Add unlock requirements (star tier gating)
- Add to build menu with proper categorization
- Add building colors and labels for rendering
- Integrate with existing offering/package system

---

## Save Migration
- Version bump: 9 → 10
- Migrate existing saves: add path tiles, entrance position
- Existing guests get new need fields (beach: 0)
- Existing buildings keep working (paths auto-generated around them)
