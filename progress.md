Original prompt: create a game of battleship. Make it 3d

- Initialized project scaffolding for a standalone browser game.
- Plan: implement a canvas-based 3D-styled Battleship with deterministic hooks (`render_game_to_text`, `advanceTime`) and test with Playwright client.

- Implemented first playable version with 3D-style board rendering, placement, battle turns, AI, HUD, and deterministic hooks.
- Adjusted 3D board positioning and responsive canvas sizing so both grids stay visible.
- Added Auto Place control (button + A key) and Enter-to-start for faster battle flow/testing.
- Added deterministic battle action: Space fires at a random untargeted enemy cell to support robust automation and keyboard play.
- Verified with Playwright client: auto-place -> battle start -> repeated space-fire updates shots, hit/miss cells, and AI responses.
- Screenshots confirm both 3D boards are visible and state markers render correctly during battle.
- TODO: If desired, tune camera/origin values for larger enemy board footprint on small screens.
