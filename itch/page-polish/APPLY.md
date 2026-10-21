# Beamwright + Jalapeño Seed page polish

Prepared October 21, 2026. These are proposed page changes, not live edits.
The editor redirected this cloud browser to an itch login security check.
The game build and its automatic itch upload remain separate from page appearance.

## 1. Beamwright — Edit game

- Short description: **Bounce, bend, and split light. Solve 22 optics puzzles—or build your own.**
- Paste `beamwright-description.html` using the description editor's HTML (`<>`) mode.
- Keep the existing playable HTML5 upload selected. Do not upload the page kit as the game.
- Keep pricing, visibility, embed settings, and community configuration as they are.
- Use `cover.png` as the game cover if the existing cover is missing or less suitable.
- Add the screenshots in this order: Grand Bench, Raindrop, Bench Maker, Title, Picker.
  These are actual project screenshots from the existing art kit; they predate the newest skins.
  Do not label them as captures of the new High Contrast or Ocean skins.

## 2. Beamwright — Edit theme

| Theme setting | Value |
|---|---|
| Background | #171B20 |
| Content / panel background | #252C34 |
| Body text | #F2F0E9 |
| Links / accent | #FFC56D |
| Button fill, if separately editable | #FFC56D |
| Button text, if separately editable | #171B20 |
| Body font | A readable sans serif offered by itch |
| Body size | 17–18px equivalent, if available |
| Banner | beamwright-banner.png |
| Background image | None |
| Layout | Single column, gameplay first |

Choose the closest available theme fields; the live editor has not yet been inspected.
For a single-column HTML5 page, embed screenshots into the description as well:
1. Grand Bench after the opening two paragraphs.
2. Raindrop after “Start simple. Get wonderfully tangled.”
3. Bench Maker before “Build something worth sharing.”
Use the editor's image uploader so itch supplies real hosted URLs. Add descriptive alt text.
The HTML file intentionally has no broken image placeholders or unverified image URLs.

Optional CSS is separate in `optional-game.css`. The default design works without it.
Preview on a phone and desktop before saving. Check link contrast and the Run game button.

## 3. Homepage

- Upload `jalapeno-seed-banner.png` as the profile banner.
- Use the same background, text, and accent colors.
- Paste `homepage-description.html` into the profile description.
- Use the built-in game grid and put Beamwright first, followed by Yolk Flip.
- Create **Play in Your Browser** for currently published browser games.
- Add **Experiments** and **Tools & Generators** only when there are public projects to put there.
- Don't add empty collections or promote the paused 3D prototype as a released game.
- Keep a plain background; matching covers and readable copy do the work.

## Media notes

The banners are original vector typography/optics linework, not screenshots or a depiction of a 3D game.
PNG uploads are 1920 × 480; SVG sources are included for editing.
The screenshots and cover are unchanged existing assets. No new gameplay GIF was fabricated.
For a later GIF: capture 5–8 seconds from the current build showing one mirror completing a light path,
without browser controls, at a modest size; add a static alternative for reduced-motion visitors.

## Optional CSS access request — draft only

I'd like custom CSS enabled for jalapenoseed. The standard theme editor covers my page colors
and banners. I'd additionally like subtle borders on description images, clearer focus outlines,
and modest hover treatment on featured project links. These are visual changes only. I'll keep
itch's navigation, purchase controls, footer, and game embed intact, test on mobile and logged out,
and respect reduced-motion preferences.

No support email has been sent. No CSS access is required for the core redesign.

## References

https://itch.io/docs/creators/design
https://itch.io/docs/creators/css-guide
https://xilurus.itch.io/
