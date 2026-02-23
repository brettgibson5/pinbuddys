# PinBuddys

Physics-based turn-based multiplayer game. Roll balls across the arena to score on the opponent's half. Play online or pass-and-play locally.

## Monorepo structure

```
packages/
  shared/   — TypeScript types & physics constants (no runtime deps)
  server/   — Colyseus multiplayer server (Node.js + Matter.js)
  client/   — Phaser 3 game (Vite + TypeScript)
  mobile/   — Ionic Capacitor wrapper (Angular, for iOS/Android)
```

## Quick start

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)

### Install
```bash
pnpm install
```

### Run locally (web + server)
```bash
# Terminal 1 — game server
pnpm --filter @pinbuddys/server dev

# Terminal 2 — Phaser web client
pnpm --filter @pinbuddys/client dev
```

Open two browser tabs at http://localhost:3000 and join via "Play Online" to test two-player flow.

Colyseus admin monitor: http://localhost:2567/colyseus

### Firebase setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Authentication** (Anonymous + Google providers)
3. Enable **Firestore** in Native mode
4. Copy `packages/client/.env.example` → `packages/client/.env` and fill in the web SDK keys
5. Download a service account JSON for the server, base64-encode it:
   ```bash
   base64 -i service-account.json
   ```
   Paste the result into `packages/server/.env` as `FIREBASE_SERVICE_ACCOUNT`.

### Build for production
```bash
pnpm build
```

### Mobile (iOS / Android)
Requires macOS + Xcode for iOS, or Android Studio for Android.

```bash
# Build the web client first
pnpm --filter @pinbuddys/client build

# Then sync and open in native IDE
cd packages/mobile
npx cap sync
npx cap open ios      # or: npx cap open android
```

## Game rules
- Drag to aim, release to throw your ball onto the **opponent's half**
- Ball stays on opponent's half → **+1 point**
- Ball flies off the far edge → **opponent captures it** and gets a bonus throw
- First to **5 points** wins

## Tech stack
| Layer | Tech |
|---|---|
| Game engine | Phaser 3 + Matter.js |
| Multiplayer | Colyseus 0.15 |
| Server | Node.js + TypeScript |
| Mobile | Ionic 7 + Capacitor 6 |
| Auth / DB | Firebase (Auth + Firestore) |
| Build | pnpm workspaces + Turborepo + Vite |
