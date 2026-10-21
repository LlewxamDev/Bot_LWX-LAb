import math
import subprocess
import wave
from pathlib import Path
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "showcase"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIDEO_PATH = OUT_DIR / "lwx-lab-motion-showcase.mp4"
AUDIO_PATH = OUT_DIR / "lwx-lab-soundtrack.wav"
ARTIFACT_DIR = Path(r"C:\Users\Evandro\.gemini\antigravity\brain\84a05893-5ab6-4635-be21-b20898d8fcb6")
ARTIFACT_VIDEO_PATH = ARTIFACT_DIR / "lwx_lab_motion_showcase.mp4"

W, H = 1280, 720
FPS = 30
DURATION = 28.0
TOTAL_FRAMES = int(DURATION * FPS)


def ease_out_cubic(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1.0 - (1.0 - t) ** 3


def ease_out_back(t: float, s: float = 1.45) -> float:
    t = max(0.0, min(1.0, t))
    t -= 1.0
    return t * t * ((s + 1.0) * t + s) + 1.0


def ease_in_out_cubic(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 4.0 * t * t * t if t < 0.5 else 1.0 - ((-2.0 * t + 2.0) ** 3) / 2.0


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        [
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\bahnschrift.ttf",
        ]
        if bold
        else [
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf",
        ]
    )
    for c in candidates:
        if Path(c).exists():
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


FONT_HERO = load_font(56, True)
FONT_H1 = load_font(42, True)
FONT_H2 = load_font(28, True)
FONT_H3 = load_font(22, True)
FONT_BODY = load_font(18, False)
FONT_BOLD = load_font(18, True)
FONT_SMALL = load_font(15, False)
FONT_TAG = load_font(14, True)


def synthesize_soundtrack() -> None:
    """Synthesizes a 28-second stereo dark-synthwave soundtrack + synchronized motion SFX."""
    sr = 44100
    n_samples = int(DURATION * sr)
    t = np.linspace(0.0, DURATION, n_samples, endpoint=False)

    left = np.zeros(n_samples, dtype=np.float64)
    right = np.zeros(n_samples, dtype=np.float64)

    # 1. Chord progression (Dark Synthwave in C minor: Cm9 -> Abmaj7 -> Fm7 -> G7sus4)
    # 4-second bars
    chords = [
        [130.81, 155.56, 196.00, 233.08, 293.66],  # Cm9
        [103.83, 130.81, 155.56, 196.00, 261.63],  # Abmaj7
        [87.31, 130.81, 155.56, 207.65, 261.63],   # Fm9
        [98.00, 130.81, 146.83, 196.00, 246.94],   # G7sus4
    ]

    for bar_idx in range(7):
        t0 = bar_idx * 4.0
        t1 = min(DURATION, (bar_idx + 1) * 4.0)
        i0, i1 = int(t0 * sr), int(t1 * sr)
        bt = t[i0:i1] - t0
        chord = chords[bar_idx % len(chords)]

        env = np.minimum(1.0, bt / 0.25) * np.minimum(1.0, (4.0 - bt) / 0.35)
        pad_l = np.zeros_like(bt)
        pad_r = np.zeros_like(bt)
        for idx, freq in enumerate(chord):
            detune = 1.002 if idx % 2 == 0 else 0.998
            wave_a = np.sin(2.0 * np.pi * freq * bt)
            wave_b = 0.5 * np.sin(2.0 * np.pi * (freq * detune) * bt + 0.6)
            pan = 0.3 + 0.4 * (idx / max(1, len(chord) - 1))
            pad_l += (wave_a + wave_b) * (1.0 - pan)
            pad_r += (wave_a + wave_b) * pan

        left[i0:i1] += pad_l * env * 0.055
        right[i0:i1] += pad_r * env * 0.055

        # Deep sub-bass pulse (8th notes at 120 BPM -> every 0.25s)
        root_bass = chord[0] * 0.5
        bass_gate = 0.55 + 0.45 * np.sin(2.0 * np.pi * 4.0 * bt - np.pi / 2.0)
        bass_sig = (
            np.sin(2.0 * np.pi * root_bass * bt)
            + 0.35 * np.tanh(2.5 * np.sin(2.0 * np.pi * root_bass * 2.0 * bt))
        ) * bass_gate * env * 0.14
        left[i0:i1] += bass_sig
        right[i0:i1] += bass_sig

    # 2. Synth Arpeggio + Soft Electronic Beat (from 4.0s to 26.0s)
    arp_notes = [261.63, 311.13, 392.00, 523.25, 466.16, 392.00, 311.13, 293.66]
    step_dur = 0.125  # 16th notes at 120 BPM
    for step in range(int(4.0 / step_dur), int(26.0 / step_dur)):
        st0 = step * step_dur
        si0 = int(st0 * sr)
        si1 = min(n_samples, int((st0 + step_dur) * sr))
        st = t[si0:si1] - st0
        note = arp_notes[step % len(arp_notes)]
        a_env = np.exp(-st * 18.0)
        arp_sig = np.sin(2.0 * np.pi * note * st) * a_env * 0.05
        if step % 2 == 0:
            left[si0:si1] += arp_sig * 1.2
            right[si0:si1] += arp_sig * 0.5
        else:
            left[si0:si1] += arp_sig * 0.5
            right[si0:si1] += arp_sig * 1.2

    # Kick drum every 0.5s between 4.5s and 25.5s
    for k_time in np.arange(4.5, 25.5, 0.5):
        ki0 = int(k_time * sr)
        ki1 = min(n_samples, ki0 + int(0.18 * sr))
        kt = t[ki0:ki1] - k_time
        k_freq = 52.0 + 110.0 * np.exp(-kt * 38.0)
        k_sig = np.sin(2.0 * np.pi * k_freq * kt) * np.exp(-kt * 16.0) * 0.22
        left[ki0:ki1] += k_sig
        right[ki0:ki1] += k_sig

    # 3. Synchronized Motion Design SFX
    def add_whoosh(at_sec: float, dur: float = 0.38) -> None:
        wi0 = max(0, int(at_sec * sr))
        wi1 = min(n_samples, int((at_sec + dur) * sr))
        wt = t[wi0:wi1] - at_sec
        rng = np.random.default_rng(int(at_sec * 100))
        noise = rng.normal(0, 1, len(wt))
        w_env = np.sin(np.pi * wt / dur) ** 2
        sweep = np.sin(2.0 * np.pi * (180.0 + 420.0 * (wt / dur)) * wt)
        sig = (noise * 0.35 + sweep * 0.65) * w_env * 0.14
        left[wi0:wi1] += sig
        right[wi0:wi1] += sig

    def add_chime(at_sec: float, freqs: list[float], dur: float = 0.45) -> None:
        for idx, f_hz in enumerate(freqs):
            ci0 = max(0, int((at_sec + idx * 0.055) * sr))
            ci1 = min(n_samples, ci0 + int(dur * sr))
            ct = t[ci0:ci1] - (at_sec + idx * 0.055)
            c_sig = (
                np.sin(2.0 * np.pi * f_hz * ct)
                + 0.4 * np.sin(2.0 * np.pi * (f_hz * 2.0) * ct)
            ) * np.exp(-ct * 9.5) * 0.11
            left[ci0:ci1] += c_sig
            right[ci0:ci1] += c_sig

    # Scene transitions
    for trans_t in [0.15, 4.5, 9.5, 15.0, 21.0, 24.5]:
        add_whoosh(trans_t)

    # Scene 2: Unlock cascade chime when clicking [Liberar Acesso]
    add_chime(6.4, [523.25, 659.25, 783.99, 1046.50])

    # Scene 3: Pricing pop chimes
    add_chime(10.6, [587.33])
    add_chime(11.3, [659.25])
    add_chime(12.0, [783.99])
    add_chime(12.7, [1046.50])

    # Scene 4 & 6: Silia AI golden star wink sparkle chime!
    add_chime(16.3, [1046.50, 1318.51, 1567.98, 2093.00], dur=0.55)
    add_chime(25.8, [1046.50, 1318.51, 1567.98, 2093.00], dur=0.65)

    # Global fade in & fade out
    fade_in = np.minimum(1.0, t / 0.6)
    fade_out = np.minimum(1.0, (DURATION - t) / 1.4)
    left = np.clip(left * fade_in * fade_out, -0.95, 0.95)
    right = np.clip(right * fade_in * fade_out, -0.95, 0.95)

    stereo = np.empty((n_samples * 2,), dtype=np.int16)
    stereo[0::2] = (left * 32767).astype(np.int16)
    stereo[1::2] = (right * 32767).astype(np.int16)

    with wave.open(str(AUDIO_PATH), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(stereo.tobytes())


def load_gif_frames(path: Path, size: tuple[int, int]) -> list[Image.Image]:
    im = Image.open(path)
    frames: list[Image.Image] = []
    try:
        while True:
            frames.append(im.copy().convert("RGBA").resize(size, Image.Resampling.LANCZOS))
            im.seek(im.tell() + 1)
    except EOFError:
        pass
    return frames if frames else [im.convert("RGBA").resize(size, Image.Resampling.LANCZOS)]


def draw_rounded_card(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int],
    width: int = 2,
    radius: int = 18,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_pill(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    bg_color: tuple[int, int, int, int],
    border_color: tuple[int, int, int, int],
    text_color: tuple[int, int, int, int] = (248, 245, 255, 255),
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont = FONT_TAG,
) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pw = tw + 28
    ph = th + 14
    draw.rounded_rectangle((x, y, x + pw, y + ph), radius=ph // 2, fill=bg_color, outline=border_color, width=2)
    draw.text((x + 14, y + 6), text, font=font, fill=text_color)
    return pw


def draw_cursor(draw: ImageDraw.ImageDraw, cx: int, cy: int, clicked: bool = False, ripple: float = 0.0) -> None:
    if ripple > 0.01:
        r_rad = int(12 + ripple * 46)
        r_alpha = int((1.0 - ripple) * 210)
        draw.ellipse(
            (cx - r_rad, cy - r_rad, cx + r_rad, cy + r_rad),
            outline=(82, 183, 255, r_alpha),
            width=3,
        )
    scale = 0.85 if clicked else 1.0
    pts = [
        (cx, cy),
        (cx + int(18 * scale), cy + int(14 * scale)),
        (cx + int(10 * scale), cy + int(16 * scale)),
        (cx + int(15 * scale), cy + int(26 * scale)),
        (cx + int(10 * scale), cy + int(28 * scale)),
        (cx + int(5 * scale), cy + int(18 * scale)),
        (cx, cy + int(23 * scale)),
    ]
    draw.polygon(pts, fill=(255, 255, 255, 255), outline=(22, 16, 36, 255))


def render_video() -> None:
    print("1/3 Sintetizando trilha sonora dark-synthwave e efeitos sonoros...")
    synthesize_soundtrack()

    print("2/3 Carregando assets visuais do LWX Lab e da Silia AI...")
    knight_banner_frames = load_gif_frames(ROOT / "assets" / "brand" / "bot-profile-banner.gif", (680, 272))
    silia_banner_frames = load_gif_frames(ROOT / "assets" / "brand" / "banner-silia.gif", (580, 180))
    silia_emblem_frames = load_gif_frames(ROOT / "assets" / "brand" / "silia-emblem.gif", (160, 160))
    knight_emblem_frames = load_gif_frames(ROOT / "assets" / "brand" / "knight-emblem.gif", (140, 140))

    bot_avatar = (
        Image.open(ROOT / "assets" / "brand" / "current-bot-avatar.png")
        .convert("RGBA")
        .resize((104, 104), Image.Resampling.LANCZOS)
    )
    # Circular mask for bot avatar
    circ_mask = Image.new("L", (104, 104), 0)
    ImageDraw.Draw(circ_mask).ellipse((0, 0, 103, 103), fill=255)
    bot_avatar_circ = Image.new("RGBA", (104, 104), (0, 0, 0, 0))
    bot_avatar_circ.paste(bot_avatar, (0, 0), circ_mask)

    portfolio_imgs: list[tuple[str, str, Image.Image]] = []
    portfolio_specs = [
        ("design-03.jpg", "Banner Esportivo HD", "A partir de R$ 20"),
        ("design-09.jpg", "Identidade & Logo Cavaleiro", "A partir de R$ 30"),
        ("design-05.jpg", "Poster Dark-Glitch Autoral", "A partir de R$ 20"),
        ("design-11.jpg", "Ilustração & Concept Art", "A partir de R$ 35"),
    ]
    for fname, title, price in portfolio_specs:
        p_img = (
            Image.open(ROOT / "assets" / "portfolio" / fname)
            .convert("RGBA")
            .resize((460, 320), Image.Resampling.LANCZOS)
        )
        portfolio_imgs.append((title, price, p_img))

    # Pre-build background base with scanlines & ambient glow
    yy, xx = np.mgrid[0:H, 0:W]
    bg_base = np.zeros((H, W, 3), dtype=np.uint8)
    bg_base[:, :, 0] = np.clip(11 + (yy / H) * 14, 0, 255).astype(np.uint8)
    bg_base[:, :, 1] = np.clip(8 + (yy / H) * 10, 0, 255).astype(np.uint8)
    bg_base[:, :, 2] = np.clip(22 + (yy / H) * 26, 0, 255).astype(np.uint8)
    # Subtle CRT scanlines every 4px
    bg_base[0::4, :, :] = (bg_base[0::4, :, :] * 0.84).astype(np.uint8)
    bg_base_pil = Image.fromarray(bg_base, mode="RGB").convert("RGBA")

    # Ambient particles
    rng = np.random.default_rng(42)
    p_x = rng.uniform(0.02, 0.98, 45)
    p_y = rng.uniform(0.05, 0.95, 45)
    p_spd = rng.uniform(0.08, 0.22, 45)
    p_col = [
        (82, 183, 255) if i % 2 == 0 else ((139, 92, 246) if i % 3 == 0 else (214, 69, 107))
        for i in range(45)
    ]

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

    print("3/3 Renderizando 840 frames (1280x720 @ 30fps) de Motion Design...", flush=True)
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert proc.stdin is not None

    for f_idx in range(TOTAL_FRAMES):
        sec = f_idx / float(FPS)
        canvas = bg_base_pil.copy()
        draw = ImageDraw.Draw(canvas, "RGBA")

        # Draw subtle perspective cyber grid at bottom
        grid_y0 = int(H * 0.78)
        for gy in range(grid_y0, H, 28):
            alpha_g = int(45 * ((gy - grid_y0) / max(1, H - grid_y0)))
            draw.line((0, gy, W, gy), fill=(139, 92, 246, alpha_g), width=1)
        for gx in range(-200, W + 200, 110):
            draw.line((W // 2 + (gx - W // 2) // 2, grid_y0, gx, H), fill=(82, 183, 255, 28), width=1)

        # Draw rising ambient particles
        for i in range(45):
            py = int(((p_y[i] - sec * p_spd[i]) % 1.0) * H)
            px = int((p_x[i] + 0.015 * math.sin(sec * 2.0 + i)) * W)
            r_c, g_c, b_c = p_col[i]
            draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill=(r_c, g_c, b_c, 150))

        # Top HUD Header Bar (always present for studio branding cohesion)
        draw_rounded_card(draw, (36, 20, W - 36, 68), (22, 16, 36, 215), (139, 92, 246, 120), width=1, radius=14)
        draw.ellipse((56, 36, 72, 52), fill=(82, 183, 255, 255))
        draw.text((84, 31), "LWX LAB • DESIGN STUDIO SHOWCASE", font=FONT_BOLD, fill=(245, 240, 255, 255))
        scene_num = (
            "01 / PERFIL DO BOT & BANNER ANIMADO"
            if sec < 4.5
            else "02 / CREDENCIAL & PAINÉIS POR CANAL"
            if sec < 9.5
            else "03 / PORTFÓLIO PURO & PREÇOS ACESSÍVEIS"
            if sec < 15.0
            else "04 / SILIA AI • ASSISTENTE CRIATIVA"
            if sec < 21.0
            else "05 / PALETA VISUAL & RASTREIO EM 5 ETAPAS"
            if sec < 24.5
            else "06 / ESTÚDIO OFICIAL POR LLEWXAM"
        )
        draw.text((W - 430, 32), scene_num, font=FONT_TAG, fill=(82, 183, 255, 240))

        # =====================================================================
        # SCENE 1 (0.0s - 4.5s): THE KNIGHT AWAKENS & BOT PROFILE CARD
        # =====================================================================
        if sec < 4.5:
            lt = sec / 4.5
            enter = ease_out_back(min(1.0, sec / 0.85))

            # Left Side: Kinetic Typography
            tx = int(-380 + 436 * enter)
            draw_pill(draw, tx, 130, "⚔️ IDENTIDADE OFICIAL • DISCORD BOT", (139, 92, 246, 55), (139, 92, 246, 220))
            draw.text((tx, 185), "LWX LAB", font=FONT_HERO, fill=(255, 255, 255, 255))
            draw.text((tx, 252), "ESTÚDIO DE DESIGN", font=FONT_H1, fill=(168, 127, 251, 255))
            draw.text(
                (tx, 316),
                "Visual autoral inspirado no Cavaleiro de Llewxam:\nfogo azul em movimento, cachecol ao vento\ne automação completa para o servidor.",
                font=FONT_BODY,
                fill=(205, 198, 228, 240),
            )

            # Feature pills appearing staggered
            if sec > 0.7:
                p1_a = ease_out_cubic((sec - 0.7) / 0.5)
                draw_pill(
                    draw,
                    tx,
                    415,
                    "🔥 Banner GIF com Fogo Azul",
                    (22, 16, 36, int(230 * p1_a)),
                    (82, 183, 255, int(220 * p1_a)),
                )
            if sec > 1.1:
                p2_a = ease_out_cubic((sec - 1.1) / 0.5)
                draw_pill(
                    draw,
                    tx,
                    462,
                    "🧣 Cachecol Animado ao Vento",
                    (22, 16, 36, int(230 * p2_a)),
                    (214, 69, 107, int(220 * p2_a)),
                )
            if sec > 1.5:
                p3_a = ease_out_cubic((sec - 1.5) / 0.5)
                draw_pill(
                    draw,
                    tx,
                    509,
                    "🤖 Silia AI & Painéis Exclusivos",
                    (22, 16, 36, int(230 * p3_a)),
                    (139, 92, 246, int(220 * p3_a)),
                )

            # Right Side: Discord Bot Profile Card Mockup with LIVE Animated Banner!
            card_x = int(W - 720 + (1.0 - enter) * 420)
            card_y = 100
            card_w, card_h = 660, 555
            draw_rounded_card(
                draw,
                (card_x, card_y, card_x + card_w, card_y + card_h),
                (18, 14, 28, 250),
                (139, 92, 246, 220),
                width=3,
                radius=22,
            )

            # Paste live animated Knight Blue Fire Banner frame!
            kb_frame = knight_banner_frames[f_idx % len(knight_banner_frames)].resize(
                (card_w - 8, 255), Image.Resampling.LANCZOS
            )
            canvas.paste(kb_frame, (card_x + 4, card_y + 4), kb_frame)

            # Paste circular Bot Avatar overlapping the banner bottom-left
            av_x, av_y = card_x + 28, card_y + 195
            draw.ellipse((av_x - 6, av_y - 6, av_x + 110, av_y + 110), fill=(18, 14, 28, 255))
            canvas.paste(bot_avatar_circ, (av_x, av_y), bot_avatar_circ)
            # Online green badge
            draw.ellipse((av_x + 76, av_y + 76, av_x + 104, av_y + 104), fill=(35, 165, 90, 255), outline=(18, 14, 28, 255), width=4)

            # Bot Name + APP Tag
            draw.text((card_x + 150, card_y + 268), "LWX Lab", font=FONT_H2, fill=(255, 255, 255, 255))
            draw_pill(draw, card_x + 280, card_y + 270, "✔ APP", (88, 101, 242, 255), (88, 101, 242, 255))

            # About Me / Bio box
            draw_rounded_card(
                draw,
                (card_x + 24, card_y + 322, card_x + card_w - 24, card_y + 468),
                (28, 22, 44, 235),
                (82, 183, 255, 90),
                width=1,
                radius=14,
            )
            draw.text((card_x + 40, card_y + 334), "SOBRE MIM", font=FONT_TAG, fill=(168, 127, 251, 255))
            draw.text(
                (card_x + 40, card_y + 360),
                "🛡️ LWX Lab • Estúdio Oficial por Llewxam\n🔥 Especialidades: Banners, Logos, OCs, Packs & Bots\n🤖 Silia AI: Assistente criativa integrada no servidor\n✨ Comissões Abertas: Valores a partir de R$ 10!",
                font=FONT_SMALL,
                fill=(235, 230, 250, 255),
            )

            # Stylized Role Badges at bottom of Profile Card
            draw_pill(draw, card_x + 24, card_y + 486, "🟣 Estúdio Oficial • Llewxam", (40, 26, 68, 255), (139, 92, 246, 255))
            draw_pill(draw, card_x + 258, card_y + 486, "🔵 Silia AI • Engine", (18, 42, 68, 255), (82, 183, 255, 255))
            draw_pill(draw, card_x + 445, card_y + 486, "🔴 Banners & OCs", (62, 20, 38, 255), (214, 69, 107, 255))

        # =====================================================================
        # SCENE 2 (4.5s - 9.5s): ZERO SLASH COMMANDS & STRICT REGISTRATION GATE
        # =====================================================================
        elif sec < 9.5:
            st = sec - 4.5
            enter = ease_out_cubic(min(1.0, st / 0.65))
            unlocked = st >= 1.9  # Button clicked at st = 1.9s (sec = 6.4s)

            # Title Header
            draw.text((56, 86), "ZERO COMANDOS / • CADA FUNÇÃO NO SEU CANAL", font=FONT_H1, fill=(255, 255, 255, 255))
            draw.text(
                (56, 138),
                "Sem poluição no chat: apenas a mensagem oficial do bot aparece em 1º lugar em cada canal.",
                font=FONT_BODY,
                fill=(82, 183, 255, 245),
            )

            # Left Sidebar: Server Channels List (unlocking after click!)
            sb_x, sb_y = int(-300 + 356 * enter), 182
            sb_w, sb_h = 330, 490
            draw_rounded_card(draw, (sb_x, sb_y, sb_x + sb_w, sb_y + sb_h), (20, 15, 32, 245), (139, 92, 246, 160), width=2)
            draw.text((sb_x + 20, sb_y + 18), "📌 CANAIS DO SERVIDOR", font=FONT_TAG, fill=(168, 127, 251, 255))

            channels_list = [
                ("✅・registre-se", True, "Credencial Obrigatória"),
                ("📜・regras-e-termos", unlocked, "Termos & FAQ"),
                ("👋・boas-vindas", unlocked, "Recepção Automática"),
                ("🖼️・portfólio", unlocked, "11 Obras Sem Moldura"),
                ("💰・tabela-de-preços", unlocked, "Preços + Simulador"),
                ("✍️・avaliar", unlocked, "Notas 5★ em 1 Clique"),
                ("🎫・fazer-orçamento", unlocked, "Tickets + Paleta + Rastreio"),
                ("🤖・silia-ai", unlocked, "IA Exclusiva do Estúdio"),
            ]

            for idx, (ch_name, is_open, desc) in enumerate(channels_list):
                cy = sb_y + 54 + idx * 52
                is_reg = idx == 0
                bg_c = (46, 30, 82, 240) if is_reg else ((28, 44, 68, 220) if is_open else (26, 20, 36, 140))
                bd_c = (82, 183, 255, 220) if is_open else (90, 80, 110, 90)
                draw_rounded_card(draw, (sb_x + 14, cy, sb_x + sb_w - 14, cy + 44), bg_c, bd_c, width=1, radius=10)
                prefix = "🔓" if is_open else "🔒"
                txt_c = (255, 255, 255, 255) if is_open else (130, 120, 150, 180)
                draw.text((sb_x + 26, cy + 6), f"{prefix}  {ch_name}", font=FONT_BOLD, fill=txt_c)
                draw.text((sb_x + 52, cy + 25), desc, font=FONT_SMALL, fill=(175, 165, 205, 200))

            # Right Panel: #✅・registre-se Fixed Panel Card + Button Click
            rp_x, rp_y = int(415 + (1.0 - enter) * 350), 182
            rp_w, rp_h = 810, 490
            draw_rounded_card(
                draw,
                (rp_x, rp_y, rp_x + rp_w, rp_y + rp_h),
                (22, 16, 36, 245),
                (82, 183, 255, 240) if unlocked else (139, 92, 246, 200),
                width=2,
            )

            # Mini header banner inside panel
            draw_rounded_card(
                draw,
                (rp_x + 20, rp_y + 20, rp_x + rp_w - 20, rp_y + 135),
                (36, 22, 64, 255),
                (139, 92, 246, 180),
                width=1,
                radius=14,
            )
            ke_frame = knight_emblem_frames[f_idx % len(knight_emblem_frames)].resize((96, 96), Image.Resampling.LANCZOS)
            canvas.paste(ke_frame, (rp_x + 36, rp_y + 30), ke_frame)
            draw.text((rp_x + 150, rp_y + 34), "Portão de Acesso & Credenciamento • LWX Lab", font=FONT_H2, fill=(255, 255, 255, 255))
            draw.text(
                (rp_x + 150, rp_y + 72),
                "O restante do servidor fica bloqueado até você ativar sua credencial no botão abaixo.",
                font=FONT_BODY,
                fill=(205, 198, 228, 245),
            )

            # 3 feature columns
            cols = [
                ("1. Credencial Obrigatória", "Clique em Liberar Acesso para desbloquear todos os canais em 1 clique."),
                ("2. Radares & Avisos", "Ative ou desative cargos de Avisos LWX e Drops & Eventos."),
                ("3. Cartão de Membro", "Consulte seu Dossiê LWX com cargos e histórico de pedidos."),
            ]
            for c_idx, (c_title, c_desc) in enumerate(cols):
                cx_box = rp_x + 20 + c_idx * 260
                draw_rounded_card(
                    draw,
                    (cx_box, rp_y + 155, cx_box + 248, rp_y + 310),
                    (30, 22, 48, 230),
                    (139, 92, 246, 100),
                    width=1,
                    radius=12,
                )
                draw.text((cx_box + 16, rp_y + 172), c_title, font=FONT_BOLD, fill=(82, 183, 255, 255))
                # Wrap text manually
                words = c_desc.split(" ")
                lines, cur = [], ""
                for w in words:
                    if len(cur + " " + w) <= 26:
                        cur = (cur + " " + w).strip()
                    else:
                        lines.append(cur)
                        cur = w
                if cur:
                    lines.append(cur)
                draw.text((cx_box + 16, rp_y + 206), "\n".join(lines), font=FONT_SMALL, fill=(220, 215, 235, 240))

            # Interactive Buttons Row at bottom of panel
            btn_y = rp_y + 340
            btn_green = (45, 185, 105, 255) if not unlocked else (82, 183, 255, 255)
            draw_rounded_card(draw, (rp_x + 20, btn_y, rp_x + 230, btn_y + 52), btn_green, (255, 255, 255, 220), width=2, radius=12)
            draw.text(
                (rp_x + 42, btn_y + 14),
                "✅ Acesso Liberado!" if unlocked else "✅ Liberar Acesso",
                font=FONT_BOLD,
                fill=(255, 255, 255, 255),
            )
            draw_rounded_card(draw, (rp_x + 245, btn_y, rp_x + 435, btn_y + 52), (88, 101, 242, 235), (168, 127, 251, 180), width=1, radius=12)
            draw.text((rp_x + 265, btn_y + 14), "🔥 Cargo • Avisos", font=FONT_BOLD, fill=(255, 255, 255, 255))
            draw_rounded_card(draw, (rp_x + 450, btn_y, rp_x + 620, btn_y + 52), (55, 48, 74, 235), (139, 92, 246, 140), width=1, radius=12)
            draw.text((rp_x + 470, btn_y + 14), "🛡️ Meu Cartão", font=FONT_BOLD, fill=(255, 255, 255, 255))

            if unlocked:
                draw_rounded_card(
                    draw,
                    (rp_x + 20, rp_y + 412, rp_x + rp_w - 20, rp_y + 468),
                    (20, 52, 74, 240),
                    (82, 183, 255, 255),
                    width=2,
                    radius=12,
                )
                draw.text(
                    (rp_x + 40, rp_y + 429),
                    "🎉 Credencial @Membros ativada! Todos os canais do estúdio LWX Lab foram liberados.",
                    font=FONT_BOLD,
                    fill=(215, 248, 255, 255),
                )

            # Cursor moving to click [Liberar Acesso]
            c_prog = ease_in_out_cubic(min(1.0, st / 1.8))
            cur_x = int(950 + (rp_x + 125 - 950) * c_prog)
            cur_y = int(480 + (btn_y + 26 - 480) * c_prog)
            is_clicking = 1.75 <= st <= 2.15
            ripple_p = (st - 1.85) / 0.65 if 1.85 <= st <= 2.5 else 0.0
            draw_cursor(draw, cur_x, cur_y, clicked=is_clicking, ripple=ripple_p)

        # =====================================================================
        # SCENE 3 (9.5s - 15.0s): UNFRAMED PORTFOLIO & LOWERED ACCESSIBLE PRICES
        # =====================================================================
        elif sec < 15.0:
            st = sec - 9.5
            enter = ease_out_cubic(min(1.0, st / 0.65))

            draw.text((56, 86), "VITRINE PURA SEM MOLDURAS & TABELA SUPER ACESSÍVEL", font=FONT_H1, fill=(255, 255, 255, 255))
            draw.text(
                (56, 138),
                "Artes originais de Llewxam em resolução total + novos preços de entrada no mercado!",
                font=FONT_BODY,
                fill=(168, 127, 251, 255),
            )

            # Left Bento Card: Live Portfolio Carousel (Unframed Pure Artworks!)
            lx, ly = int(48 - (1.0 - enter) * 300), 182
            lw, lh = 540, 490
            draw_rounded_card(draw, (lx, ly, lx + lw, ly + lh), (22, 16, 36, 245), (139, 92, 246, 220), width=2)

            art_idx = int(st / 1.35) % len(portfolio_imgs)
            art_title, art_price, art_img = portfolio_imgs[art_idx]
            draw.text((lx + 24, ly + 18), f"🖼️ #portfólio • Obra 0{art_idx + 1}/11 (Sem Moldura)", font=FONT_BOLD, fill=(82, 183, 255, 255))
            canvas.paste(art_img, (lx + 40, ly + 56), art_img)
            draw.text((lx + 40, ly + 392), art_title, font=FONT_H2, fill=(255, 255, 255, 255))
            draw_pill(draw, lx + 40, ly + 434, "⚡ Anterior", (45, 38, 64, 255), (139, 92, 246, 160))
            draw_pill(draw, lx + 165, ly + 434, "🔥 Próxima", (88, 101, 242, 255), (82, 183, 255, 220))
            draw_pill(draw, lx + 290, ly + 434, "🎫 Encomendar Neste Estilo", (40, 165, 95, 255), (255, 255, 255, 200))

            # Right Bento Card: Lowered Accessible Pricing Grid + 10% Combo Badge
            rx, ry = int(616 + (1.0 - enter) * 300), 182
            rw, rh = 616, 490
            draw_rounded_card(draw, (rx, ry, rx + rw, ry + rh), (22, 16, 36, 245), (82, 183, 255, 220), width=2)
            draw.text((rx + 24, ry + 18), "💰 #tabela-de-preços • Novos Valores Acessíveis", font=FONT_H2, fill=(255, 255, 255, 255))

            price_cards = [
                ("Barrinha & Divisória", "R$ 10", "Entrega em até 24h", 0.3, (82, 183, 255, 255)),
                ("Banner & Header HD", "R$ 20", "Discord, YouTube, X", 0.9, (139, 92, 246, 255)),
                ("Logo & Identidade", "R$ 30", "Marca + Fundo Transp.", 1.5, (214, 69, 107, 255)),
                ("Ilustração & OC", "R$ 35", "Arte Autoral Estilizada", 2.1, (82, 183, 255, 255)),
                ("Pack Visual Servidor", "R$ 55", "Logo + Banner + Barrinhas", 2.5, (139, 92, 246, 255)),
                ("Bot Discord / Site", "R$ 70+", "Projeto Completo Sob Medida", 2.9, (45, 200, 120, 255)),
            ]

            for p_idx, (p_name, p_val, p_sub, delay, accent_c) in enumerate(price_cards):
                col = p_idx % 2
                row = p_idx // 2
                px_box = rx + 24 + col * 290
                py_box = ry + 68 + row * 112
                pop = ease_out_back(min(1.0, max(0.0, (st - delay) / 0.45)))
                if pop > 0.05:
                    draw_rounded_card(
                        draw,
                        (px_box, py_box, px_box + 276, py_box + 98),
                        (32, 24, 52, int(240 * min(1.0, pop))),
                        accent_c,
                        width=2,
                        radius=14,
                    )
                    draw.text((px_box + 16, py_box + 12), p_name, font=FONT_BOLD, fill=(240, 235, 255, 255))
                    draw.text((px_box + 16, py_box + 38), f"A partir de {p_val}", font=FONT_H2, fill=accent_c)
                    draw.text((px_box + 16, py_box + 72), p_sub, font=FONT_SMALL, fill=(185, 178, 210, 230))

            # Bottom Combo Banner inside right card
            draw_rounded_card(
                draw,
                (rx + 24, ry + 412, rx + rw - 24, ry + 468),
                (48, 24, 68, 245),
                (255, 215, 0, 240),
                width=2,
                radius=14,
            )
            draw.text(
                (rx + 42, ry + 428),
                "✨ SIMULADOR DE PACOTE: Combine 2+ serviços e ganhe 10% OFF automático!",
                font=FONT_BOLD,
                fill=(255, 235, 140, 255),
            )

        # =====================================================================
        # SCENE 4 (15.0s - 21.0s): SILIA AI • WINKING ROBOT + GOLDEN STAR
        # =====================================================================
        elif sec < 21.0:
            st = sec - 15.0
            enter = ease_out_cubic(min(1.0, st / 0.65))

            draw.text((56, 86), "NOVO CANAL #🤖・silia-ai • SUA CONSULTORA CRIATIVA", font=FONT_H1, fill=(255, 255, 255, 255))
            draw.text(
                (56, 138),
                "Converse livremente ou aprimore sua ideia de design para apresentar pronta ao Llewxam!",
                font=FONT_BODY,
                fill=(255, 215, 0, 245),
            )

            # Left Card: Silia AI Animated Character Showcase (Winking Robot + Golden Star!)
            sx, sy = int(48 - (1.0 - enter) * 300), 182
            sw, sh = 450, 490
            draw_rounded_card(draw, (sx, sy, sx + sw, sy + sh), (22, 16, 38, 248), (255, 215, 0, 220), width=2)

            sb_frame = silia_banner_frames[f_idx % len(silia_banner_frames)].resize((sw - 24, 140), Image.Resampling.LANCZOS)
            canvas.paste(sb_frame, (sx + 12, sy + 14), sb_frame)

            # Big animated Silia Emblem in center of left card
            se_frame = silia_emblem_frames[f_idx % len(silia_emblem_frames)].resize((170, 170), Image.Resampling.LANCZOS)
            canvas.paste(se_frame, (sx + (sw - 170) // 2, sy + 168), se_frame)

            draw.text((sx + 78, sy + 352), "Silia AI • Mascote Oficial", font=FONT_H2, fill=(255, 255, 255, 255))
            draw.text(
                (sx + 34, sy + 392),
                "• Mesmas cores da logo do Cavaleiro\n• Piscadinha com estrelinha dourada ✨\n• Conversa privada por usuário no canal",
                font=FONT_BODY,
                fill=(210, 205, 235, 245),
            )

            # Right Card: Live Simulation of #🤖・silia-ai Conversation
            cx, cy = int(524 + (1.0 - enter) * 300), 182
            cw, ch = 708, 490
            draw_rounded_card(draw, (cx, cy, cx + cw, cy + ch), (20, 15, 34, 248), (82, 183, 255, 220), width=2)

            # Two main command buttons at top of #silia-ai
            draw.text((cx + 24, cy + 18), "🤖 Painel Fixo em #🤖・silia-ai — Escolha seu modo:", font=FONT_BOLD, fill=(168, 127, 251, 255))
            ideate_active = st >= 1.2
            draw_rounded_card(
                draw,
                (cx + 24, cy + 52, cx + 335, cy + 102),
                (58, 70, 180, 220),
                (139, 92, 246, 180),
                width=1,
                radius=12,
            )
            draw.text((cx + 46, cy + 66), "🤖 Conversar com a Silia AI", font=FONT_BOLD, fill=(255, 255, 255, 255))

            draw_rounded_card(
                draw,
                (cx + 355, cy + 52, cx + cw - 24, cy + 102),
                (40, 175, 105, 255) if not ideate_active else (255, 195, 20, 255),
                (255, 255, 255, 240),
                width=2,
                radius=12,
            )
            draw.text(
                (cx + 375, cy + 66),
                "✨ Aprimorar Ideia com Silia AI",
                font=FONT_BOLD,
                fill=(20, 14, 32, 255) if ideate_active else (255, 255, 255, 255),
            )

            # User message bubble appears at st > 1.4
            if st > 1.4:
                draw_rounded_card(
                    draw,
                    (cx + 24, cy + 124, cx + cw - 24, cy + 188),
                    (34, 26, 54, 240),
                    (139, 92, 246, 140),
                    width=1,
                    radius=12,
                )
                draw.text((cx + 40, cy + 132), "👤 Cliente: Quero um banner pro meu servidor no estilo cavaleiro com fogo azul!", font=FONT_BOLD, fill=(82, 183, 255, 255))
                draw.text((cx + 40, cy + 158), "Pode me ajudar a montar a ideia pra mandar pro Llewxam?", font=FONT_SMALL, fill=(225, 220, 240, 240))

            # Silia AI rich response appears at st > 2.2
            if st > 2.2:
                r_pop = ease_out_cubic(min(1.0, (st - 2.2) / 0.55))
                draw_rounded_card(
                    draw,
                    (cx + 24, cy + 204, cx + cw - 24, cy + 470),
                    (28, 22, 48, int(250 * r_pop)),
                    (255, 215, 0, int(230 * r_pop)),
                    width=2,
                    radius=14,
                )
                draw.text((cx + 42, cy + 218), "🤖 Silia AI • Aprimorando Ideia de Design ✨", font=FONT_H3, fill=(255, 215, 0, 255))
                draw.text(
                    (cx + 42, cy + 252),
                    "• Conceito & Estilo: Dark-Glitch Medieval com iluminação Soul-Fire no centro.\n"
                    "• Paleta Sugerida: Roxo Royal (#8B5CF6), Azul Chamas (#52B7FF) e Carmesim (#D6456B).\n"
                    "• Briefing Pronto para o Llewxam:\n"
                    '  "Banner HD 16:9 com cavaleiro central, chamas azuis vibrantes e tipografia limpa."',
                    font=FONT_SMALL,
                    fill=(240, 236, 255, 255),
                )
                draw_pill(
                    draw,
                    cx + 42,
                    cy + 412,
                    "🎫 Abrir Orçamento com Esta Ideia (1 Clique)",
                    (40, 175, 105, 255),
                    (255, 255, 255, 220),
                )

            # Cursor clicking [Aprimorar Ideia com Silia AI]
            if st < 2.2:
                c_prog = ease_in_out_cubic(min(1.0, st / 1.15))
                cur_x = int(980 + (cx + 510 - 980) * c_prog)
                cur_y = int(420 + (cy + 77 - 420) * c_prog)
                draw_cursor(draw, cur_x, cur_y, clicked=(1.1 <= st <= 1.4), ripple=(st - 1.15) / 0.5 if 1.15 <= st <= 1.65 else 0.0)

        # =====================================================================
        # SCENE 5 (21.0s - 24.5s): LIVE ORDER TRACKER & PALETTE GENERATOR
        # =====================================================================
        elif sec < 24.5:
            st = sec - 21.0
            enter = ease_out_cubic(min(1.0, st / 0.55))

            draw.text((56, 86), "ORÇAMENTO PRIVADO, PALETAS & RASTREIO EM 5 ETAPAS", font=FONT_H1, fill=(255, 255, 255, 255))
            draw.text(
                (56, 138),
                "O cliente acompanha o progresso da arte em tempo real direto no canal #🎫・fazer-orçamento!",
                font=FONT_BODY,
                fill=(82, 183, 255, 245),
            )

            # Order Tracker Card
            ox, oy = int(140 - (1.0 - enter) * 250), 190
            ow, oh = 1000, 470
            draw_rounded_card(draw, (ox, oy, ox + ow, oy + oh), (22, 16, 36, 248), (139, 92, 246, 230), width=2, radius=20)

            prog_pct = min(100, int(20 + (st / 2.4) * 80))
            stage_idx = min(4, int((prog_pct - 1) / 20))
            stage_names = [
                "1/5 • Briefing & Referências",
                "2/5 • Esboço & Estrutura",
                "3/5 • Render & Iluminação",
                "4/5 • Revisão com Cliente",
                "5/5 • Projeto Finalizado (Entrega Master HD)",
            ]

            draw.text((ox + 36, oy + 28), f"🛡️ Rastreador de Encomenda • #LWX-101 ({prog_pct}%)", font=FONT_H2, fill=(255, 255, 255, 255))
            draw.text((ox + 36, oy + 68), f"Etapa Atual: {stage_names[stage_idx]}", font=FONT_H3, fill=(82, 183, 255, 255))

            # Animated Progress Bar
            bar_x, bar_y, bar_w, bar_h = ox + 36, oy + 112, ow - 72, 34
            draw_rounded_card(draw, (bar_x, bar_y, bar_x + bar_w, bar_y + bar_h), (14, 10, 24, 255), (139, 92, 246, 140), width=1, radius=17)
            fill_w = max(34, int(bar_w * (prog_pct / 100.0)))
            draw_rounded_card(draw, (bar_x, bar_y, bar_x + fill_w, bar_y + bar_h), (82, 183, 255, 255), (215, 248, 255, 255), width=2, radius=17)

            # 5 Stage Pills
            for s_i, s_label in enumerate(stage_names):
                sy_row = oy + 168 + s_i * 54
                done = s_i <= stage_idx
                bg_s = (36, 64, 92, 240) if s_i == stage_idx else ((28, 48, 44, 210) if done else (28, 22, 42, 160))
                bd_s = (82, 183, 255, 255) if s_i == stage_idx else ((45, 195, 115, 200) if done else (90, 80, 120, 90))
                draw_rounded_card(draw, (ox + 36, sy_row, ox + ow - 36, sy_row + 44), bg_s, bd_s, width=1, radius=10)
                icon = "✅" if s_i < stage_idx else ("🔥" if s_i == stage_idx else "▫️")
                draw.text((ox + 54, sy_row + 10), f"{icon}  {s_label}", font=FONT_BOLD, fill=(255, 255, 255, 255) if done else (150, 140, 175, 200))

        # =====================================================================
        # SCENE 6 (24.5s - 28.0s): GRAND FINALE & CALL TO ACTION
        # =====================================================================
        else:
            st = sec - 24.5
            enter = ease_out_back(min(1.0, st / 0.75))

            # Center Hero Banner Card
            hx, hy = 120, int(96 + (1.0 - enter) * 180)
            hw, hh = W - 240, 565
            draw_rounded_card(draw, (hx, hy, hx + hw, hy + hh), (18, 14, 30, 250), (82, 183, 255, 240), width=3, radius=24)

            # Animated Knight Blue Fire Banner across top of Hero Finale Card
            kb_finale = knight_banner_frames[f_idx % len(knight_banner_frames)].resize((hw - 12, 240), Image.Resampling.LANCZOS)
            canvas.paste(kb_finale, (hx + 6, hy + 6), kb_finale)

            # Silia AI Animated Emblem on left + Knight Animated Emblem on right
            se_fin = silia_emblem_frames[f_idx % len(silia_emblem_frames)].resize((130, 130), Image.Resampling.LANCZOS)
            ke_fin = knight_emblem_frames[f_idx % len(knight_emblem_frames)].resize((130, 130), Image.Resampling.LANCZOS)
            canvas.paste(se_fin, (hx + 42, hy + 265), se_fin)
            canvas.paste(ke_fin, (hx + hw - 172, hy + 265), ke_fin)

            draw.text((hx + 215, hy + 262), "LWX LAB • ESTÚDIO OFICIAL", font=FONT_H1, fill=(255, 255, 255, 255))
            draw.text(
                (hx + 225, hy + 318),
                "Direção de Arte por Llewxam • Silia AI Integrada • Comissões A partir de R$ 10",
                font=FONT_BOLD,
                fill=(82, 183, 255, 255),
            )

            # Pulsing Call-To-Action Button
            pulse = int(6 * math.sin(sec * 6.0))
            cta_box = (hx + 235 - pulse, hy + 375 - pulse // 2, hx + hw - 235 + pulse, hy + 445 + pulse // 2)
            draw_rounded_card(draw, cta_box, (139, 92, 246, 255), (255, 215, 0, 255), width=3, radius=18)
            draw.text(
                (hx + 275, hy + 396),
                "⚡ LWX LAB BR • PRONTO PARA RECEBER CLIENTES!",
                font=FONT_H3,
                fill=(255, 255, 255, 255),
            )

            draw.text(
                (hx + 265, hy + 478),
                "Banners HD • Logos & Mascotes • Ilustrações & OCs • Packs • Bots & Sites",
                font=FONT_SMALL,
                fill=(200, 192, 225, 235),
            )

        rgb_bytes = canvas.convert("RGB").tobytes()
        proc.stdin.write(rgb_bytes)
        if (f_idx + 1) % 140 == 0 or (f_idx + 1) == TOTAL_FRAMES:
            print(f"   -> Frame {f_idx + 1}/{TOTAL_FRAMES} ({int((f_idx + 1) * 100 / TOTAL_FRAMES)}%)", flush=True)

    proc.stdin.close()
    proc.wait()

    if VIDEO_PATH.exists():
        import shutil
        shutil.copyfile(VIDEO_PATH, ARTIFACT_VIDEO_PATH)
        print(f"[OK] Video Motion Design renderizado com sucesso: {VIDEO_PATH} ({VIDEO_PATH.stat().st_size // 1024} KB)", flush=True)
    else:
        raise RuntimeError("Falha ao renderizar vídeo.")


if __name__ == "__main__":
    render_video()
