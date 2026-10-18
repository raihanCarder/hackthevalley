# Body and entry contract

`src/domain/contracts.ts` is the shared browser/server contract. Current entry schema is `1`; body-map version is `mannequin-v2` (the realistic MakeHuman-based body; see `public/body/PROVENANCE.md`). Reject unknown versions visibly instead of reinterpreting maps: `mannequin-v1` maps are refused, not remapped. The mesh, region labels, UV charts, and region-ID atlas are versioned together: any change to the source mesh, region rules, charts, or packing requires a new `bodyMapVersion`.

## Coordinates

Right-handed world, metres for model dimensions: +Y up, +Z anterior/front, +X patient-left. A front camera stands on +Z looking toward the body, so patient-left appears on the viewer's right. Back is -Z. Patient-left camera stands on +X; patient-right on -X. Ground is Y=0, body center line is X=0. The figure is 1.96 m tall. Orbit target is (0, 1, 0); named views stand 2.9 m from it. Close-up presets for the face, each hand, and each foot (`asset.focus`) move the target and camera to that part. Do not infer patient sides from screen coordinates.

UVs have origin at bottom left, U increases right, V increases up. CPU image buffers have origin at top left: column=min(511, floor(u*512)), row=min(511, floor((1-v)*512)), clamped to 0..511 (`uvToTexel` in `src/body/layers.ts`). PNG rows are stored in the same top-left order as the CPU buffer, so encoding/decoding applies no flip. The only vertical conversion happens in the pain shader, which samples the RGBA paint texture at `(u, 1 - v)` because WebGL uploads buffer row 0 at t=0. Do not add a second flip.

Linear intensity bytes represent 0..10 via byte/255*10; the brush maps intensity N to `round(N/10*255)`. Four independent layers: burning, sharp, aching, tingling. Every UV chart has its own rectangle; there is no wrap or mirrored atlas reuse.

## Region-ID atlas (task 2.6)

`scripts/body/regions.ts` labels every triangle of the source mesh. Limbs, hands, each finger, feet, and each toe take the region of the nearest labelled bone segment of the MakeHuman skeleton. The torso splits at y = 1.13 m (pelvis below), y = 1.36 m (upper/lower), and the spine plane (front/back). The neck and head follow the jawline, and the shoulder joins the arm beyond the joint near the arm axis. The eyelids and eyeballs, nose, lips, and ears are small volumes around facial landmarks. A two-pass majority filter smooths boundaries. `scripts/body/charts.ts` grows fold-free, region-aligned UV charts and rejects any triangle that would overlap its chart in UV space. The charts are packed into the 512x512 atlas at one density (about 4.5 mm per texel) with 5 px gutters.

`buildBodyAtlas` (`src/body/atlas.ts`) rasterizes every triangle into its chart with texel-centre sampling. Each valid texel stores its triangle and barycentric weights; gutters and unused texels stay invalid (`-1`). The atlas also holds the welded surface graph (positions, edges, vertex→triangle, triangle→texel). The region raster used by the reducer is embedded run-length encoded in `src/body/region-raster-data.ts`, so `reduceRegions` runs synchronously in browsers and Node. `public/body/region-atlas-mannequin-v2.png` is an inspection copy (0 = invalid, otherwise `REGION_IDS` index + 1). Tests check that both match the atlas rasterized from the asset, and that no texel is covered by two triangles.

## Painting rule (tasks 2.1–2.3)

A raycast against the visible mesh gives the surface point and its triangle. A stamp runs a bounded Dijkstra over the welded surface from that point, so distance is measured along the skin. It then writes the texels whose geodesic distance is within the brush radius: exact straight-line distance inside the hit triangle, and distance interpolated from the corners elsewhere. Paint therefore crosses UV seams and region borders on the surface but never jumps a gap. Neighbouring fingers, the palm under the back of the hand, and the scalp behind an ear are only reachable the long way round.

The brush is soft: full strength inside 45% of the radius, smoothstep to zero at the rim. Painting uses maximum blending (`max(existing, intensity * falloff)`); repainting lower requires erasing first. The eraser reaches 1.3x the radius with a harder edge, multiplies by `1 - falloff`, and clears values left below the presence threshold. Pen pressure scales intensity when available.

Successive samples are joined along the shortest surface path when they are at most 0.25 m apart and the surface path is at most 1.6x the straight line (plus half a radius). A fingertip-to-fingertip jump is therefore two separate marks, and a miss (pointer off the body) breaks the path. The renderer also subdivides pointer movement in screen space (about half the brush radius per raycast). Undo keeps at most 10 completed strokes as per-texel patches of the one affected layer.

## Body shape

Body-shape sliders and the default figure change vertex positions only. Triangles, UV charts, texel→triangle data, and region labels are identical for every shape, so maps, region observations, and saved check-ins do not depend on shape. Painting measures geodesic distance on the currently displayed surface. Shapes are a display preference and are never stored with an entry.

## Measurements

The shared reducer is `reduceRegions` (`src/body/regions.ts`). Bytes below 13 (`PRESENCE_THRESHOLD`) count as unpainted; mean intensity averages all valid region texels, including zeros; peak is the maximum; map coverage is the fraction of valid region texels at or above the threshold. Only present region/type pairs are returned, in `REGION_IDS` then `PAIN_TYPES` order, so an explicitly saved empty map yields `[]`. Intensities are rounded to 4 places, coverage to 6. Coverage is UV map coverage, not skin area. Never add intensities across pain types.

## Regions

45 stable, patient-relative IDs:

- **Head and torso:** head (scalp and face), neck, front/back upper/lower torso, pelvis.
- **Limbs, both sides:** upper arms, forearms, hands, thighs, calves, feet.
- **Face:** left/right eye, nose, mouth, left/right ear.
- **Fingers, both sides:** thumb, index, middle, ring, little.
- **Toes, both sides:** big, second, third, fourth, little.

The first 19 keep their v1 IDs and order. `parseRegionId` rejects unknown IDs. Display names are in `src/body/region-labels.ts`. The 2D diagram (`src/body/diagram-data.ts`, rendered by `src/timeline/body-diagram.tsx`) is traced from orthographic renders of these same triangle labels: front, back, face, both hands, and both feet.

## Daily records

An entry carries profile ID, local calendar date (YYYY-MM-DD), IANA time-zone label, UTC updated timestamp, schema version, body version, all four encoded map layers, optional original written note, and region/type observations. `null` means missing check-in; a saved entry with four zero maps means an explicitly recorded empty map. Never synthesize an empty entry for a missing date. The local date is validated as a calendar date without UTC conversion, including Gregorian leap-year rules. Map coverage is a fraction 0..1, intensity 0..10. These are descriptive data values, not clinical scores.

`parseDailyEntry` validates structure and metadata only. Map encoding and payload validation live in `src/body/map-codec.ts` (task 2.7): each layer is an 8-bit grayscale, non-interlaced 512x512 PNG (base64). Decoding verifies the signature, chunk CRCs, header, critical chunks, row filters, and exact inflated size (bounded, so oversized data is rejected while decompressing). `validateEntryPayload` enforces the 6 MiB request limit and the 4,000-code-point note limit, checks versions before structure, decodes all four maps, and recomputes observations rather than trusting the client. Errors are `MapValidationError` with a `code` of `version`, `format`, `dimensions`, `corrupt`, `too-large`, or `note-too-long`. An identifier in this contract is not an authentication mechanism.
