# Neon title reconstruction

The four SVGs contain only filled vector paths. No image elements, embedded bitmap data, source frames, fonts, or video are embedded. They reconstruct the projected title geometry from four measured reference poses, after temporal/spatial cleanup and color-contour tracing. They are not editable 3D type meshes. Blue outlined background geometry is included in the traced art.

| Asset | Original source time |
|---|---:|
| neon-pose-48.svg | 14.790000 |
| neon-pose-55.svg | 15.081667 |
| neon-pose-60.svg; neon.svg | 15.290000 |
| neon-pose-65.svg | 15.498300 |

All SVGs use viewBox `0 0 1920 1080`, preserveAspectRatio none. Draw at the full viewport with cover/crop framing matching the reference. The title intentionally extends beyond the edges; do not fit the whole word inside a safe margin. Faces tilt independently, so a single whole-image translate/rotate is insufficient between poses48 and55.

## Morph fields

Six 240×135 RGB PNGs named `neon-flow-FROM-TO-forward.png` and `neon-flow-FROM-TO-backward.png` encode DIS optical flow. These images are numerical displacement data, not appearance assets. Forward flows from first pose to second; backward flows from second pose to first. R is horizontal, G vertical; source pixel coordinates x right and y down. Decode with:

```glsl
vec2 forwardPixels = (texture2D(flowForward, uv).rg * 255.0 - 128.0) * 4.0;
vec2 backwardPixels = (texture2D(flowBackward, uv).rg * 255.0 - 128.0) * 4.0;
vec2 size = vec2(1920.0, 1080.0);
vec4 a = texture2D(poseA, uv - progress * forwardPixels / size);
vec4 b = texture2D(poseB, uv - (1.0-progress) * backwardPixels / size);
vec4 color = mix(a, b, progress);
```

Use LINEAR texture sampling and CLAMP_TO_EDGE. The flow orientation must match the art's texture coordinates; if uploading images with flipped y, flip the flow lookup accordingly and invert decoded y. Encoding zero is byte128, not normalized0.5. Flow range [-512,508] source pixels, resolution 4 pixels, bilinear sampling smooths the grid.

`neon-motion.json` contains higher precision64 × 36 forward/backward arrays in source pixel units if desired. Approximate 90th percentile displacement magnitudes for pairs 48→55,55→60,60→65 are 308,133,67 source pixels, respectively. These are algorithm estimates, not manually verified vertex correspondences.

## Remaining fidelity limits

- Optical flow is a 2D estimate. Self-occlusion and sharp flashes can produce local morph ghosts, especially first pair; review slow motion.
- Top-left service watermark, site caption, browser top-right find box, bottom-right watermark were removed. Their hidden geometry is inferred by inpainting.
- Dense vertical interference was suppressed before tracing, to permit procedural CRT treatment. Some short horizontal scratch fragments and quantized glow bands remain in the art.
- Keep procedural scanline/noise/bloom subtler than on clean flat geometry because traces retain some source glow.
- Replacing the opening background is supported by the parent compositor; this typography stage intentionally fills the viewport with its own graphic field.

Generation scripts: `work/trace_neon.py`, `work/neon_flow.py`. Dependencies isolated in `work/neon-tools`.

