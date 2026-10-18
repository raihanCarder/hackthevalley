# Source mesh

`makehuman-hm08-base.obj` is the MakeHuman `hm08` base mesh, copied byte-for-byte from the MakeHuman repository.

- Upstream: https://github.com/makehumancommunity/makehuman/blob/3c701a8e52f09e69922e8b598d23be2d7dfc49e3/makehuman/data/3dobjs/base.obj
- Commit: `3c701a8e52f09e69922e8b598d23be2d7dfc49e3` (2020-09-26)
- SHA-256: `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c`
- License: CC0 1.0 Universal. The file's own header states it "was explicitly released as CC0 in september 2020"; the repository's `LICENSE.md` (section C) lists "the base mesh and proxies" among assets released under CC0. The full legal text is in `LICENSE-CC0.md`.
- Copyright holders at the time of the CC0 release, per the file header: Data Collection AB, Joel Palmius, Jonas Hauquier.

`scripts/generate-body.ts` uses only the `body` skin group and the two eyeball helpers. Hair, clothing (tights, skirt), genital, teeth, tongue, and eyelash helpers are discarded, so the generated mannequin is a smooth, neutral figure. The `joint-*` helper groups are used only to locate the skeleton for region labelling.
