# Volute

Volute is a browser arcade puzzle set in a geothermal pump hall. Mineral cores wind along a fixed channel toward the intake. Aim the injector, fire a matching charge into the train, and extract runs of three or more before they reach the maw. Consecutive merge extractions raise the score multiplier. Marked cores grant temporary machinery: choke, backflow, bore, or sightline. Clear the five delivery quotas while protecting your three cells.

The game uses the Simple 2D engine for its frame loop, input, audio, canvas fit, and debug overlay. It runs without a backend or network requests beyond its own static files. Its PNG sprites, animation frames, particle system files, and WAV cues are committed under `public/assets/` and copied into the build. The asset authoring source is `tools/generate-assets.mjs`; building the game never runs it.

## Run it

```sh
npm ci
npm run dev
```

Open the URL Vite prints. To build a static release:

```sh
npm run build
npm run preview
```

`dist/` is the complete site. Serve it from a static host at the root or under a sub-path. No additional asset step is needed.

## Controls

| Control                       | Action                             |
| ----------------------------- | ---------------------------------- |
| Mouse, pen, or touch position | Aim the injector                   |
| A / D or left / right arrows  | Turn the injector                  |
| Space or a pointer press      | Fire                               |
| X                             | Swap the loaded and queued charges |
| Enter or a pointer press      | Start a run or dismiss an ending   |
| Escape or P                   | Pause or resume                    |
| M                             | Mute or unmute                     |
| Backtick                      | Toggle the engine debug overlay    |

The injector reloads immediately after firing, but has a short cooldown. A shot that touches a core seats beside it according to the approach direction. Three matching adjacent cores extract; a merge can trigger another extraction and extend the chain.

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The tests exercise the fixed-tick simulation, including emission, projectile seating and extraction, backflow, cell loss, level restart, and debug poses.
