import json
import math
import shutil
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOWCASE_DIR = ROOT / "assets" / "showcase"
SHOWCASE_DIR.mkdir(parents=True, exist_ok=True)

AUDIO_PATH = SHOWCASE_DIR / "lwx-lab-soundtrack.wav"
VIDEO_PATH = SHOWCASE_DIR / "lwx-lab-motion-showcase.mp4"
ARTIFACT_DIR = Path(r"C:\Users\Evandro\.gemini\antigravity\brain\84a05893-5ab6-4635-be21-b20898d8fcb6")
ARTIFACT_VIDEO_PATH = ARTIFACT_DIR / "lwx_lab_motion_showcase.mp4"

W, H = 1280, 720
FPS = 30
DURATION = 28.0
TOTAL_FRAMES = int(DURATION * FPS)  # 840 frames


# =============================================================================
# 1. EASING & VELOCITY CURVES (MOB EDITZX / AFTER EFFECTS S-CURVE GRAPHS)
# =============================================================================
def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def ease_out_expo(t: float) -> float:
    t = clamp(t)
    return 1.0 if t >= 1.0 else 1.0 - math.pow(2.0, -10.0 * t)


def ease_in_out_expo(t: float) -> float:
    """Sharp S-curve velocity graph (slow-fast-slow) typical of null-object camera edits."""
    t = clamp(t)
    if t <= 0.0:
        return 0.0
    if t >= 1.0:
        return 1.0
    if t < 0.5:
        return math.pow(2.0, 20.0 * t - 10.0) / 2.0
    return (2.0 - math.pow(2.0, -20.0 * t + 10.0)) / 2.0


def ease_out_back(t: float, overshoot: float = 1.35) -> float:
    t = clamp(t) - 1.0
    return 1.0 + (overshoot + 1.0) * (t**3) + overshoot * (t**2)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


# =============================================================================
# 2. TRUE 3D PERSPECTIVE HOMOGRAPHY ENGINE (YAW / PITCH / ROLL / FOV / Z-PARALLAX)
# =============================================================================
def solve_perspective_coeffs(src_pts: list[tuple[float, float]], dst_pts: list[tuple[float, float]]) -> list[float]:
    """
    Computes the 8 perspective transform coefficients for PIL.Image.Transform.PERSPECTIVE
    mapping destination canvas (u, v) to source plane (x, y).
    """
    matrix = []
    rhs = []
    for (x, y), (u, v) in zip(src_pts, dst_pts):
        matrix.append([u, v, 1.0, 0.0, 0.0, 0.0, -u * x, -v * x])
        matrix.append([0.0, 0.0, 0.0, u, v, 1.0, -u * y, -v * y])
        rhs.append(x)
        rhs.append(y)
    A = np.array(matrix, dtype=np.float64)
    B = np.array(rhs, dtype=np.float64)
    coeffs = np.linalg.solve(A, B)
    return coeffs.tolist()


def project_3d_point(
    x: float,
    y: float,
    z: float,
    yaw_deg: float,
    pitch_deg: float,
    roll_deg: float,
    tx: float,
    ty: float,
    tz: float,
    focal: float = 1150.0,
) -> tuple[float, float]:
    """Projects a 3D point (x, y, z) rotated by (yaw, pitch, roll) and translated by (tx, ty, tz) onto the 2D canvas."""
    yaw = math.radians(yaw_deg)
    pitch = math.radians(pitch_deg)
    roll = math.radians(roll_deg)

    # Rotate around Y (yaw)
    x1 = x * math.cos(yaw) + z * math.sin(yaw)
    y1 = y
    z1 = -x * math.sin(yaw) + z * math.cos(yaw)

    # Rotate around X (pitch)
    x2 = x1
    y2 = y1 * math.cos(pitch) - z1 * math.sin(pitch)
    z2 = y1 * math.sin(pitch) + z1 * math.cos(pitch)

    # Rotate around Z (roll)
    x3 = x2 * math.cos(roll) - y2 * math.sin(roll)
    y3 = x2 * math.sin(roll) + y2 * math.cos(roll)
    z3 = z2

    depth = max(180.0, focal + z3 + tz)
    scale = focal / depth
    u = (W * 0.5) + tx + x3 * scale
    v = (H * 0.5) + ty + y3 * scale
    return (u, v)


def warp_plane_3d(
    plane: Image.Image,
    yaw_deg: float,
    pitch_deg: float,
    roll_deg: float,
    tx: float = 0.0,
    ty: float = 0.0,
    tz: float = 0.0,
    z_offset: float = 0.0,
    focal: float = 1150.0,
) -> Image.Image:
    """Warps a 2D RGBA image as a true 3D plane in perspective space."""
    pw, ph = plane.size
    hw, hh = pw * 0.5, ph * 0.5
    corners_3d = [
        (-hw, -hh, z_offset),
        (hw, -hh, z_offset),
        (hw, hh, z_offset),
        (-hw, hh, z_offset),
    ]
    dst_pts = [
        project_3d_point(cx, cy, cz, yaw_deg, pitch_deg, roll_deg, tx, ty, tz, focal)
        for (cx, cy, cz) in corners_3d
    ]
    src_pts = [(0.0, 0.0), (float(pw), 0.0), (float(pw), float(ph)), (0.0, float(ph))]
    coeffs = solve_perspective_coeffs(src_pts, dst_pts)
    return plane.transform((W, H), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)


# =============================================================================
# 3. FONTS & VECTOR UI PRIMITIVES
# =============================================================================
def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/calibrib.ttf"]
        if bold
        else ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/calibri.ttf"]
    )
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


FONT_DISPLAY = load_font(54, True)
FONT_KINETIC = load_font(42, True)
FONT_H1 = load_font(34, True)
FONT_H2 = load_font(25, True)
FONT_H3 = load_font(20, True)
FONT_BODY = load_font(17, False)
FONT_BOLD = load_font(17, True)
FONT_SMALL = load_font(14, False)
FONT_MONO = load_font(13, True)


def draw_card(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    border: tuple[int, int, int, int],
    radius: int = 18,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=border, width=width)


def draw_kinetic_mask_title(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    tag_text: str,
    main_title: str,
    sub_title: str,
    progress: float,
    accent: tuple[int, int, int] = (82, 183, 255),
) -> None:
    """Draws kinetic typography with animated mask reveal bars and structural HUD markers (zero AI Slop)."""
    p1 = ease_out_expo(clamp(progress * 1.4))
    p2 = ease_out_expo(clamp((progress - 0.12) * 1.4))
    p3 = ease_out_expo(clamp((progress - 0.24) * 1.4))

    # Tag Pill with sliding bar
    tag_w = int((len(tag_text) * 8.6 + 28) * p1)
    if tag_w > 12:
        draw.rounded_rectangle(
            (x, y, x + tag_w, y + 28),
            radius=6,
            fill=(accent[0], accent[1], accent[2], 38),
            outline=(accent[0], accent[1], accent[2], int(220 * p1)),
            width=1,
        )
    if p1 > 0.35:
        draw.text((x + 12, y + 5), tag_text, font=FONT_MONO, fill=(accent[0], accent[1], accent[2], int(255 * p1)))

    # Main Title with vertical accent bar
    bar_h = int(48 * p2)
    draw.rectangle((x, y + 40, x + 5, y + 40 + bar_h), fill=(accent[0], accent[1], accent[2], 255))
    slide_x = int(x + 18 + (1.0 - p2) * 45)
    draw.text((slide_x, y + 36), main_title, font=FONT_H1, fill=(255, 255, 255, int(255 * p2)))

    # Subtitle
    if p3 > 0.05:
        sub_x = int(x + 18 + (1.0 - p3) * 35)
        draw.text((sub_x, y + 82), sub_title, font=FONT_BODY, fill=(195, 205, 228, int(240 * p3)))


# =============================================================================
# 4. MOTIVATED AUDIO & SOUND DESIGN SYNTHESIS (ANTI-AI-SLOP RULE #1, #3, #4)
# =============================================================================
def synthesize_soundtrack() -> None:
    """
    Synthesizes a clean, high-headroom stereo electronic score with motivated,
    non-repetitive spatial SFX matched strictly to key camera movements and UI events.
    """
    sr = 44100
    n_samples = int(DURATION * sr)
    t = np.linspace(0.0, DURATION, n_samples, endpoint=False)

    left = np.zeros(n_samples, dtype=np.float64)
    right = np.zeros(n_samples, dtype=np.float64)

    # Warm, modern tech progression (Cm9 -> Fm9 -> Abmaj7 -> G7sus4)
    chords = [
        [130.81, 155.56, 196.00, 233.08, 293.66],
        [87.31, 130.81, 155.56, 207.65, 261.63],
        [103.83, 130.81, 155.56, 196.00, 261.63],
        [98.00, 130.81, 146.83, 196.00, 246.94],
    ]

    for bar_idx in range(7):
        t0 = bar_idx * 4.0
        t1 = min(DURATION, (bar_idx + 1) * 4.0)
        i0, i1 = int(t0 * sr), int(t1 * sr)
        bt = t[i0:i1] - t0
        chord = chords[bar_idx % len(chords)]

        env = np.minimum(1.0, bt / 0.30) * np.minimum(1.0, (4.0 - bt) / 0.40)
        pad_l = np.zeros_like(bt)
        pad_r = np.zeros_like(bt)
        for idx, freq in enumerate(chord):
            detune = 1.0018 if idx % 2 == 0 else 0.9982
            w_a = np.sin(2.0 * np.pi * freq * bt)
            w_b = 0.45 * np.sin(2.0 * np.pi * (freq * detune) * bt + 0.5)
            pan = 0.28 + 0.44 * (idx / max(1, len(chord) - 1))
            pad_l += (w_a + w_b) * (1.0 - pan)
            pad_r += (w_a + w_b) * pan

        left[i0:i1] += pad_l * env * 0.05
        right[i0:i1] += pad_r * env * 0.05

        # Controlled sub-bass (leaves breathing room during reading holds!)
        root = chord[0] * 0.5
        # Soften bass during the Scene 1 reading hold (5.6s - 7.4s)
        bass_duck = 0.45 if bar_idx == 1 else 1.0
        gate = 0.6 + 0.4 * np.sin(2.0 * np.pi * 2.0 * bt - np.pi / 2.0)
        bass = np.sin(2.0 * np.pi * root * bt) * gate * env * 0.12 * bass_duck
        left[i0:i1] += bass
        right[i0:i1] += bass

    # Subtle stereo plucks during active tech scenes (8.5s to 26.0s)
    arp_notes = [261.63, 311.13, 392.00, 523.25, 466.16, 392.00, 311.13, 293.66]
    step_dur = 0.25  # 8th notes — clean, never cluttered
    for step in range(int(8.5 / step_dur), int(26.0 / step_dur)):
        st0 = step * step_dur
        si0 = int(st0 * sr)
        si1 = min(n_samples, int((st0 + step_dur) * sr))
        st = t[si0:si1] - st0
        note = arp_notes[step % len(arp_notes)]
        a_env = np.exp(-st * 14.0)
        sig = np.sin(2.0 * np.pi * note * st) * a_env * 0.045
        if step % 2 == 0:
            left[si0:si1] += sig * 1.15
            right[si0:si1] += sig * 0.55
        else:
            left[si0:si1] += sig * 0.55
            right[si0:si1] += sig * 1.15

    # Motivated Sound Effects (each tied to a specific editorial event in argus-editorial-plan.json)
    def add_camera_swish(at_sec: float, dur: float = 0.42, pan_dir: float = 0.0) -> None:
        wi0 = max(0, int(at_sec * sr))
        wi1 = min(n_samples, int((at_sec + dur) * sr))
        wt = t[wi0:wi1] - at_sec
        w_env = np.sin(np.pi * wt / dur) ** 2
        sweep = np.sin(2.0 * np.pi * (140.0 + 320.0 * (wt / dur)) * wt)
        sig = sweep * w_env * 0.11
        l_gain = clamp(0.7 - 0.3 * pan_dir)
        r_gain = clamp(0.7 + 0.3 * pan_dir)
        left[wi0:wi1] += sig * l_gain
        right[wi0:wi1] += sig * r_gain

    def add_ui_tone(at_sec: float, freqs: list[float], dur: float = 0.32, gain: float = 0.075) -> None:
        for idx, f_hz in enumerate(freqs):
            ci0 = max(0, int((at_sec + idx * 0.05) * sr))
            ci1 = min(n_samples, ci0 + int(dur * sr))
            ct = t[ci0:ci1] - (at_sec + idx * 0.05)
            c_env = np.exp(-ct * 12.0)
            tone = (np.sin(2.0 * np.pi * f_hz * ct) + 0.25 * np.sin(2.0 * np.pi * f_hz * 2.0 * ct)) * c_env * gain
            left[ci0:ci1] += tone
            right[ci0:ci1] += tone

    # Scene 1 SFX: Message 1 pop (0.85s), Camera 3D angle pivot (2.75s), Message 2 pop (3.55s), Bot Response + Straighten (5.45s), Camera Dive Down (7.55s)
    add_ui_tone(0.85, [523.25, 659.25])
    add_camera_swish(2.75, dur=0.48, pan_dir=0.6)
    add_ui_tone(3.55, [587.33, 783.99])
    add_ui_tone(5.45, [523.25, 659.25, 783.99, 1046.50], dur=0.45, gain=0.08)
    add_camera_swish(7.55, dur=0.55, pan_dir=0.0)

    # Scene 2, 3, 4, 5 transitions & key functional triggers
    add_ui_tone(9.80, [523.25, 659.25, 783.99])  # Gateway unlock cascade
    add_camera_swish(13.40, dur=0.40, pan_dir=-0.5)
    add_ui_tone(15.20, [659.25, 880.00])  # Combo 10% OFF calculation
    add_camera_swish(18.40, dur=0.40, pan_dir=0.5)
    add_ui_tone(19.80, [783.99, 987.77, 1174.66])  # Silia AI LLM activation
    add_camera_swish(23.40, dur=0.40, pan_dir=0.0)
    add_ui_tone(25.20, [523.25, 659.25, 783.99, 1046.50], dur=0.75, gain=0.07)

    # Fade in (0.4s) & Fade out (1.2s)
    fade_in = np.minimum(1.0, t / 0.4)
    fade_out = np.minimum(1.0, (DURATION - t) / 1.2)
    master = fade_in * fade_out

    # Headroom normalization (strictly peaks at 0.85 to guarantee zero clipping for Quality Critic)
    peak = max(1e-6, float(np.max(np.abs(np.stack([left, right])))))
    scale = (0.82 / peak) * master
    left_pcm = np.clip(left * scale * 32767.0, -32767, 32767).astype(np.int16)
    right_pcm = np.clip(right * scale * 32767.0, -32767, 32767).astype(np.int16)

    stereo = np.empty(n_samples * 2, dtype=np.int16)
    stereo[0::2] = left_pcm
    stereo[1::2] = right_pcm

    with wave.open(str(AUDIO_PATH), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(stereo.tobytes())


# =============================================================================
# 5. BUILD 3D SMARTPHONE DISCORD SURFACE & FLOATING 3D MESSAGE BUBBLES
# =============================================================================
def build_phone_base_surface(
    scroll_y: int,
    typing_text: str,
    ideate_btn_active: bool,
) -> Image.Image:
    """
    Renders a crisp 560x1020 Smartphone Chassis with Discord Mobile Dark UI.
    Messages themselves are rendered on separate 3D Z-planes so they pop out in true 3D parallax!
    """
    pw, ph = 560, 1020
    surf = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(surf, "RGBA")

    # Outer metallic titanium rim + inner glass bezel
    d.rounded_rectangle((4, 4, pw - 4, ph - 4), radius=54, fill=(26, 28, 38, 255), outline=(110, 145, 215, 235), width=4)
    d.rounded_rectangle((16, 16, pw - 16, ph - 16), radius=44, fill=(14, 15, 22, 255), outline=(48, 54, 78, 200), width=2)

    # Dynamic Island speaker notch
    d.rounded_rectangle((pw // 2 - 64, 28, pw // 2 + 64, 54), radius=13, fill=(6, 7, 10, 255))
    d.ellipse((pw // 2 + 34, 34, pw // 2 + 48, 48), fill=(18, 28, 48, 255))

    # Discord Mobile Top Channel Bar
    d.rounded_rectangle((24, 68, pw - 24, 128), radius=16, fill=(22, 24, 34, 255), outline=(65, 75, 110, 160), width=1)
    d.ellipse((40, 86, 56, 102), fill=(82, 183, 255, 255))
    d.text((68, 79), "# 🤖・silia-ai", font=FONT_H3, fill=(255, 255, 255, 255))
    d.text((68, 103), "Motor LLM em Tempo Real • Tópicos Privados Automáticos", font=FONT_SMALL, fill=(155, 168, 198, 240))

    # Fixed Bot Panel Header inside the channel (scrolls with scroll_y)
    py = 144 - scroll_y
    if -220 < py < ph - 110:
        d.rounded_rectangle((30, py, pw - 30, py + 175), radius=16, fill=(24, 22, 38, 250), outline=(139, 92, 246, 200), width=2)
        d.rectangle((30, py, 36, py + 175), fill=(139, 92, 246, 255))
        d.text((48, py + 14), "LWX Lab [APP] • Painel Fixo do Canal", font=FONT_BOLD, fill=(168, 127, 251, 255))
        d.text((48, py + 42), "Selecione o modo de operação para iniciar sua sessão:", font=FONT_SMALL, fill=(215, 220, 235, 240))

        # Two Interactive Command Buttons on the mobile panel
        d.rounded_rectangle((46, py + 74, pw - 46, py + 114), radius=10, fill=(58, 70, 175, 235), outline=(120, 140, 255, 190), width=1)
        d.text((66, py + 84), "🤖 Conversar com a Silia AI (Atendimento)", font=FONT_BOLD, fill=(255, 255, 255, 255))

        btn2_fill = (255, 195, 25, 255) if ideate_btn_active else (38, 168, 98, 245)
        btn2_txt = (16, 14, 24, 255) if ideate_btn_active else (255, 255, 255, 255)
        d.rounded_rectangle((46, py + 122, pw - 46, py + 162), radius=10, fill=btn2_fill, outline=(255, 255, 255, 220), width=2)
        d.text((66, py + 132), "✨ Aprimorar Ideia com Silia AI (Briefing)", font=FONT_BOLD, fill=btn2_txt)

    # Bottom Mobile Message Composer Bar
    d.rounded_rectangle((24, ph - 92, pw - 24, ph - 30), radius=24, fill=(25, 28, 40, 255), outline=(82, 183, 255, 180), width=2)
    d.ellipse((36, ph - 78, 68, ph - 46), fill=(45, 52, 74, 255))
    d.text((46, ph - 75), "+", font=FONT_H2, fill=(180, 195, 230, 255))
    shown_typing = typing_text if typing_text else "Enviar mensagem em #🤖・silia-ai..."
    txt_col = (245, 248, 255, 255) if typing_text else (120, 130, 160, 220)
    d.text((82, ph - 71), shown_typing, font=FONT_SMALL, fill=txt_col)
    # Send button icon
    d.ellipse((pw - 74, ph - 79, pw - 36, ph - 43), fill=(82, 183, 255, 255))
    d.polygon([(pw - 60, ph - 69), (pw - 44, ph - 61), (pw - 60, ph - 53)], fill=(12, 15, 24, 255))

    return surf


def build_floating_messages_plane(
    scroll_y: int,
    msg1_prog: float,
    msg2_prog: float,
    bot_prog: float,
) -> Image.Image:
    """
    Builds the 560x1020 plane containing the 3D floating Discord messages.
    Rendered at z_offset = -38 so the bubbles physically hover in 3D space above the phone screen!
    """
    pw, ph = 560, 1020
    surf = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(surf, "RGBA")

    # Message 1 (User request)
    if msg1_prog > 0.01:
        p = ease_out_back(msg1_prog)
        y1 = int(338 - scroll_y + (1.0 - p) * 35)
        alpha = int(255 * clamp(msg1_prog * 1.5))
        d.rounded_rectangle(
            (32, y1, pw - 32, y1 + 118),
            radius=18,
            fill=(30, 36, 56, alpha),
            outline=(82, 183, 255, alpha),
            width=2,
        )
        d.ellipse((48, y1 + 16, 84, y1 + 52), fill=(82, 183, 255, alpha))
        d.text((96, y1 + 14), "Cliente • Agora mesmo", font=FONT_BOLD, fill=(82, 183, 255, alpha))
        d.text(
            (96, y1 + 42),
            "Preciso estruturar um projeto completo e\nsimular um pacote com desconto automático!",
            font=FONT_SMALL,
            fill=(245, 248, 255, alpha),
        )
        d.rounded_rectangle((96, y1 + 84, 345, y1 + 108), radius=8, fill=(82, 183, 255, int(alpha * 0.22)))
        d.text((106, y1 + 88), "⚡ Escuta Ativa no Canal • 0 Comandos /", font=FONT_MONO, fill=(165, 225, 255, alpha))

    # Message 2 (User triggers [Aprimorar Ideia com Silia AI] at opposite 3D angle)
    if msg2_prog > 0.01:
        p = ease_out_back(msg2_prog)
        y2 = int(474 - scroll_y + (1.0 - p) * 35)
        alpha = int(255 * clamp(msg2_prog * 1.5))
        d.rounded_rectangle(
            (32, y2, pw - 32, y2 + 122),
            radius=18,
            fill=(36, 30, 58, alpha),
            outline=(255, 205, 45, alpha),
            width=2,
        )
        d.ellipse((48, y2 + 16, 84, y2 + 52), fill=(255, 205, 45, alpha))
        d.text((96, y2 + 14), "Comando Acionado • [✨ Aprimorar Ideia]", font=FONT_BOLD, fill=(255, 215, 60, alpha))
        d.text(
            (96, y2 + 42),
            "Tópico privado #🔒・silia-cliente criado!\nGerando escopo técnico + cálculo de Combo...",
            font=FONT_SMALL,
            fill=(245, 248, 255, alpha),
        )
        d.rounded_rectangle((96, y2 + 86, 390, y2 + 110), radius=8, fill=(255, 205, 45, int(alpha * 0.22)))
        d.text((106, y2 + 90), "🔒 Thread Privada Isolada • LLM Realtime", font=FONT_MONO, fill=(255, 225, 110, alpha))

    # Message 3 (Bot Response that makes the camera straighten to 0 degrees!)
    if bot_prog > 0.01:
        p = ease_out_back(bot_prog)
        y3 = int(614 - scroll_y + (1.0 - p) * 40)
        alpha = int(255 * clamp(bot_prog * 1.6))
        d.rounded_rectangle(
            (28, y3, pw - 28, y3 + 275),
            radius=20,
            fill=(20, 24, 38, alpha),
            outline=(52, 211, 153, alpha),
            width=3,
        )
        d.rectangle((28, y3, 36, y3 + 275), fill=(52, 211, 153, alpha))
        d.text((50, y3 + 16), "🤖 LWX Lab [APP] • Silia AI Engine", font=FONT_H3, fill=(52, 211, 153, alpha))
        d.text(
            (50, y3 + 48),
            "✅ BRIEFING TÉCNICO & ORÇAMENTO GERADOS:\n"
            "• Escopo estruturado automaticamente pela IA\n"
            "• Simulador de Pacote: 10% OFF aplicado\n"
            "• Rastreador ao vivo: Código #LWX-101 (5 Etapas)",
            font=FONT_SMALL,
            fill=(240, 245, 255, alpha),
        )
        # Interactive action buttons inside the Bot's response
        d.rounded_rectangle((48, y3 + 152, pw - 48, y3 + 196), radius=12, fill=(38, 172, 102, alpha), outline=(255, 255, 255, alpha), width=2)
        d.text((78, y3 + 164), "🎫 Abrir Orçamento Pré-Preenchido (1 Clique)", font=FONT_BOLD, fill=(255, 255, 255, alpha))

        d.rounded_rectangle((48, y3 + 208, pw - 48, y3 + 252), radius=12, fill=(44, 54, 88, alpha), outline=(82, 183, 255, alpha), width=1)
        d.text((92, y3 + 220), "📦 Rastrear Pedido #LWX-101 em Tempo Real", font=FONT_BOLD, fill=(165, 225, 255, alpha))

    return surf


# =============================================================================
# 6. RENDER FULL 28-SECOND MOTION DESIGN SHOWCASE
# =============================================================================
def render_video() -> None:
    print("1/3 Sintetizando trilha sonora eletronica e sound design motivado...", flush=True)
    synthesize_soundtrack()

    print("2/3 Preparando motor 3D de perspectiva homografica e camadas UI...", flush=True)
    # Pre-build clean dark tech background with subtle perspective grid
    y_grid, x_grid = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W * 0.5, H * 0.45
    dist = np.sqrt(((x_grid - cx) / W) ** 2 + ((y_grid - cy) / H) ** 2)
    bg_arr = np.zeros((H, W, 3), dtype=np.uint8)
    bg_arr[:, :, 0] = np.clip(16 - dist * 10, 8, 22).astype(np.uint8)
    bg_arr[:, :, 1] = np.clip(18 - dist * 10, 9, 25).astype(np.uint8)
    bg_arr[:, :, 2] = np.clip(30 - dist * 14, 15, 38).astype(np.uint8)
    bg_base = Image.fromarray(bg_arr, mode="RGB").convert("RGBA")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg_exe,
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-s",
        f"{W}x{H}",
        "-pix_fmt",
        "rgb24",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-i",
        str(AUDIO_PATH),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-loglevel",
        "error",
        str(VIDEO_PATH),
    ]

    print("3/3 Renderizando 840 frames (1280x720 @ 30fps) com camera 3D...", flush=True)
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert proc.stdin is not None

    for f_idx in range(TOTAL_FRAMES):
        sec = f_idx / float(FPS)
        canvas = bg_base.copy()
        draw = ImageDraw.Draw(canvas, "RGBA")

        # Subtle moving technical coordinate grid (Motion Graphics style)
        grid_shift = int((sec * 36.0) % 64)
        for gx in range(-grid_shift, W, 64):
            draw.line((gx, 0, gx, H), fill=(82, 183, 255, 14), width=1)
        for gy in range(-grid_shift, H, 64):
            draw.line((0, gy, W, gy), fill=(139, 92, 246, 14), width=1)

        # Top Minimalist Telemetry Bar (strictly functional/tech info)
        draw_card(draw, (32, 18, W - 32, 58), (16, 19, 30, 220), (82, 183, 255, 95), radius=10, width=1)
        draw.ellipse((50, 32, 62, 44), fill=(52, 211, 153, 255))
        draw.text((74, 28), "LWX LAB BOT // ARQUITETURA, COMANDOS & TECNOLOGIAS", font=FONT_MONO, fill=(230, 238, 255, 255))
        phase_tag = (
            "01 // INTERAÇÃO 3D MOBILE & RESPOSTA INSTANTÂNEA"
            if sec < 8.5
            else "02 // AUTOMAÇÃO DE CANAIS & ZERO COMANDOS /"
            if sec < 13.5
            else "03 // VITRINE INTERATIVA & CALCULADORA COMBO 10% OFF"
            if sec < 18.5
            else "04 // SILIA AI ENGINE (LLM REALTIME & THREADS PRIVADAS)"
            if sec < 23.5
            else "05 // RASTREIO EM 5 ETAPAS (#LWX-101) & ECOSSISTEMA"
        )
        draw.text((W - 455, 28), phase_tag, font=FONT_MONO, fill=(82, 183, 255, 240))

        # =====================================================================
        # SCENE 1 (0.0s - 8.5s): CLASSIC 3D MOBILE DISCORD CONVERSATION
        # Angle 1 (Left Tilt) -> Camera Moves Down to Angle 2 (Opposite Tilt)
        # -> Bot Responds & Camera Straightens (0 deg) -> Dives Down to Scene 2
        # =====================================================================
        if sec < 8.5:
            # Determine 3D Camera Pose (yaw, pitch, roll, tx, ty, tz) & internal phone scroll
            if sec < 2.8:
                # Shot 1A: Camera enters and tracks Message 1 from a dramatic 3D left angle
                p_in = ease_out_expo(sec / 0.85)
                yaw = lerp(38.0, 26.0, p_in)
                pitch = lerp(-24.0, -15.0, p_in)
                roll = lerp(-9.0, -5.0, p_in)
                tx = lerp(240.0, 175.0, p_in)
                ty = lerp(190.0, 115.0, p_in)
                tz = lerp(80.0, -145.0, p_in)
                scroll_y = 0
            elif sec < 5.4:
                # Shot 1B: Camera moves down and pivots to the opposite 3D angle for Message 2
                p_piv = ease_in_out_expo((sec - 2.8) / 0.85)
                yaw = lerp(26.0, -25.0, p_piv)
                pitch = lerp(-15.0, -13.0, p_piv)
                roll = lerp(-5.0, 5.0, p_piv)
                tx = lerp(175.0, -175.0, p_piv)
                ty = lerp(115.0, 25.0, p_piv)
                tz = lerp(-145.0, -155.0, p_piv)
                scroll_y = int(lerp(0.0, 120.0, p_piv))
            elif sec < 7.5:
                # Shot 1C (Part 1): Bot responds -> Camera straightens completely (0 deg) for reading!
                p_str = ease_in_out_expo((sec - 5.4) / 0.75)
                yaw = lerp(-25.0, 0.0, p_str)
                pitch = lerp(-13.0, 0.0, p_str)
                roll = lerp(5.0, 0.0, p_str)
                tx = lerp(-175.0, 0.0, p_str)
                ty = lerp(25.0, -85.0, p_str)
                tz = lerp(-155.0, -90.0, p_str)
                scroll_y = int(lerp(120.0, 265.0, p_str))
            else:
                # Shot 1C (Part 2): Camera dives straight down to reveal the rest of the video!
                p_dive = ease_in_out_expo((sec - 7.5) / 1.0)
                yaw = 0.0
                pitch = lerp(0.0, 14.0, p_dive)
                roll = 0.0
                tx = 0.0
                ty = lerp(-85.0, -980.0, p_dive)
                tz = lerp(-90.0, -240.0, p_dive)
                scroll_y = 265

            # Typing simulation & message progress
            typing_str = ""
            if sec < 0.85:
                full_t1 = "Preciso estruturar um projeto e simular combo..."
                typing_str = full_t1[: int(len(full_t1) * clamp(sec / 0.75))]
            elif 2.85 <= sec < 3.55:
                full_t2 = "Ativar modo [Aprimorar Ideia com Silia AI]..."
                typing_str = full_t2[: int(len(full_t2) * clamp((sec - 2.85) / 0.65))]

            msg1_p = clamp((sec - 0.85) / 0.45)
            msg2_p = clamp((sec - 3.55) / 0.45)
            bot_p = clamp((sec - 5.45) / 0.50)

            phone_base = build_phone_base_surface(scroll_y, typing_str, ideate_btn_active=(sec >= 3.2))
            phone_msgs = build_floating_messages_plane(scroll_y, msg1_p, msg2_p, bot_p)

            # Project 3D Phone Base (z=0) and 3D Floating Messages (z=-42 for genuine 3D parallax!)
            warped_phone = warp_plane_3d(phone_base, yaw, pitch, roll, tx, ty, tz, z_offset=0.0)
            warped_msgs = warp_plane_3d(phone_msgs, yaw, pitch, roll, tx, ty, tz, z_offset=-42.0)

            canvas = Image.alpha_composite(canvas, warped_phone)
            canvas = Image.alpha_composite(canvas, warped_msgs)
            draw = ImageDraw.Draw(canvas, "RGBA")

            # Kinetic Typography Callouts synchronized with the 3D camera angles
            if sec < 2.8:
                draw_kinetic_mask_title(
                    draw,
                    48,
                    125,
                    "ÂNGULO 01 // SOLICITAÇÃO NO CANAL",
                    "ATENDIMENTO SEM COMANDOS /",
                    "O membro interage direto nos botões ou envia sua\ndúvida sem precisar decorar sintaxe de comandos.",
                    sec / 0.8,
                    accent=(82, 183, 255),
                )
            elif sec < 5.4:
                draw_kinetic_mask_title(
                    draw,
                    690,
                    125,
                    "ÂNGULO 02 // ACIONAMENTO DE IA",
                    "MODO APRIMORAR IDEIA",
                    "Ao tocar no botão, o bot cria uma thread privada\ne ativa o motor LLM para estruturar o projeto.",
                    (sec - 2.8) / 0.8,
                    accent=(255, 205, 45),
                )
            elif sec < 7.7:
                p_banner = ease_out_expo(clamp((sec - 5.45) / 0.5))
                bx = int(42 - (1.0 - p_banner) * 120)
                draw_card(draw, (bx, 108, bx + 330, 295), (18, 24, 38, 235), (52, 211, 153, 220), radius=16, width=2)
                draw.text((bx + 20, 126), "03 // RESPOSTA AUTOMÁTICA", font=FONT_MONO, fill=(52, 211, 153, 255))
                draw.text((bx + 20, 152), "CÂMERA ALINHADA", font=FONT_H2, fill=(255, 255, 255, 255))
                draw.text(
                    (bx + 20, 188),
                    "• Escopo Técnico estruturado\n• Desconto de Combo calculado\n• Botão de Ticket pré-preenchido\n• Código de rastreio #LWX-101",
                    font=FONT_SMALL,
                    fill=(210, 222, 245, 245),
                )

        # =====================================================================
        # SCENE 2 (8.5s - 13.5s): AUTONOMOUS CHANNEL ARCHITECTURE (ZERO SLASH)
        # =====================================================================
        elif sec < 13.5:
            st = sec - 8.5
            # Arrives from downward camera dive (whip-pan entry from top)
            enter = ease_out_expo(min(1.0, st / 0.65))

            draw_kinetic_mask_title(
                draw,
                52,
                88,
                "SISTEMA 01 // ARQUITETURA DE SERVIDOR",
                "ZERO COMANDOS / • 8 PAINÉIS AUTÔNOMOS",
                "Cada funcionalidade opera fixada no topo do seu respectivo canal com limpeza automática de mensagens.",
                st / 0.7,
                accent=(82, 183, 255),
            )

            # Build a 3D Plane showing the 8 Autonomous Channels + Credential Gateway
            plane = Image.new("RGBA", (1120, 460), (0, 0, 0, 0))
            pd = ImageDraw.Draw(plane, "RGBA")

            # Left Panel: Credential Gateway (#registre-se)
            draw_card(pd, (10, 10, 450, 445), (20, 24, 38, 248), (82, 183, 255, 225), radius=20, width=2)
            pd.text((34, 32), "🛡️ GATEWAY DE CREDENCIAL (#✅・registre-se)", font=FONT_H3, fill=(82, 183, 255, 255))
            pd.text(
                (34, 66),
                "• Servidor 100% oculto para novos membros (@everyone)\n"
                "• Desbloqueio instantâneo em 1 clique\n"
                "• Atribuição automática de cargos de acesso e ping\n"
                "• Gerador de Cartão de Credencial com ID e data",
                font=FONT_SMALL,
                fill=(220, 228, 248, 245),
            )
            unlocked = st >= 1.25
            btn_col = (42, 185, 110, 255) if unlocked else (58, 72, 185, 255)
            draw_card(pd, (34, 185, 426, 242), btn_col, (255, 255, 255, 235), radius=14, width=2)
            pd.text(
                (68, 202),
                "✅ ACESSO LIBERADO • CARGOS ATRIBUÍDOS" if unlocked else "🔓 Liberar Acesso ao Servidor (1 Clique)",
                font=FONT_BOLD,
                fill=(255, 255, 255, 255),
            )

            # Auto-Clean Technology Box
            draw_card(pd, (34, 265, 426, 420), (14, 18, 28, 245), (139, 92, 246, 190), radius=14, width=1)
            pd.text((52, 282), "⚙️ MOTOR AUTO-CLEAN DE CANAIS", font=FONT_BOLD, fill=(168, 127, 251, 255))
            pd.text(
                (52, 312),
                "Remove automaticamente mensagens antigas e\nmantém apenas o painel interativo oficial no\ntopo de cada canal operacional.",
                font=FONT_SMALL,
                fill=(195, 205, 230, 240),
            )

            # Right Panel: The 8 Dedicated Channel Modules unlocking in cascade
            draw_card(pd, (475, 10, 1110, 445), (20, 24, 38, 248), (139, 92, 246, 220), radius=20, width=2)
            pd.text((502, 32), "📡 8 CANAIS OPERACIONAIS COM PAINEL EXCLUSIVO", font=FONT_H3, fill=(255, 255, 255, 255))

            channels_tech = [
                ("#✅・registre-se", "Gateway de Acesso, Cargos de Ping & Cartão de Membro"),
                ("#📜・regras-e-termos", "Aceite de Termos, FAQ Interativo & Simulador"),
                ("#👋・boas-vindas", "Recepção Automática em Tempo Real & Atalhos"),
                ("#🖼️・portfólio", "Vitrine Paginada, Filtros de Categoria & Quick-Jump"),
                ("#💰・tabela-de-preços", "Inspeção de Serviços & Calculadora de Combo 10% OFF"),
                ("#✍️・avaliar", "Sistema de Notas em 1 Clique (5★) & Modal de Review"),
                ("#🎫・fazer-orçamento", "Abertura de Ticket, Gerador HEX & Tracker 5 Etapas"),
                ("#🤖・silia-ai", "Motor LLM em Tempo Real & Tópicos Privados"),
            ]
            for idx, (ch_name, ch_fn) in enumerate(channels_tech):
                row_y = 74 + idx * 45
                active_row = st >= (0.8 + idx * 0.14)
                r_bg = (30, 44, 68, 240) if active_row else (24, 26, 38, 180)
                r_bd = (52, 211, 153, 220) if active_row else (75, 85, 115, 110)
                draw_card(pd, (502, row_y, 1085, row_y + 38), r_bg, r_bd, radius=9, width=1)
                status_ico = "🟢 ATIVO" if active_row else "🔒 LOCK"
                pd.text((516, row_y + 9), f"{status_ico}  {ch_name}", font=FONT_MONO, fill=(82, 183, 255, 255))
                pd.text((735, row_y + 9), ch_fn, font=FONT_SMALL, fill=(230, 236, 250, 245))

            yaw_s2 = lerp(0.0, -11.0, ease_in_out_expo(st / 2.5)) + 3.0 * math.sin(st * 1.4)
            pitch_s2 = lerp(-12.0, 5.0, enter)
            ty_s2 = lerp(420.0, 75.0, enter)
            warped_s2 = warp_plane_3d(plane, yaw_s2, pitch_s2, -1.5, tx=0.0, ty=ty_s2, tz=-40.0)
            canvas = Image.alpha_composite(canvas, warped_s2)

        # =====================================================================
        # SCENE 3 (13.5s - 18.5s): INTERACTIVE PORTFOLIO & COMBO CALCULATOR
        # =====================================================================
        elif sec < 18.5:
            st = sec - 13.5
            enter = ease_out_expo(min(1.0, st / 0.65))

            draw_kinetic_mask_title(
                draw,
                52,
                88,
                "SISTEMA 02 // MOTORES DE NAVEGAÇÃO & CÁLCULO",
                "VITRINE DINÂMICA & SIMULADOR DE COMBO (10% OFF)",
                "Navegação filtrada por categoria sem sair do canal e cálculo automático de pacotes com desconto progressivo.",
                st / 0.7,
                accent=(168, 127, 251),
            )

            plane3 = Image.new("RGBA", (1120, 460), (0, 0, 0, 0))
            p3d = ImageDraw.Draw(plane3, "RGBA")

            # Left 3D Module: Interactive Portfolio Engine
            draw_card(p3d, (10, 10, 540, 445), (20, 24, 38, 248), (82, 183, 255, 220), radius=20, width=2)
            p3d.text((34, 30), "🖼️ MOTOR DE PORTFÓLIO INTERATIVO", font=FONT_H3, fill=(82, 183, 255, 255))
            p3d.text(
                (34, 64),
                "• Paginação instantânea (◀ Anterior / Próxima ▶)\n"
                "• Filtros dinâmicos: Todos, Banners, Logos, UI & Packs\n"
                "• StringSelectMenu para salto direto a qualquer projeto\n"
                "• Botão [Encomendar Neste Estilo] integrado ao Modal",
                font=FONT_SMALL,
                fill=(220, 228, 248, 245),
            )

            # Interactive Filter Pills simulation
            cats = ["Todos (11)", "Banners HD", "Logos & ID", "Ilustração", "Packs & Bots"]
            active_cat = int((st * 1.4) % len(cats))
            for c_i, c_lbl in enumerate(cats):
                cx_p = 34 + (c_i % 3) * 162
                cy_p = 175 + (c_i // 3) * 46
                is_sel = c_i == active_cat
                draw_card(
                    p3d,
                    (cx_p, cy_p, cx_p + 150, cy_p + 36),
                    (82, 183, 255, 245) if is_sel else (32, 38, 58, 220),
                    (255, 255, 255, 230) if is_sel else (82, 183, 255, 120),
                    radius=10,
                    width=1,
                )
                p3d.text(
                    (cx_p + 16, cy_p + 8),
                    c_lbl,
                    font=FONT_BOLD,
                    fill=(12, 16, 26, 255) if is_sel else (225, 232, 250, 240),
                )

            draw_card(p3d, (34, 285, 516, 420), (14, 18, 28, 245), (52, 211, 153, 200), radius=14, width=2)
            p3d.text((52, 302), "🔗 INTEGRAÇÃO DIRETA VITRINE -> TICKET", font=FONT_BOLD, fill=(52, 211, 153, 255))
            p3d.text(
                (52, 332),
                "Ao clicar em [Encomendar Neste Estilo], o bot captura\no ID do projeto atual e abre o modal já preenchido\ncom a categoria, referência e faixa de valor.",
                font=FONT_SMALL,
                fill=(205, 218, 240, 240),
            )

            # Right 3D Module: Real-Time Combo & Price Simulator
            draw_card(p3d, (565, 10, 1110, 445), (20, 24, 38, 248), (52, 211, 153, 225), radius=20, width=2)
            p3d.text((590, 30), "🧮 CALCULADORA DE PACOTES & COMBO (10% OFF)", font=FONT_H3, fill=(52, 211, 153, 255))
            p3d.text(
                (590, 64),
                "Seleção múltipla via menu interativo com cálculo em\ntempo real de subtotal, desconto de combo e prazo:",
                font=FONT_SMALL,
                fill=(220, 228, 248, 245),
            )

            sim_items = [
                ("☑️ Banner & Header HD", "R$ 20", "1 a 2 dias"),
                ("☑️ Logo & Identidade", "R$ 30", "1 a 3 dias"),
                ("☑️ Bot Discord Sob Medida", "R$ 70", "3 a 7 dias"),
            ]
            for s_i, (s_name, s_val, s_time) in enumerate(sim_items):
                sy_i = 122 + s_i * 52
                draw_card(p3d, (590, sy_i, 1085, sy_i + 42), (30, 38, 58, 240), (82, 183, 255, 170), radius=10, width=1)
                p3d.text((608, sy_i + 10), s_name, font=FONT_BOLD, fill=(255, 255, 255, 255))
                p3d.text((875, sy_i + 10), s_val, font=FONT_H3, fill=(82, 183, 255, 255))
                p3d.text((975, sy_i + 12), s_time, font=FONT_SMALL, fill=(175, 190, 220, 240))

            # Animated Combo Math Result Box
            calc_ready = st >= 1.3
            draw_card(
                p3d,
                (590, 290, 1085, 420),
                (22, 48, 42, 250) if calc_ready else (26, 30, 46, 230),
                (255, 205, 45, 240) if calc_ready else (82, 183, 255, 150),
                radius=14,
                width=2,
            )
            p3d.text((612, 306), "⚡ RESULTADO DO SIMULADOR AUTOMÁTICO:", font=FONT_BOLD, fill=(255, 215, 60, 255))
            p3d.text(
                (612, 336),
                "Subtotal (3 serviços): R$ 120,00  |  Desconto Combo (-10%): -R$ 12,00",
                font=FONT_SMALL,
                fill=(220, 235, 245, 245),
            )
            p3d.text(
                (612, 368),
                "VALOR FINAL COMBO: R$ 108,00   [Abrir Pedido com Este Pacote]",
                font=FONT_H3,
                fill=(52, 211, 153, 255),
            )

            yaw_s3 = lerp(18.0, 9.0, enter)
            pitch_s3 = lerp(-10.0, -4.0, enter)
            tx_s3 = lerp(220.0, 0.0, enter)
            warped_s3 = warp_plane_3d(plane3, yaw_s3, pitch_s3, 1.5, tx=tx_s3, ty=75.0, tz=-35.0)
            canvas = Image.alpha_composite(canvas, warped_s3)

        # =====================================================================
        # SCENE 4 (18.5s - 23.5s): SILIA AI REALTIME LLM & PRIVATE THREAD ENGINE
        # =====================================================================
        elif sec < 23.5:
            st = sec - 18.5
            enter = ease_out_expo(min(1.0, st / 0.65))

            draw_kinetic_mask_title(
                draw,
                52,
                88,
                "SISTEMA 03 // INTELIGÊNCIA ARTIFICIAL INTEGRADA",
                "SILIA AI • MOTOR LLM EM TEMPO REAL & THREADS PRIVADAS",
                "Dois modos dedicados de operação com criação automática de tópicos privados e geração de briefing técnico.",
                st / 0.7,
                accent=(255, 205, 45),
            )

            # Base 3D Plane + Foreground 3D Parallax Plane for the AI Pipeline
            plane4_base = Image.new("RGBA", (1120, 460), (0, 0, 0, 0))
            p4d = ImageDraw.Draw(plane4_base, "RGBA")

            draw_card(p4d, (10, 10, 1110, 445), (18, 22, 36, 245), (255, 205, 45, 210), radius=22, width=2)
            p4d.text((38, 30), "🤖 ARQUITETURA DO SUBSISTEMA SILIA AI (src/systems/silia.ts + src/ai/chatbot.ts)", font=FONT_H3, fill=(255, 215, 60, 255))

            # 3 Pipeline Columns
            cols = [
                (
                    "1. ESCOLHA DE MODO (BOTÕES)",
                    "• [Conversar com a Silia AI]\n  Modo livre para tirar dúvidas\n  técnicas, prazos e funcionamento.\n\n"
                    "• [Aprimorar Ideia com Silia AI]\n  Modo consultoria que entrevista\n  o usuário e estrutura o escopo.",
                    (82, 183, 255),
                ),
                (
                    "2. ISOLAMENTO EM TÓPICO PRIVADO",
                    "• Cria automaticamente a thread\n  privada #🔒・silia-usuario\n  exclusiva para aquele membro.\n\n"
                    "• Ativa escuta direta por 30 min:\n  qualquer mensagem enviada é\n  processada sem comandos extras.",
                    (168, 127, 251),
                ),
                (
                    "3. MOTOR LLM & EXPORTAÇÃO",
                    "• Conexão LLM em tempo real com\n  fallback automático multi-modelo\n  e memória de contexto por sessão.\n\n"
                    "• Botão [Abrir Orçamento com Ideia]\n  transfere o briefing direto para\n  o modal de criação de ticket!",
                    (52, 211, 153),
                ),
            ]
            for c_idx, (c_title, c_body, c_col) in enumerate(cols):
                cx0 = 36 + c_idx * 356
                draw_card(p4d, (cx0, 82, cx0 + 336, 418), (24, 30, 48, 245), (c_col[0], c_col[1], c_col[2], 215), radius=16, width=2)
                p4d.rectangle((cx0, 82, cx0 + 336, 90), fill=(c_col[0], c_col[1], c_col[2], 255))
                p4d.text((cx0 + 20, 108), c_title, font=FONT_BOLD, fill=(c_col[0], c_col[1], c_col[2], 255))
                p4d.text((cx0 + 20, 150), c_body, font=FONT_SMALL, fill=(225, 232, 250, 245))

            yaw_s4 = lerp(-18.0, -9.0, enter)
            pitch_s4 = lerp(10.0, -4.0, enter)
            tx_s4 = lerp(-220.0, 0.0, enter)
            warped_s4 = warp_plane_3d(plane4_base, yaw_s4, pitch_s4, -1.2, tx=tx_s4, ty=75.0, tz=-35.0)
            canvas = Image.alpha_composite(canvas, warped_s4)

        # =====================================================================
        # SCENE 5 (23.5s - 28.0s): 5-STAGE ORDER TRACKER, HEX ENGINE & FINALE
        # =====================================================================
        else:
            st = sec - 23.5
            enter = ease_out_expo(min(1.0, st / 0.60))

            draw_kinetic_mask_title(
                draw,
                52,
                88,
                "SISTEMA 04 // GESTÃO PÓS-PEDIDO & TRANSPARÊNCIA",
                "RASTREADOR EM 5 ETAPAS (#LWX-101) • GERADOR HEX • AVALIAÇÕES 5★",
                "Acompanhamento de produção em tempo real por código único, gerador de paletas técnicas e mural de feedback.",
                st / 0.65,
                accent=(52, 211, 153),
            )

            plane5 = Image.new("RGBA", (1120, 460), (0, 0, 0, 0))
            p5d = ImageDraw.Draw(plane5, "RGBA")

            draw_card(p5d, (10, 10, 1110, 445), (18, 22, 36, 248), (82, 183, 255, 225), radius=22, width=2)

            prog_pct = min(100, int(20 + clamp(st / 2.2) * 80))
            stage_idx = min(4, int((prog_pct - 1) / 20))
            stages = [
                ("1/5 • Briefing", "Escopo Validado"),
                ("2/5 • Estrutura", "Wireframe & Base"),
                ("3/5 • Produção", "Desenvolvimento"),
                ("4/5 • Revisão", "Ajustes Finais"),
                ("5/5 • Entrega", "Pacote Finalizado"),
            ]

            p5d.text((38, 28), f"📦 RASTREADOR DE PEDIDO EM TEMPO REAL • CÓDIGO #LWX-101 ({prog_pct}%)", font=FONT_H2, fill=(255, 255, 255, 255))

            # Animated Progress Bar
            bx0, by0, bw0, bh0 = 38, 76, 1044, 28
            draw_card(p5d, (bx0, by0, bx0 + bw0, by0 + bh0), (12, 15, 24, 255), (82, 183, 255, 140), radius=14, width=1)
            fill_w = max(28, int(bw0 * (prog_pct / 100.0)))
            draw_card(p5d, (bx0, by0, bx0 + fill_w, by0 + bh0), (52, 211, 153, 255), (210, 255, 235, 255), radius=14, width=2)

            # 5 Stage Cards horizontally
            for s_i, (s_head, s_sub) in enumerate(stages):
                sx0 = 38 + s_i * 212
                done = s_i <= stage_idx
                draw_card(
                    p5d,
                    (sx0, 122, sx0 + 196, 215),
                    (26, 52, 54, 245) if done else (24, 28, 42, 190),
                    (52, 211, 153, 235) if done else (75, 85, 115, 110),
                    radius=12,
                    width=2 if s_i == stage_idx else 1,
                )
                p5d.text((sx0 + 14, 138), s_head, font=FONT_BOLD, fill=(52, 211, 153, 255) if done else (150, 160, 185, 220))
                p5d.text((sx0 + 14, 168), s_sub, font=FONT_SMALL, fill=(235, 242, 255, 245) if done else (130, 140, 165, 200))

            # Bottom Summary Row: Ticket Engine + HEX Generator + 5-Star Review System + Final Stack CTA
            draw_card(p5d, (38, 238, 545, 420), (24, 30, 48, 245), (168, 127, 251, 210), radius=16, width=2)
            p5d.text((58, 256), "🎨 GERADOR DE PALETAS HEX & TICKETS PRIVADOS", font=FONT_BOLD, fill=(168, 127, 251, 255))
            p5d.text(
                (58, 286),
                "• Geração instantânea de paletas com códigos HEX\n"
                "• Criação de canais de ticket isolados por cliente\n"
                "• Sistema de avaliações em 1 clique (5★ / 4★ / 3★)",
                font=FONT_SMALL,
                fill=(220, 228, 248, 245),
            )

            draw_card(p5d, (568, 238, 1082, 420), (24, 34, 58, 250), (82, 183, 255, 235), radius=16, width=2)
            p5d.text((592, 256), "⚡ LWX LAB BOT • STACK TECNOLÓGICA COMPLETA", font=FONT_BOLD, fill=(82, 183, 255, 255))
            p5d.text(
                (592, 288),
                "TypeScript • Discord.js v14 • Silia AI LLM Realtime\n"
                "8 Painéis Autônomos • Simulador Combo • Tracker 5 Etapas",
                font=FONT_SMALL,
                fill=(235, 242, 255, 245),
            )
            draw_card(p5d, (592, 350, 1058, 400), (42, 185, 110, 255), (255, 255, 255, 240), radius=12, width=2)
            p5d.text((645, 364), "🚀 100% OPERACIONAL E ATIVO NO SERVIDOR", font=FONT_BOLD, fill=(255, 255, 255, 255))

            yaw_s5 = lerp(10.0, 0.0, enter)
            pitch_s5 = lerp(-6.0, 0.0, enter)
            warped_s5 = warp_plane_3d(plane5, yaw_s5, pitch_s5, 0.0, tx=0.0, ty=75.0, tz=lerp(-80.0, -25.0, enter))
            canvas = Image.alpha_composite(canvas, warped_s5)

        rgb_bytes = canvas.convert("RGB").tobytes()
        proc.stdin.write(rgb_bytes)
        if (f_idx + 1) % 140 == 0 or (f_idx + 1) == TOTAL_FRAMES:
            print(f"   -> Frame {f_idx + 1}/{TOTAL_FRAMES} ({int((f_idx + 1) * 100 / TOTAL_FRAMES)}%)", flush=True)

    proc.stdin.close()
    proc.wait()

    if VIDEO_PATH.exists():
        shutil.copyfile(VIDEO_PATH, ARTIFACT_VIDEO_PATH)
        print(f"[OK] Video Motion Design 3D renderizado com sucesso: {VIDEO_PATH} ({VIDEO_PATH.stat().st_size // 1024} KB)", flush=True)
    else:
        raise RuntimeError("Falha ao renderizar video 3D.")


if __name__ == "__main__":
    render_video()
