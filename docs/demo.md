# Judging Demonstration Guide: Pain Map Journal

Rehearsal guide for the hackathon presentation. Demonstrates the two primary product selling points: **direct 3D body interaction** and **longitudinal pain analysis over time**.

## Demo Arc (3-5 Minutes)

```
[1. 3D Check-in] ──> [2. Maya 6-Week Replay] ──> [3. Regional Trends] ──> [4. Date Comparison] ──> [5. Appointment Report]
```

---

### Step 1: Check-in & Direct 3D Interaction (`/`)
1. **Show the 3D Body**:
   - Rotate the mannequin in 3D using mouse drag or arrow keys.
   - Click named camera buttons: `Front`, `Back`, `Your left`, `Your right`.
2. **Key Talking Point**:
   > *"Existing pain journals rely on flat 1-to-10 numbers or generic checkboxes. We allow patients to inspect and mark sensations directly on an anatomically faithful 3D mannequin with 19 distinct body regions."*

---

### Step 2: Longitudinal Playback with Maya (`/history`)
1. **Navigate to History**: Click `History` in the top navigation.
2. **Profile Identification**:
   - Point out the `Synthetic · Read-only` badge on Maya's profile.
   - Note that Maya provides 42 consecutive daily check-ins (September 6 to October 17, 2026).
3. **Playback Demo**:
   - Click `Play` in the scrubber controls.
   - Watch the scrubber advance chronologically across the six-week timeline.
   - Observe how early days (Sept 6–9) are pain-free check-ins, followed by lower back aching starting September 10.
   - Note how playback automatically stops at the final date (October 17).
4. **Key Talking Point**:
   > *"Pain isn't static—it evolves. The chronological playback lets both patients and clinicians see how symptoms change day-by-day rather than relying on memory."*

---

### Step 3: Regional Trend Analysis (`/history`)
1. **Select Lower Back & Aching**:
   - Show the summary stat cards:
     - **38 / 42 recorded days** (90.5% frequency).
     - **First Recorded**: September 10, 2026.
     - **Peak Intensity**: 6.4 / 10.
   - Show the interactive SVG trend chart displaying peak intensity and map coverage.
2. **Switch to Left Thigh & Burning**:
   - Select `Left Thigh` and `Burning`.
   - Observe the chart: zero until October 3, then sudden onset (15 / 42 days).
3. **Switch to Left Calf & Burning**:
   - Select `Left Calf` and `Burning`.
   - Observe the chart: onset on October 10 (8 / 42 days).
4. **Key Talking Point**:
   > *"We compute both peak intensity (severity) and map coverage (surface area). Missing check-in days appear as distinct gaps in the trend, and frequency counts use recorded days as the denominator to prevent data distortion."*

---

### Step 4: Two-Date Comparison (`/history` -> Compare Dates)
1. **Click `Compare Dates` tab**:
2. **Use Preset 1: Thigh Onset (Oct 2 vs Oct 3)**:
   - Click the `Thigh Onset` preset button.
   - Point out the highlighted **Newly Marked Pain Region**:
     - *Left Thigh: Burning (Peak 5.2/10, 16% coverage)*.
3. **Use Preset 2: Calf Spread (Oct 3 vs Oct 10)**:
   - Click `Calf Spread` preset button.
   - Point out that Left Thigh burning remains persistent, while **Left Calf burning** is newly marked.
4. **Key Talking Point**:
   > *"The comparison objectively identifies newly marked and resolved pain areas with exact metric deltas, using purely descriptive language without making automated diagnoses."*

---

### Step 5: Profile Isolation Check
1. Switch to `Visitor (My Journal)`.
2. Notice that Maya's synthetic data is immediately cleared, showing the visitor's clean empty state.
3. Switch back to `Maya` to instantly restore the full 42-day dataset.

---

## Reproducibility & Offline Verification

The entire Maya dataset and analysis engine are 100% deterministic and run offline without cloud databases or external API keys:

```bash
# 1. Regenerate Maya synthetic fixture
node --import tsx scripts/generate-maya.ts

# 2. Run automated verification suite
npm test

# 3. Run production typecheck
npm run typecheck
```
