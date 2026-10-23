# itch.io page kit

Everything to paste into the itch.io "Create new project" form. Images are in this folder.

## Settings

| Field | Value |
|---|---|
| Title | Beamwright |
| Project URL | `https://jalapenoseed.itch.io/beamwright` |
| Short description or tagline | Bounce, bend, split and focus real ray-traced light into every photocell. |
| Classification | Games |
| Kind of project | **HTML** |
| Release status | Released (or In development) |
| Pricing | No payments, or "$0 or donate" |
| Uploads | `itch-build/beamwright-html5.zip` from `npm run itch`. Tick **This file will be played in the browser**. |
| Embed options | Embed in page · **Manually set size: 1280 × 720** · tick **Mobile friendly** (orientation: landscape) · tick **Fullscreen button** · leave **Automatically start on page load** off |
| Frame options | tick **Click to launch in fullscreen** only if you want it fullscreen on phones |
| Genre | Puzzle |
| Tags | optics, light, physics, puzzle, relaxing, level-editor, music, minimalist, sandbox, singleplayer |
| Cover image | `cover.png` (1260 × 1000, the 630 × 500 shape itch asks for) |
| Screenshots | `screenshot-1-title.png` … `screenshot-5-picker.png` |
| Gameplay video | Upload `dist/trailer.mp4` to YouTube, then paste the link here |
| Community | Comments (so players can post bench codes) |
| Visibility | Draft first; play it on the page, then Public |

## Description

> **Beamwright** is a puzzle game about light. Mount mirrors, lenses, prisms, fibers and stranger glass on an optical breadboard, and steer real ray-traced light into every photocell.
>
> Every part bends light by real optics: Snell's law, total internal reflection, focusing lenses, mirrors, and prisms that fan white light into a rainbow.
>
> **The light is the drum machine.** Each source fires a pulse on the downbeat. Every mirror, lens and photocell it meets becomes a drum hit, so the shape of your light path *is* the beat.
>
> - 32 benches across three chapters: **The Bench**, **Exotic Optics**, and **Masterworks**. Masterworks adds ten larger, harder maps with maze routing, power budgets, crossed colours, fiber networks and spectral locks. Exotic Optics has total internal reflection, cat's eyes, fiber optics, raindrops, diamonds and a hot-air mirage.
> - **Bench maker:** build your own benches, have the solver check they can be solved, and share them as codes.
> - **Community benches:** the best player benches ship in the game, with credit.
> - A free bench with every part unlimited
> - Original synthesized music and sound; no samples
>
> **Controls:** drag parts from the rack onto the bench. Tap a part to select it, then tap again (or Q / E, or the mouse wheel) to turn it 15°. Drag it off the bench to put it back. Esc opens the menu. Works with mouse, touch and keyboard.
>
> **Share your benches:** in the bench maker, press **check**, then open **bench settings** and press **submit**. That opens a form on GitHub with your code filled in. No GitHub account? Post your code (it starts with `BW1-`) in the comments below and we'll add it. To play a code someone posted, open the bench picker → **Open a code**.
>
> Made by **Jalapeño Seed Productions**.

## Updating the game later

Either upload a new zip by hand, or let GitHub do it: every push to `main` rebuilds and pushes to itch with butler (see the README, "Publish on itch.io").

