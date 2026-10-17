# Body and entry contract

`src/domain/contracts.ts` is the shared browser/server contract. Current entry schema is `1`; body-map version is `mannequin-v1`. Reject unknown versions visibly instead of reinterpreting maps. The mannequin geometry, UV layout, and future region-ID atlas are versioned together. Task 1 freezes the model and island metadata; task 3 will produce the region raster and measurements.

## Coordinates

Right-handed world, metres for model dimensions: +Y up, +Z anterior/front, +X patient-left. A front camera stands on +Z looking toward the body, so patient-left appears on the viewer's right. Back is -Z. Patient-left camera stands on +X; patient-right on -X. Ground is Y=0, body center line is X=0. Orbit target is (0, 1, 0). Do not infer patient sides from screen coordinates.

UVs have origin at bottom left, U increases right, V increases up. CPU image buffers will have origin at top left: column=min(511, floor(u*512)), row=min(511, floor((1-v)*512)), clamped to 0..511. PNG upload must explicitly account for this vertical conversion; do not apply it twice. Linear intensity bytes represent 0..10 via byte/255*10. The planned presence threshold is byte >=13. Four independent layers: burning, sharp, aching, tingling. Every island has its own tile; there is no wrap or mirrored atlas reuse. Front/back seams are separate islands. Do not connect them implicitly; task 2 must define explicit seam neighbors and island gating.

## Regions

Stable patient-relative IDs: head, neck, front/back upper/lower torso, pelvis, and bilateral upper arms, forearms, hands, thighs, calves, feet (19 regions). Each named limb's front and back islands share its region ID; torso islands have separate front/back region IDs. A future atlas must keep unused texels invalid and use nearest-neighbor IDs. `parseRegionId` rejects unknown IDs.

## Daily records

An entry carries profile ID, local calendar date (YYYY-MM-DD), IANA time-zone label, UTC updated timestamp, schema version, body version, all four encoded map layers, optional original written note, and region/type observations. `null` means missing check-in; a saved entry with four zero maps means an explicitly recorded empty map. Never synthesize an empty entry for a missing date. The local date is validated as a calendar date without UTC conversion, including Gregorian leap-year rules. Map coverage is a fraction 0..1, intensity 0..10. These are descriptive data values, not clinical scores.

`parseDailyEntry` validates structure and metadata only. It does not authorize access or decode images. Lossless PNG encoding/decoding, payload/note bounds, pixel verification, and server-recomputed observations belong to task 3. An identifier in this contract is not an authentication mechanism. Account/store mode and live Gemini scope remain unresolved and are not implemented in task 1.
