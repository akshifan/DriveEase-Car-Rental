# DriveEase hero car model

`driveease-car.glb` is an original, self-authored low-poly grand-tourer used by
the landing page hero. It is generated locally by `scripts/generate-car-glb.mjs`
so no third-party asset is vendored. The geometry, materials and node names are
entirely our own.

## Swapping the model

Any legally-usable GLB/GLTF car can be dropped in place of this file as long as:

- The file is at `public/models/driveease-car.glb`
- Wheel nodes are named `wheel` (or start with `wheel`) so the scroll controller
  can spin them (optional — the scene works without spinning wheels)
- The car is oriented facing +X and sits on the Y=0 plane
- Scale is roughly 4.2 units long, 1.8 wide, 1.4 tall (the camera framing assumes
  this bounding box; larger models can be scaled via the GLB's root node)

## Regenerating the bundled model

```bash
node scripts/generate-car-glb.mjs
