# 百世问鼎 · 动态武侠首页

## Intent

Upgrade the existing game homepage into an original cinematic wuxia title screen. The user asks for a striking dynamic experience with the visual ambition of a AAA wuxia game. Keep the primary experience an immediately usable game menu.

## Direction and approach

Use an original panoramic mountain-and-cloud scene with a solitary swordsman, warm backlight, cool jade shadows, large brush lettering, and restrained gold accents. Place the three established game actions directly on the landscape. On mobile, compose the landscape above and behind a readable lower menu.

Considered approaches: full real-time 3D would add substantial assets, loading, and device requirements; a background video would consume the existing release budget and offer little interaction. Selected by implementation judgment: compressed original artwork plus lightweight native WebGL fog, canvas particles, subtle pointer parallax and CSS lighting. This fits the existing dependency-free browser and self-contained release pipeline.

## Constraints

- Preserve “踏入仙途 / 续写此生 / 游戏设置”, their data attributes, disabled states, saved journey summaries, errors and “切换存档”. Preserve the accessible heading “百世问鼎” and `main#main-content`.
- Preserve save formats, all game engines, AI behavior, pricing controls, navigation and reading preferences. Home visits never create a story turn.
- The deployed gateway serves a self-contained HTML release; CSS local asset URLs must be embedded and the final HTML must remain below 3,000,000 bytes.
- Visuals remain useful without WebGL. `prefers-reduced-motion`, an explicit dynamic toggle, background tab suspension and complete scene disposal are required. No autoplay sound; optional ambient audio requires a user click.
- No third-party runtime, remote font/image dependence or fullscreen loading gate. At 320, 390 and 1280px widths × 740px high, the three main actions fit the first screen. Smaller landscape screens may scroll vertically.
- Keep package-derived release version visible in the footer. Target 5.1.0 unless main has advanced to a conflicting version before merge.

## Components

- `src/ui/title-screen.js`: semantic title composition and existing action contracts.
- `src/ui/title.css`: isolated cinematic art direction, locally embedded font/art, responsive layout, focus and reduced-motion styles.
- `src/ui/title-scene.js`: optional scene lifecycle, capped rendering, pointer interaction, motion/audio controls and cleanup.
- `src/app.js`: dispose previous effects at render start and mount after home insertion.
- `assets/title-*`: optimized original artwork and a small open-licensed title font subset, with source/license records.

## Acceptance

Inspect desktop and portrait mobile in browser; exercise new/continue/settings, saved progress and repeated navigation. Verify reduced motion and unavailable graphics do not hide controls. Run relevant browser regressions, full existing release validation, offline artifact checks and CI. Publish through the existing GitHub workflow and verify the actual custom domain's release/version before reporting it live.
