# Affine animation revision

`neon-motion.js` replaces the dense DIS flow interpolation with row-wise affine transforms and two additional vector keyposes49 and52. It exports `keyTimes`, `files`, and `sampleNeonMotion(sourceTime)`.

```js
const motion = sampleNeonMotion(sourceTime);
// Load files[motion.index], files[motion.index+1] as poseA/B.
// Upload each with gl.uniformMatrix3fv(location,false,array).
motion.top.outgoing;
motion.top.incoming;
motion.bottom.outgoing;
motion.bottom.incoming;
```

Matrices are normalized UV texture lookup matrices, column-major, x right/y down. Shader application:

```glsl
vec2 aUV = (topOutgoing * vec3(p,1.)).xy;
vec2 bUV = (topIncoming * vec3(p,1.)).xy;
vec3 upper = mix(texture2D(poseA,aUV).rgb,texture2D(poseB,bUV).rgb,blend);
// Repeat with bottom matrices.
vec3 c = mix(upper,lower,smoothstep(480./1080.,515./1080.,p.y));
```

`motion.progress` is the geometric interpolation fraction. Use it for geometry; a narrower blend `smoothstep(.35,.65,progress)` reduces the duration of double contours. Row transforms preserve straight edges, unlike the rejected dense field. Matrices were fitted from SIFT/RANSAC matches except top49→52, which uses three manually inspected E-glyph corners. There is no independently extracted blue background layer: it remains in the vector plates and follows the row transform. The y480–515 split is a compositor approximation, not an exact glyph alpha mask.

The first48→49 interval is a41.7ms pose change. The helper uses a discrete switch because large rotation/occlusion and interference produced unreliable correspondence; it avoids inventing liquid deformation. Remaining keypose intervals interpolate continuously.

## QA evidence

Rendered all added SVGs and actual midpoint composites to `work/neon/affine-mid-49-52.png`, `affine-mid-52-55.png`, `affine-mid-55-60.png`, `affine-mid-60-65.png` and inspected them. Compared integrated flow on/off at2.1,2.25,2.35,2.46,2.55 seconds in `work/neon/integrated-*.png`.

Findings: dense flow at2.1 severely melts straight letter contours and was rejected. Affine motion retains straight lines and sensible opposing row travel. At2.25/2.46 (near keyposes), jagged motion was from the CRT shader, not the flow field. Affine midpoints still show doubled edges when individual glyph perspective differs from the row model, especially49→52; they should not be described as exact. A full fidelity solution requires separate glyph/face masks and additional measured vertex trajectories, rather than stronger random glitch hiding residuals.
