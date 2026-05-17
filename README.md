# Dungeon Crawler

A timed, grid-based dungeon crawler built with vanilla HTML, CSS, and JavaScript. Navigate procedurally generated dungeons with an on-screen D-pad, grab valuables, and find the exit before time runs out — across 10 levels of increasing difficulty.

**Live demo:** [rperry1904.github.io/dungeon-crawler](https://rperry1904.github.io/dungeon-crawler/)

---

## Table of Contents

- [Features](#features)
- [How to Play](#how-to-play)
- [Controls](#controls)
- [Scoring](#scoring)
- [Difficulty Curve](#difficulty-curve)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **10 procedurally generated levels** with randomized grid sizes (8×8 up to 19×19) and increasing wall density.
- **Solvability guaranteed** — every dungeon is validated with a breadth-first reachability check before being served, so the exit and every gem are always reachable from the player's starting tile.
- **Fog of war** with a sight radius that shrinks as you descend — your torch gets dimmer on later levels, so dead ends and hidden walls force real exploration and backtracking. Explored tiles stay dimly visible so you can remember the layout.
- **On-screen D-pad** with press-and-hold repeat, plus full keyboard support (Arrow keys / WASD).
- **Mobile-first responsive layout** with touch-friendly controls, safe-area insets for notched devices, and adaptive sizing for short viewports.
- **Score system** that rewards both speed and thoroughness — collect gems for points, but exit early for a time bonus.
- **Retro pixel aesthetic** using emoji tiles and CSS-only effects (no image assets, no build step).
- **Zero dependencies, zero build tooling** — just three static files served directly from GitHub Pages.

## How to Play

You're a wizard (🧙) dropped into a randomly generated dungeon. Your goal:

1. Move through the open tiles to collect as many gems (💎) as possible.
2. Find the exit door (🚪) to clear the level.
3. Beat all 10 levels before the timer runs out on any one of them.

You don't have to collect every gem — you can race straight to the exit for a higher time bonus, or sweep the dungeon for the full gem haul. It's your call.

## Controls

| Action     | Touch / Click | Keyboard           |
|------------|---------------|--------------------|
| Move up    | ▲ on D-pad    | `↑` or `W`         |
| Move down  | ▼ on D-pad    | `↓` or `S`         |
| Move left  | ◀ on D-pad    | `←` or `A`         |
| Move right | ▶ on D-pad    | `→` or `D`         |

Hold a D-pad direction to repeat-move.

## Scoring

| Event              | Points                     |
|--------------------|----------------------------|
| Gem collected      | +10                        |
| Level cleared      | +50                        |
| Time remaining     | +2 per second left on exit |

## Difficulty Curve

| Level | Grid size (random) | Time limit | Target gems | Wall density | Sight radius |
|------:|--------------------|-----------:|------------:|-------------:|-------------:|
| 1     | 8–9                | 45s        | 4           | 0.22         | 3 (7×7)      |
| 2     | 9–10               | 50s        | 5           | 0.24         | 3 (7×7)      |
| 3     | 10–11              | 55s        | 6           | 0.26         | 3 (7×7)      |
| 4     | 11–12              | 60s        | 7           | 0.28         | 2 (5×5)      |
| 5     | 12–13              | 65s        | 8           | 0.30         | 2 (5×5)      |
| 6     | 13–14              | 70s        | 9           | 0.32         | 2 (5×5)      |
| 7     | 14–15              | 75s        | 10          | 0.34         | 2 (5×5)      |
| 8     | 15–16              | 80s        | 11          | 0.36         | 1 (3×3)      |
| 9     | 16–17              | 85s        | 12          | 0.38         | 1 (3×3)      |
| 10    | 17–19              | 90s        | 15          | 0.40         | 1 (3×3)      |

Sight radius is the Chebyshev distance you can see in any direction from your current tile. Beyond that, tiles you've already visited remain dimly visible (so you can remember the layout); tiles you've never seen are pitch black.

## Tech Stack

- **HTML5** — semantic markup, CSS Grid for the dungeon board.
- **CSS3** — custom properties, `aspect-ratio`, gradients, and CSS animations. No frameworks.
- **JavaScript (ES2015+)** — single-file IIFE, no bundler, no dependencies.

## Project Structure

```
dungeon-crawler/
├── index.html      # App shell, HUD, board container, D-pad, overlay
├── style.css       # Layout, retro tile theme, responsive tweaks
├── game.js         # Game loop, dungeon generator, input, scoring
└── README.md
```

## Running Locally

Because this is a static, dependency-free project, the easiest way to play is to just open `index.html` in your browser. For a closer-to-production experience (and to avoid any browser quirks with `file://` URLs), serve the folder with a tiny static server:

```bash
# Using Python (already installed on macOS / most Linux distros)
python3 -m http.server 8080

# Or using Node
npx serve .
```

Then open <http://localhost:8080> in your browser.

## Deployment

This project is deployed to GitHub Pages directly from the `main` branch root — no build step required.

To deploy your own copy:

1. Push the three source files to the root of a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Set **Branch** to `main` and folder to `/ (root)`, then click **Save**.
5. After ~30–60 seconds, your game is live at `https://<your-username>.github.io/<your-repo>/`.

Every subsequent push to `main` will redeploy automatically.

## Roadmap

Ideas for future versions:

- High-score persistence with `localStorage`.
- Sound effects and background music (with a mute toggle).
- Additional tile types: traps, locked doors, keys, monsters, power-ups.
- Seeded levels and shareable "daily dungeon" challenges.
- Accessibility pass — focus-visible styles, screen-reader announcements for movement and pickups.
- A level editor that exports JSON.

## Contributing

Contributions are welcome. If you'd like to propose a change:

1. Fork the repository and create a feature branch (`git checkout -b feature/short-name`).
2. Make your changes — keep the zero-dependency, single-bundle constraint in mind.
3. Test the game manually across desktop and mobile viewports.
4. Open a pull request describing what you changed and why.

For larger ideas (new mechanics, art overhaul, etc.), please open an issue first to discuss the direction.

## License

Released under the [MIT License](LICENSE). You're free to fork, modify, and use this code in your own projects.
