# Design sources

Working files behind the game's look. Nothing here is loaded by the game.

- `logo/`: the title and logo sheets.
  - `sheet.html`, `sheet2.html`: logo concepts 1-10 (all rejected except the crosshair).
  - `sheet3.html`: the sharper crosshair variants; **1b (sharp + slash)** is the live logo.
  - `t2.html`: the title cut options; **C (one slanted slash through HIT and RUN)** is live.
  - `hero-render.html` + `hero-render.js`: three.js (0.160, FBXLoader) render of the menu soldiers. Supports a procedural stone spear and hiding materials such as `^Arrow_MAT`.
  - `hero-lineup-comp.py`: composes the three era figures into `sprites/hero.webp`.
  - Fonts: Big Shoulders Stencil (`bss.woff2`), Big Shoulders Display (`bsd.woff2`) and Saira (`saira.woff2`), all under the SIL Open Font License.
  - The finished icons and the share image live in `/icons` (`icon.svg`, `icon-180/192/512.png`, `og.png`).
- `3d-models-wanted.md`: the wish list of 3D models still needed.

The 3D sprite bake pipeline is in `media/scripts/sprites3d/`. Large source files (GLB models, Mixamo zips, raw videos) are kept outside the repo.
