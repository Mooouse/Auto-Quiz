# AUTO QUIZ

This game uses the pinned game_platform snapshot in game_platform.zip. Run npm install and npm run setup before development. Read .platform/AGENTS.md and .platform/docs/platform-architecture.md. Do not change .platform/packages to implement game-specific features.

The owner's explicit brief takes precedence over the platform defaults:
- Real makes/models with explicit identities and transparent PNGs. The owner subsequently requested AI-generated starter artwork; keep its provenance explicit.
- Four single-player modes, three session formats. No fake players or leaderboards.
- Russian and English only in this release.
- Local persistence, a future SDK/network boundary; no online services yet.
- The bundled catalogue contains four AI-generated starter cars; see docs/STARTER-ASSETS.md. Test fixtures must never be included in the production catalogue.
- Never repeat question cars in a session. A finite catalogue ends marathon/time attack with an explicit exhausted message.

Required checks: npm test, npm run build, browser checks with separate test-only data. A code review by a second agent is required before handing off. A visual first-look reviewer should independently inspect the screenshots. Report missing live-data and portal QA honestly. Do not declare the project ready for public submission without portal QA.

Do not push generated .platform, node_modules, dist or QA outputs. Do not overwrite the owner's existing archive.
