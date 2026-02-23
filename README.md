# Suncoast - Tycoon Game

A minimal but complete tycoon game built with TypeScript, Vite, and HTML Canvas 2D.

## Features

- 🏖️ Build a beach resort with Rooms and Bars
- 💰 Manage your money and daily income
- 📅 Progress through days to earn revenue
- 💾 Auto-save with localStorage
- 🎮 Clean, playable game loop

## Quick Start

```bash
npm install
npm run dev
```

Then open your browser to `http://localhost:3000`

## How to Play

1. **Build Structures**: Click "Room" or "Bar" buttons to enter build mode
2. **Place Buildings**: Click on the grid to place your building
   - Rooms (1x1): Cost $50, Income $10/day
   - Bars (2x1): Cost $120, Income $25/day
3. **Advance Time**: Click "Next Day" to collect daily income
4. **Expand**: Use your earnings to build more structures!

### Controls

- 🏠 **Room Button**: Enter room placement mode ($50)
- 🍹 **Bar Button**: Enter bar placement mode ($120)
- ❌ **Cancel**: Exit build mode
- ☀️ **Next Day**: Advance one day and collect income
- 🔄 **Reset**: Clear save and start over

### Game Rules

- Buildings must be placed on empty tiles
- Buildings cannot overlap
- You must have enough money to build
- Preview shows green (valid) or red (invalid) placement
- Game auto-saves every 2 seconds
- Progress persists on page refresh

## Architecture Overview

The codebase follows a clean, layered architecture:

### Core Layer (`src/core/`)
- **Store**: Redux-like state container with `getState()`, `dispatch()`, `subscribe()`
- **GameLoop**: RequestAnimationFrame-based game loop

### State Layer (`src/state/`)
- **types.ts**: TypeScript interfaces for all game state
- **initialState.ts**: Default game state
- **actions.ts**: Action creators
- **reducer.ts**: Pure state reducer function
- **selectors.ts**: State query functions (income, costs, etc.)

### World Layer (`src/world/`)
- **Grid.ts**: Grid utilities (bounds checking, tile queries)
- **Placement.ts**: Building placement validation logic

### Systems Layer (`src/systems/`)
- **EconomySystem**: Handles day progression and income
- **SaveSystem**: localStorage persistence with auto-save

### Render Layer (`src/render/`)
- **Renderer.ts**: Canvas 2D rendering (draws from state only)
  - Grid lines
  - Buildings with labels
  - Hover preview (green/red)

### UI Layer (`src/ui/`)
- **UIManager.ts**: DOM bindings, event handlers
  - Buttons dispatch actions
  - HUD displays current state
  - Toast notifications

### Entry Point
- **main.ts**: Initializes all systems and starts game loop

### Data Flow

```
User Input (UI) → Action → Store.dispatch() → Reducer → New State
                                                           ↓
                                        Store.subscribe() → Renderer + UIManager
```

All state changes flow through the reducer (pure function). Systems and UI only read state and dispatch actions.

## Project Structure

```
BeachLife/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── README.md
└── src/
    ├── main.ts
    ├── core/
    │   ├── GameLoop.ts
    │   └── Store.ts
    ├── state/
    │   ├── types.ts
    │   ├── initialState.ts
    │   ├── actions.ts
    │   ├── reducer.ts
    │   └── selectors.ts
    ├── world/
    │   ├── Grid.ts
    │   └── Placement.ts
    ├── systems/
    │   ├── EconomySystem.ts
    │   └── SaveSystem.ts
    ├── render/
    │   └── Renderer.ts
    └── ui/
        └── UIManager.ts
```

## Tech Stack

- **TypeScript**: Type-safe game logic
- **Vite**: Fast dev server and build tool
- **Canvas 2D**: Rendering (no game engines)
- **localStorage**: Save/load persistence
- **Vanilla DOM**: UI controls (no frameworks)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Future Enhancements

Possible additions (not implemented in MVP):

- More building types (Restaurant, Pool, Hotel)
- Tourists/visitors that generate income
- Upgrades and building levels
- Random events (storms, festivals)
- Staff management
- Seasonal effects
- Campaign/scenario mode

## License

MIT



