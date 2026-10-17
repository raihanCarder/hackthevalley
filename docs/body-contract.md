# Body and entry contract

`src/domain/contracts.ts` is the shared browser/server contract. Current entry schema is `1`; body-map version is `mannequin-v1`. Reject unknown versions visibly instead of reinterpreting maps. The mannequin geometry, UV layout, and region-ID atlas are versioned together: any change to geometry, island order, UVs, or region assignment requires a new `bodyMapVersion`.

## Coordinates

Right-handed world, metres for model dimensions: +Y up, +Z anterior/front, +X patient-left. A front camera stands on +Z looking toward the body, so patient-left appears on the viewer's right. Back is -Z. Patient-left camera stands on +X; patient-right on -X. Ground is Y=0, body center line is X=0. Orbit target is (0, 1, 0); named views stand 2.9 m from it. Do not infer patient sides from screen coordinates.

UVs have origin at bottom left, U increases right, V increases up. CPU image buffers have origin at top left: column=min(511, floor(u*512)), row=min(511, floor((1-v)*512)), clamped to 0..511 (`uvToTexel` in `src/body/layers.ts`). PNG rows are stored in the same top-left order as the CPU buffer, so encoding/decoding applies no flip. The only vertical conversion happens in the pain shader, which samples the RGBA paint texture at `(u, 1 - v)` because WebGL uploads buffer row 0 at t=0. Do not add a second flip.

Linear intensity bytes represent 0..10 via byte/255*10; the brush maps intensity N to `round(N/10*255)`. Four independent layers: burning, sharp, aching, tingling. Every island has its own tile; there is no wrap or mirrored atlas reuse.

## Region-ID atlas (task 2.6)

`buildBodyAtlas` (`src/body/atlas.ts`) rasterizes every mesh triangle into its UV tile with texel-centre sampling. A texel is valid only when a triangle covers its centre; gutters and the collapsed halves of pole quads stay invalid (`-1`). Each valid texel stores its island, region index, model-space position, and normal. Lookup is nearest-texel, so IDs are never blended. `public/body/region-atlas-mannequin-v1.png` is an inspection copy (0 = invalid, otherwise `REGION_IDS` index + 1) produced by `npm run body:generate`; runtime and server code derive the identical raster from the generator, and a test checks they agree.

Seam neighbors are explicit: islands of the same component share seams (each limb part's front and back; the four torso patches). Strokes may cross only those seams. Overlapping volumes from different parts (thigh/calf at the knee, hand/thigh, torso/pelvis) are never joined.

## Painting rule (tasks 2.1–2.3)

A raycast against the visible mesh gives the surface point, face normal, and island. A stamp writes texels of that island and its seam neighbors whose surface position is within the world-space brush radius and whose normal faces the brush (dot > 0.2), so a mark on the front of a thin limb never reaches its back. The brush is soft: full strength inside 45% of the radius, smoothstep to zero at the rim. Painting uses maximum blending (`max(existing, intensity * falloff)`); repainting lower requires erasing first. The eraser reaches 1.2x the radius with a harder edge, multiplies by `1 - falloff`, and clears values left below the presence threshold. Pen pressure scales intensity when available.

Successive samples within one stroke are joined with stamps along the chord only when both lie on the same island or seam neighbors and are at most 0.25 m apart; a miss (pointer off the body) breaks the path. The renderer additionally subdivides pointer movement in screen space (about half the brush radius per raycast), so each stamp sits on the real surface. Undo keeps at most 10 completed strokes as per-texel patches of the one affected layer.

## Measurements

The shared reducer is `reduceRegions` (`src/body/regions.ts`). Bytes below 13 (`PRESENCE_THRESHOLD`) count as unpainted; mean intensity averages all valid region texels, including zeros; peak is the maximum; map coverage is the fraction of valid region texels at or above the threshold. Only present region/type pairs are returned, in `REGION_IDS` then `PAIN_TYPES` order, so an explicitly saved empty map yields `[]`. Intensities are rounded to 4 places, coverage to 6. Coverage is UV map coverage, not skin area. Never add intensities across pain types.

## Regions

Stable patient-relative IDs: head, neck, front/back upper/lower torso, pelvis, and bilateral upper arms, forearms, hands, thighs, calves, feet (19 regions). Each named limb's front and back islands share its region ID; torso islands have separate front/back region IDs. `parseRegionId` rejects unknown IDs. Display names are in `src/body/region-labels.ts`.

## Daily records

An entry carries profile ID, local calendar date (YYYY-MM-DD), IANA time-zone label, UTC updated timestamp, schema version, body version, all four encoded map layers, optional original written note, and region/type observations. `null` means missing check-in; a saved entry with four zero maps means an explicitly recorded empty map. Never synthesize an empty entry for a missing date. The local date is validated as a calendar date without UTC conversion, including Gregorian leap-year rules. Map coverage is a fraction 0..1, intensity 0..10. These are descriptive data values, not clinical scores.

`parseDailyEntry` validates structure and metadata only. Map encoding and payload validation live in `src/body/map-codec.ts` (task 2.7): each layer is an 8-bit grayscale, non-interlaced 512x512 PNG (base64). Decoding verifies the signature, chunk CRCs, header, critical chunks, row filters, and exact inflated size (bounded, so oversized data is rejected while decompressing). `validateEntryPayload` enforces the 6 MiB request limit and the 4,000-code-point note limit, checks versions before structure, decodes all four maps, and recomputes observations rather than trusting the client. Errors are `MapValidationError` with a `code` of `version`, `format`, `dimensions`, `corrupt`, `too-large`, or `note-too-long`. An identifier in this contract is not an authentication mechanism.
