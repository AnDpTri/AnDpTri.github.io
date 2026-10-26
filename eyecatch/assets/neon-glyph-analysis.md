# Per-glyph refinement experiment — rejected for production

Reference interval: original source frames49→52, with midpoint approximately14.894s. Existing production SVGs, animation module, and shader were left unchanged.

Experiment tracked up to5000 corners sequentially through native frames49,50,51,52 with pyramidal Lucas–Kanade, rejected forward/backward errors above2px, and fitted local affine transforms by RANSAC. This sequential measurement is more reliable than a single optical-flow leap across the entire interval. Six spatial groups were tested. The strongest fit was the upper-right glyph region (85 inliers); the central lower glyph supplied20 inliers.

Three local transforms were rendered over the current row model using manually bounded glyph regions. The actual rendered midpoint is `work/neon/local-mid-49-52.png`; the baseline is `work/neon/affine-mid-49-52.png`. Both were visually inspected. Intermediate tracking results are saved in `work/neon/local-tracks.json`; candidate polygons/matrices are in `work/neon/local-candidate.json`.

## Result

The central lower glyph aligns more closely than the single-row affine. However, region boundaries produce visible seams, and several extruded front/side surfaces retain doubled contours. The upper-middle region does not improve reliably. The result is a visual regression overall, so it was not integrated and no production `neon-glyph-motion.js` was created.

The small numerical residual on inlier corners does not establish whole-glyph accuracy: the fit follows one visible face while other faces move differently under perspective. Screen-space polygon partitions also include bits of neighboring glyphs and background. Feathering those boundaries conceals a seam only by creating additional blended edges, which does not meet the requested fidelity.

## Required next representation

1. Extract independent transparent masks for each glyph, including its front, extrusion side faces, outline and glow separately.
2. Track visible face corner correspondences through native frames49–52; use planar projective transforms per face, with explicit visibility changes where a face appears/disappears.
3. Reconstruct the uncovered background as its own layer instead of moving blue/green background pixels with the foreground letters.
4. Render with depth/visibility order before procedural CRT interference. Compare the midpoint with native frames50 and51 before accepting the replacement.

This is a specific remaining modeling limitation, not proof that frontend rendering cannot reproduce the effect. The browser can draw the geometry; the missing work is recovering the correct separated geometry and visibility from the reference.
