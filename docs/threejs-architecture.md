# Three.js Architecture — the homepage scene

The homepage carries a real WebGL scene: a car you can move with your scroll,
lit and framed like an automotive film. It is built with
**Three.js via `@react-three/fiber` + `@react-three/drei`**, choreographed with
**GSAP ScrollTrigger** and smoothed by **Lenis**. A spinning model pinned in
the corner would fail the brief — the car, camera, light and the page's
sections all move together.

## Scene composition (`src/three/`)

| File                    | Responsibility                                                                    |
|-------------------------|-----------------------------------------------------------------------------------|
| `DriveEaseScene.jsx`    | Canvas owner. Detects WebGL, picks a quality tier, hosts `<Canvas>` with dpr caps, pauses rendering when off-screen, renders the static fallback otherwise |
| `CarModel.jsx`          | The car: an **original procedural body** (built from primitives — no licence encumbrance) with paint, glass, wheels and trim; supports swapping in a glTF/GLB (`GlbCar.jsx`) via a single `CAR_MODEL_URL` constant |
| `CarCamera.jsx`         | Camera rig — scroll-driven dolly/orbit with interpolation and damping; subtle pointer parallax on top |
| `CarLighting.jsx`       | Three-point studio lighting, soft key + rim lights, environment tone matched to the page palette |
| `CarScrollController.jsx` | Reads normalised scroll progress (0→1) across the `[data-scene-track]` section and drives car yaw/translate + camera path with critically-damped easing (never raw scroll values) |
| `WebGLFallback.jsx`     | Elegant static art panel when WebGL is unavailable or quality is minimal          |

## Scroll choreography

- **Lenis** owns the scroll feel; GSAP's ticker drives `lenis.raf` and
  ScrollTrigger listens to Lenis (`lenis.on('scroll', ScrollTrigger.update)`), so
  there is exactly **one rAF loop** for the whole page — no competing loops.
- `src/animations/scrollTimelines.js` builds per-section GSAP timelines
  (entrance, feature sections, closing outro) with `scrub`, so timeline
  progress is a pure function of scroll position; `revealAnimations.js` handles
  once-only reveals.
- `CarScrollController` maps the same progress to the 3D rig: the car yaws and
  drifts between "studios", the camera arcs and changes height — every value
  passes through damping (exponential smoothing) so wheel events feel like
  inertia, not teleporting.

## Interaction

- Subtle **pointer parallax**: mouse/touch position biases camera look-target
  by a few degrees with heavy damping — felt, not distracting.
- The car gently idles (suspension breathing, slow wheel motion) while a
  section is at rest so the scene is alive even without input.

## Performance & resource discipline

- **Quality tiers** (`detectQuality`): viewport width, `hardwareConcurrency`,
  `deviceMemory` and coarse-pointer detection pick high/medium/low — pixel
  ratio capped at `[1, 1.75]` (high) or `[1, 1.2]` (low), shadow and
  geometry detail scale accordingly.
- **Frameloop governance**: `'always'` only while the canvas intersects the
  viewport (`IntersectionObserver`), `'never'` when scrolled past, `'demand'`
  in reduced-motion mode (renders a single representative frame).
- **Disposal**: geometries, materials and the renderer are disposed on unmount
  (`rendererRef.current?.dispose?.()` + R3F's automatic disposal); no leaked
  GPU memory on SPA navigation.
- The Three bundle is **code-split** (`lazy(() => import('../../three/DriveEaseScene.jsx'))`
  → separate `three.*.js` chunk) so the catalogue/dashboard never pay for it.

## Accessibility & fallbacks

- `prefers-reduced-motion: reduce` — Lenis is not installed, scroll timelines
  are skipped (sections render statically), the scene renders one static frame
  (`frameloop="demand"`).
- **No WebGL / software-rendering environments** — capability probe (canvas
  2D context test) routes to `WebGLFallback`, a styled static composition of
  the same story.
- The canvas carries an `aria-label` ("Interactive 3D view of a DriveEase
  car") and is presentational to screen readers; all narrative content lives
  in real DOM sections.

## Using a real car model

The procedural car is original artwork. To drop in a purchased/authored GLB,
set `CAR_MODEL_URL` in `CarModel.jsx` to a licensed asset — `<GlbCar>` loads it
with `useGLTF`, applies the paint materials and reuses the same rig, so the
choreography is unchanged.
