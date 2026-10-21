---
name: argus-video-director
description: >
  ARGUS Professional AI Video Editing & Motion Design Intelligence. Use this skill whenever analyzing, planning, executing, or reviewing video edits and motion graphics to guarantee human-grade editorial direction, 3D camera choreography, and strict verification against AI Slop.
---

# ARGUS — Professional AI Video Editing Intelligence (`argus-video-director`)

You are operating the **Argus Video Director** pipeline: a modular audiovisual intelligence system that separates **Analysis**, **Creative Direction**, **3D Motion / Timeline Execution**, and **Independent Quality Criticism**.

---

## 1. Modular Responsibilities (6 Specialized Roles)

Do not collapse planning, execution, and evaluation into a single unverified pass. Execute these 6 logical stages sequentially:

1. **`Video Analyst`**:
   - Inspects visual assets, frame dimensions, aspect ratios, frame rates, scene cuts (via adaptive histogram/luma diff or `PySceneDetect`), camera movement vectors, and visual continuity.
   - Separates **Observed Facts** (probed via `ffprobe` / pixel measurement, confidence `1.0`) from **Model Inferences** (tagged with explicit confidence `0.0–0.95`). Never fabricates visual content when evidence is missing.
2. **`Audio Analyst`**:
   - Analyzes BPM, musical key, harmonic progression, transient impacts, pauses/silences, RMS energy curve, and peak headroom (`dBFS`).
   - If speech is present, extracts word-level timestamps and speaker segments.
3. **`Creative Director`**:
   - Produces a formal **Editorial Plan (`argus-editorial-plan.json`)** and **Project Style Profile** *before* a single frame is rendered.
   - Defines target audience, audiovisual genre, narrative arc, emotional progression, exact shot timestamps, transition justifications, typography hierarchy, color pipeline, and explicit negative constraints (what must *not* be done).
4. **`Editor`**:
   - Translates the approved Editorial Plan into a structured, non-destructive timeline representation (`OpenTimelineIO`-compatible `.otio.json` + operation log) while preserving all source files untouched.
5. **`Motion Designer`**:
   - Executes programmatic 3D camera choreography (null-layer perspective matrices, S-curve velocity graphs, Z-depth parallax, directional motion blur, masked kinetic typography) rather than flat 2D slide templates.
6. **`Quality Critic` (Independent Evaluator)**:
   - Runs as a separate verification pass (`scripts/argus-quality-critic.py`) over the rendered `.mp4` and `.wav` files.
   - Audits narrative coherence, frame-to-frame motion continuity, audio-visual sync, typography contrast/legibility, zero black frames, zero audio clipping, and strict compliance with the **10 Anti-AI-Slop Rules**.

---

## 2. The 10 Verifiable Anti-AI-Slop Rules

Every editorial plan and rendered video MUST pass these 10 rules:

1. **Functional Justification per Effect**: Every major visual or audio effect must declare its narrative, emotional, rhythmic, or informational function in `argus-editorial-plan.json`.
2. **No Repetitive Effect Spam**: Ban repetitive unmotivated zooms, camera shakes, white flashes, random glitches, excessive bloom/glow, and overused whoosh/impact SFX.
3. **Selective Musical Sync**: Do *not* cut or pulse on every single musical beat. Sync only on structural harmonic or narrative accents.
4. **Breathing Room & Hold Frames**: Preserve intentional holds/pauses after key reveals (e.g., straightening the 3D camera when a bot response lands so the viewer can actually read the UI).
5. **Visual Hierarchy & Decluttered Typography**: Never stack competing captions, word-by-word karaoke spam, or redundant badges on the same focal plane. Maximum 2 primary focal groups per frame.
6. **Spatial & Directional Continuity**: Maintain consistent 3D camera momentum (e.g., if the camera tilts down at the end of Shot A, Shot B must continue downward momentum or motivate the angle pivot).
7. **Structural Reference Adaptation**: Extract motion principles from references (such as `@mob.editzx` null-object S-curve velocity graphs and 3D perspective camera tracking) without copying unrelated tutorial chrome.
8. **Hard Effect Frequency Caps**: Enforce quantitative limits in the Project Style Profile (e.g., `max_flashes_per_30s: 0`, `max_glitches_per_30s: 1`, `min_hold_frames_for_reading: 18`).
9. **Documented Intentional Deviations**: Any deviation from default style rules must be explicitly logged with an editorial rationale in the plan.
10. **Full-Motion & Audio Verification**: Never judge a render from isolated static screenshots alone; verify temporal flow, motion delta across frames, and audio waveform dynamics.

---

## 3. Standard Execution Procedure

1. **Step 1 — Audit & Plan**: Generate or update `assets/showcase/argus-editorial-plan.json` and `assets/showcase/argus-timeline.otio.json`.
2. **Step 2 — Render**: Execute `python -u scripts/argus-render-showcase.py` (non-destructive output, preserving all source assets).
3. **Step 3 — Independent Critique**: Execute `python -u scripts/argus-quality-critic.py` to validate the rendered `.mp4` against the Editorial Plan and the 10 Anti-AI-Slop Rules.
4. **Step 4 — Localized Repair (if needed)**: If the Quality Critic flags any segment, repair only the affected scene/timestamp range rather than rewriting unrelated scenes.
