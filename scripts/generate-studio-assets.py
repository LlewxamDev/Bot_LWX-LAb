import math
import os
import random
import shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BRAIN = r"C:\Users\Evandro\.gemini\antigravity\brain\84a05893-5ab6-4635-be21-b20898d8fcb6"

BRAND_DIR = os.path.join(ROOT, "assets", "brand")
EMOJI_DIR = os.path.join(ROOT, "assets", "emojis")
SHOWCASE_DIR = os.path.join(ROOT, "assets", "portfolio", "showcase")

os.makedirs(BRAND_DIR, exist_ok=True)
os.makedirs(EMOJI_DIR, exist_ok=True)

if os.path.exists(SHOWCASE_DIR):
    shutil.rmtree(SHOWCASE_DIR, ignore_errors=True)

# Clean old static PNG banners so only the new assets remain
for f in os.listdir(BRAND_DIR):
    if f.startswith("banner-") and f.endswith(".png"):
        try:
            os.remove(os.path.join(BRAND_DIR, f))
        except Exception:
            pass

KNIGHT_PALETTE = {
    "void_top": (13, 10, 20),          # #0D0A14 - Top Obsidian Void
    "void_mid": (31, 19, 51),          # #1F1333 - Mid CRT Violet
    "void_bot": (76, 40, 120),         # #4C2878 - Bottom Amethyst Glow
    "armor_lavender": (183, 148, 255), # #B794FF - Pixel Title & Armor Highlight
    "armor_violet": (139, 92, 246),    # #8B5CF6 - Primary Knight Armor Violet
    "armor_deep": (91, 46, 201),       # #5B2EC9 - Deep Violet Glitch Block
    "plum_dark": (68, 34, 110),        # #44226E - Muted Plum Glitch Block
    "flame_outer": (56, 152, 255),     # #3898FF - Blue Flame Outer Glow
    "flame_mid": (82, 183, 255),       # #52B7FF - Soul-Fire Cyan Flame
    "flame_core": (196, 235, 255),     # #C4EBFF - Ice-Blue Flame Core
    "scarf_crimson": (214, 69, 107),   # #D6456B - Knight Crimson-Rose Scarf
    "scarf_deep": (158, 38, 74),       # #9E264A - Deep Scarf Shadow
    "pure_white": (245, 240, 255),     # #F5F0FF - Crisp Highlight
}


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\consolab.ttf" if bold else r"C:\Windows\Fonts\consola.ttf",
        r"C:\Windows\Fonts\CascadiaMono.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def extract_organic_flame_sprite() -> Image.Image:
    """
    Extracts the real painted cel-shaded blue flame from lwx_knight_style_banner_base_1792489423261.png
    with smooth alpha transparency so we never use blocky polygon triangles!
    """
    base_src = os.path.join(BRAIN, "lwx_knight_style_banner_base_1792489423261.png")
    bg = Image.open(base_src).convert("RGBA")
    w, h = bg.size
    # Crop the top-right standalone blue soul flame: x in [0.64..0.79], y in [0.01..0.33]
    crop = bg.crop((int(w * 0.65), int(h * 0.01), int(w * 0.79), int(h * 0.32))).resize((120, 150), Image.Resampling.LANCZOS)
    px = crop.load()
    cw, ch = crop.size
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    opx = out.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b, _ = px[x, y]
            # Blue dominance metric
            blueness = b - max(r * 0.65, 22)
            if blueness > 12:
                alpha = min(255, int(blueness * 2.4))
                opx[x, y] = (r, g, b, alpha)
    return out


def warp_flame_sprite(sprite: Image.Image, phase: float, scale: float = 1.0) -> Image.Image:
    """
    Applies a smooth horizontal sine-wave flame flicker & vertical breathing to the organic flame sprite.
    """
    sw = max(16, int(sprite.width * scale))
    sh = max(16, int(sprite.height * scale))
    s = sprite.resize((sw, sh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))

    for y in range(sh):
        # Stronger wave near top of flame (y -> 0), anchored at bottom (y -> sh)
        height_factor = 1.0 - (y / float(sh))
        dx = int(math.sin(phase + y * 0.09) * 5.0 * height_factor * scale)
        row = s.crop((0, y, sw, y + 1))
        out.paste(row, (dx, y))
    return out


def render_pixel_glitch_text(
    text: str,
    target_height: int,
    main_color=(183, 148, 255, 255),
    shadow_color=(76, 29, 149, 255),
    glitch_frame: int = 0,
) -> Image.Image:
    """
    Renders text in the authentic blocky pixel-art glitch style of 'Llewxam' from design-09.jpg.
    """
    pixel_scale = 4
    small_font = load_font(max(12, target_height // pixel_scale), bold=True)
    dummy = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    ddraw = ImageDraw.Draw(dummy)
    bbox = ddraw.textbbox((0, 0), text, font=small_font)
    tw = bbox[2] - bbox[0] + 12
    th = bbox[3] - bbox[1] + 8

    small = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(small)

    sdraw.text((4 - bbox[0] + 1, 3 - bbox[1] + 1), text, font=small_font, fill=shadow_color)
    sdraw.text((4 - bbox[0], 3 - bbox[1]), text, font=small_font, fill=main_color)

    big_w, big_h = tw * pixel_scale, th * pixel_scale
    big = small.resize((big_w, big_h), Image.Resampling.NEAREST)
    bdraw = ImageDraw.Draw(big)

    rng = random.Random(hash(text) + glitch_frame * 17)
    for _ in range(6):
        gx = rng.randint(8, max(12, big_w - 36))
        gy = rng.choice([rng.randint(0, 12), rng.randint(max(14, big_h - 18), max(16, big_h - 4))])
        gw = rng.choice([8, 12, 16, 20])
        gh = rng.choice([4, 6])
        col = rng.choice([
            (*KNIGHT_PALETTE["armor_violet"], 230),
            (*KNIGHT_PALETTE["armor_lavender"], 240),
            (*KNIGHT_PALETTE["scarf_crimson"], 210),
            (*KNIGHT_PALETTE["flame_mid"], 210),
        ])
        bdraw.rectangle([gx, gy, gx + gw, gy + gh], fill=col)

    if glitch_frame in (3, 4, 10):
        slice_y = (big_h // 2) + ((glitch_frame % 3) - 1) * 8
        slice_h = 10
        strip = big.crop((0, slice_y, big_w, min(big_h, slice_y + slice_h)))
        shift = 6 if glitch_frame % 2 == 0 else -6
        big.paste((0, 0, 0, 0), (0, slice_y, big_w, min(big_h, slice_y + slice_h)))
        big.paste(strip, (shift, slice_y))

    return big


def build_knight_avatar_and_emblem(flame_sprite: Image.Image):
    logo_path = os.path.join(ROOT, "assets", "portfolio", "design-09.jpg")
    logo = Image.open(logo_path).convert("RGBA")
    w, h = logo.size

    side = int(min(w, h) * 0.62)
    cx, cy = int(w * 0.48), int(h * 0.56)
    crop_box = (
        max(0, cx - side // 2),
        max(0, cy - side // 2),
        min(w, cx + side // 2),
        min(h, cy + side // 2),
    )
    knight_sq = logo.crop(crop_box).resize((256, 256), Image.Resampling.LANCZOS)
    avatar_out = os.path.join(BRAND_DIR, "knight-avatar.png")
    knight_sq.save(avatar_out)
    print("Saved knight-avatar.png:", avatar_out)

    frames = []
    emblem_base = knight_sq.resize((160, 160), Image.Resampling.LANCZOS)
    for f in range(12):
        phase = (f / 12.0) * 2 * math.pi
        frame = emblem_base.copy()
        fdraw = ImageDraw.Draw(frame)

        fl_left = warp_flame_sprite(flame_sprite, phase, scale=0.38)
        fl_right = warp_flame_sprite(flame_sprite, phase + 2.2, scale=0.38)
        frame.alpha_composite(fl_left, dest=(2, 102))
        frame.alpha_composite(fl_right, dest=(114, 102))

        border_col = KNIGHT_PALETTE["armor_lavender"] if f % 4 != 0 else KNIGHT_PALETTE["flame_mid"]
        fdraw.rectangle([0, 0, 159, 159], outline=(*border_col, 255), width=3)
        fdraw.rectangle([4, 4, 155, 155], outline=(*KNIGHT_PALETTE["void_top"], 220), width=2)

        if f in (4, 9):
            strip = frame.crop((0, 64, 160, 78))
            frame.paste(strip, (4 if f == 4 else -4, 64))

        frames.append(frame.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT))

    emblem_out = os.path.join(BRAND_DIR, "knight-emblem.gif")
    frames[0].save(
        emblem_out,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        optimize=True,
    )
    print("Saved animated knight-emblem.gif:", emblem_out)


def build_animated_divider_gif():
    w, h = 900, 22
    frames = []
    n_frames = 12

    for f in range(n_frames):
        t = f / float(n_frames)
        img = Image.new("RGBA", (w, h), (*KNIGHT_PALETTE["void_top"], 255))
        draw = ImageDraw.Draw(img)

        for y in range(0, h, 2):
            draw.line([(0, y), (w, y)], fill=(24, 16, 40, 255))

        cy = h // 2
        draw.line([(0, cy), (w, cy)], fill=(*KNIGHT_PALETTE["armor_deep"], 255), width=2)

        pulse_x = int(((t * 1.2 - 0.1) % 1.0) * w)
        for dx in range(-140, 141, 4):
            px = (pulse_x + dx) % w
            dist = abs(dx) / 140.0
            alpha = int((1.0 - dist) ** 2 * 255)
            col = KNIGHT_PALETTE["flame_mid"] if abs(dx) < 55 else KNIGHT_PALETTE["armor_lavender"]
            draw.line([(px, cy - 1), (px, cy + 1)], fill=(*col, alpha), width=3)

        rng = random.Random(9001 + f)
        for i in range(18):
            bx = int((i / 18.0) * w + math.sin(t * 2 * math.pi + i) * 14) % (w - 16)
            by = rng.choice([2, cy - 4, cy + 2])
            bw = rng.choice([8, 12, 18, 26])
            bh = rng.choice([3, 4, 5])
            col = rng.choice([
                KNIGHT_PALETTE["armor_violet"],
                KNIGHT_PALETTE["armor_lavender"],
                KNIGHT_PALETTE["flame_mid"],
                KNIGHT_PALETTE["scarf_crimson"],
            ])
            draw.rectangle([bx, by, bx + bw, by + bh], fill=(*col, 235))

        frames.append(img.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT))

    out_path = os.path.join(BRAND_DIR, "divider-glitch.gif")
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=75,
        loop=0,
        optimize=True,
    )
    print("Saved animated divider-glitch.gif:", out_path)


def build_animated_banner_gif(
    filename: str,
    title_text: str,
    subtitle_text: str,
    accent_color: tuple[int, int, int],
    flame_sprite: Image.Image,
):
    """
    Creates an animated 840x260 GIF banner in the exact visual style of design-09.jpg:
    - Uses lwx_knight_style_banner_base_1792489423261.png directly (no ugly polygon triangles!)
    - Warps and animates the real painted blue soul flames in the background so they flicker & sway naturally!
    - Animates purple & crimson pixel-glitch blocks and renders crisp pixel-glitch typography ('Llewxam' style).
    """
    base_src = os.path.join(BRAIN, "lwx_knight_style_banner_base_1792489423261.png")
    w, h = 840, 260
    bg_raw = Image.open(base_src).convert("RGBA").resize((w, h), Image.Resampling.LANCZOS)

    # Extract a glow mask of all blue flames in bg_raw so we can pulse their brightness & wave them
    r_ch, g_ch, b_ch, _ = bg_raw.split()

    f_tag = load_font(14, bold=True)
    f_sub = load_font(16, bold=True)

    n_frames = 12
    frames = []

    title_normal = render_pixel_glitch_text(
        title_text,
        target_height=56,
        main_color=(*KNIGHT_PALETTE["armor_lavender"], 255),
        shadow_color=(*KNIGHT_PALETTE["armor_deep"], 255),
        glitch_frame=0,
    )
    title_glitch_a = render_pixel_glitch_text(
        title_text,
        target_height=56,
        main_color=(*KNIGHT_PALETTE["pure_white"], 255),
        shadow_color=(*KNIGHT_PALETTE["flame_outer"], 255),
        glitch_frame=3,
    )
    title_glitch_b = render_pixel_glitch_text(
        title_text,
        target_height=56,
        main_color=(*KNIGHT_PALETTE["armor_lavender"], 255),
        shadow_color=(*KNIGHT_PALETTE["scarf_crimson"], 255),
        glitch_frame=10,
    )

    max_tw = w - 180
    if title_normal.width > max_tw:
        scale_t = max_tw / float(title_normal.width)
        new_size = (int(title_normal.width * scale_t), int(title_normal.height * scale_t))
        title_normal = title_normal.resize(new_size, Image.Resampling.NEAREST)
        title_glitch_a = title_glitch_a.resize(new_size, Image.Resampling.NEAREST)
        title_glitch_b = title_glitch_b.resize(new_size, Image.Resampling.NEAREST)

    for f in range(n_frames):
        phase = (f / float(n_frames)) * 2 * math.pi
        frame = bg_raw.copy()

        # 1. Animate the real painted flames on the left & right sides via smooth wave strips
        for region_box in [(0, 60, 310, h), (530, 0, 760, h)]:
            rx0, ry0, rx1, ry1 = region_box
            sub_img = frame.crop(region_box)
            rw, rh = sub_img.size
            warped = sub_img.copy()
            for y in range(0, rh, 2):
                dx = int(math.sin(phase + y * 0.08) * 3.5)
                strip = sub_img.crop((max(0, -dx), y, min(rw, rw - dx), min(rh, y + 2)))
                warped.paste(strip, (max(0, dx), y))
            frame.paste(warped, (rx0, ry0))

        # 2. Composite two extra organic painted flame sprites swaying gently in the lower corners
        fl_left = warp_flame_sprite(flame_sprite, phase + 1.1, scale=0.68)
        fl_right = warp_flame_sprite(flame_sprite, phase + 3.7, scale=0.72)
        frame.alpha_composite(fl_left, dest=(42, h - fl_left.height + 10))
        frame.alpha_composite(fl_right, dest=(w - fl_right.width - 42, h - fl_right.height + 12))

        # Soft dark center vignette so typography is 100% crisp
        center_vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        vdraw = ImageDraw.Draw(center_vignette)
        vdraw.rounded_rectangle([155, 34, w - 155, h - 34], radius=22, fill=(10, 7, 18, 138))
        center_vignette = center_vignette.filter(ImageFilter.GaussianBlur(18))
        frame = Image.alpha_composite(frame, center_vignette)

        draw = ImageDraw.Draw(frame)

        # 3. Animated Pixel-Glitch Blocks pulsing in background
        rng = random.Random(hash(filename) + f * 31)
        for _ in range(7):
            gx = rng.choice([rng.randint(18, 165), rng.randint(w - 185, w - 28)])
            gy = rng.randint(18, h - 36)
            gw = rng.choice([14, 22, 30, 40])
            gh = rng.choice([6, 10, 16])
            col = rng.choice([
                (*KNIGHT_PALETTE["armor_violet"], 185),
                (*KNIGHT_PALETTE["armor_lavender"], 200),
                (*KNIGHT_PALETTE["scarf_crimson"], 180),
                (*KNIGHT_PALETTE["void_top"], 215),
            ])
            draw.rectangle([gx, gy, gx + gw, gy + gh], fill=col)

        # 4. Rising pixel soul-sparks (crisp small squares matching the pixel-glitch aesthetic)
        for i in range(8):
            ember_t = ((f / float(n_frames)) + i * 0.125) % 1.0
            ex = int(95 + (i * 88) % (w - 190) + math.sin(phase + i) * 12)
            ey = int(h - 18 - ember_t * (h - 46))
            es = 4 if i % 2 == 0 else 6
            alpha = int(math.sin(ember_t * math.pi) * 235)
            col = KNIGHT_PALETTE["flame_core"] if i % 2 == 0 else KNIGHT_PALETTE["armor_lavender"]
            draw.rectangle([ex, ey, ex + es, ey + es], fill=(*col, alpha))

        # 5. Top Studio Tag
        tag_str = "L L E W X A M   •   D E S I G N   S T U D I O"
        tb = draw.textbbox((0, 0), tag_str, font=f_tag)
        tw_tag = tb[2] - tb[0]
        tx_tag = (w - tw_tag) // 2
        draw.rounded_rectangle(
            [tx_tag - 16, 40, tx_tag + tw_tag + 16, 66],
            radius=6,
            fill=(*KNIGHT_PALETTE["void_top"], 215),
            outline=(*accent_color, 210),
            width=1,
        )
        draw.text((tx_tag, 45), tag_str, font=f_tag, fill=(*KNIGHT_PALETTE["flame_core"], 255))

        # 6. Pixel-Glitch Center Title
        cur_title = title_normal
        offset_x = 0
        if f == 4:
            cur_title = title_glitch_a
            offset_x = 3
        elif f == 9:
            cur_title = title_glitch_b
            offset_x = -3

        tx = (w - cur_title.width) // 2 + offset_x
        ty = 84
        frame.alpha_composite(cur_title, dest=(tx, ty))

        # 7. Clean Subtitle
        sb = draw.textbbox((0, 0), subtitle_text, font=f_sub)
        sw = sb[2] - sb[0]
        sx = (w - sw) // 2
        sy = 180
        draw.text((sx + 1, sy + 1), subtitle_text, font=f_sub, fill=(*KNIGHT_PALETTE["void_top"], 240))
        draw.text((sx, sy), subtitle_text, font=f_sub, fill=(*KNIGHT_PALETTE["pure_white"], 245))

        # 8. Top & bottom glowing border lines
        draw.rectangle([0, 0, w - 1, 3], fill=(*accent_color, 255))
        draw.rectangle([0, h - 4, w - 1, h - 1], fill=(*KNIGHT_PALETTE["flame_mid"], 255))

        frames.append(frame.convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT))

    out_path = os.path.join(BRAND_DIR, filename)
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        optimize=True,
    )
    size_kb = os.path.getsize(out_path) // 1024
    print(f"Saved animated GIF banner: {out_path} ({size_kb} KB)")


def build_custom_animated_emojis(flame_sprite: Image.Image):
    size = 96
    n_frames = 10

    def save_emoji_gif(name: str, frame_list: list[Image.Image]):
        out = os.path.join(EMOJI_DIR, f"{name}.gif")
        pal_frames = []
        for fr in frame_list:
            alpha = fr.getchannel("A")
            rgb = fr.convert("RGB").quantize(colors=63, method=Image.Quantize.FASTOCTREE)
            mask = Image.eval(alpha, lambda a: 255 if a <= 64 else 0)
            rgb.paste(63, mask)
            pal_frames.append(rgb)
        pal_frames[0].save(
            out,
            save_all=True,
            append_images=pal_frames[1:],
            duration=80,
            loop=0,
            transparency=63,
            disposal=2,
            optimize=True,
        )
        print(f"Saved custom animated emoji: {out} ({os.path.getsize(out)//1024} KB)")

    # 1. lwx_flame.gif - Uses the REAL organic painted blue flame sprite!
    flame_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        warped = warp_flame_sprite(flame_sprite, (f / float(n_frames)) * 2 * math.pi, scale=0.64)
        im.alpha_composite(warped, dest=((size - warped.width) // 2, (size - warped.height) // 2))
        flame_frames.append(im)
    save_emoji_gif("lwx_flame", flame_frames)

    # 2. lwx_knight.gif - Uses the REAL Knight head/scarf cropped from design-09.jpg!
    logo_path = os.path.join(ROOT, "assets", "portfolio", "design-09.jpg")
    logo = Image.open(logo_path).convert("RGBA")
    lw, lh = logo.size
    # Crop around the Knight's helmet & crimson scarf in design-09.jpg
    k_crop = logo.crop((int(lw * 0.22), int(lh * 0.36), int(lw * 0.66), int(lh * 0.66))).resize((size - 8, size - 8), Image.Resampling.LANCZOS)
    # Create rounded pixel badge mask
    mask = Image.new("L", (size - 8, size - 8), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([2, 2, size - 10, size - 10], radius=18, fill=255)

    knight_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        by = int(math.sin((f / float(n_frames)) * 2 * math.pi) * 2)
        card = Image.new("RGBA", (size - 8, size - 8), (0, 0, 0, 0))
        card.paste(k_crop, (0, 0), mask)
        cdraw = ImageDraw.Draw(card)
        b_col = KNIGHT_PALETTE["flame_mid"] if f in (2, 7) else KNIGHT_PALETTE["armor_lavender"]
        cdraw.rounded_rectangle([2, 2, size - 10, size - 10], radius=18, outline=(*b_col, 255), width=3)
        if f == 4:
            strip = card.crop((0, 34, size - 8, 46))
            card.paste(strip, (4, 34))
        im.alpha_composite(card, dest=(4, 4 + by))
        knight_frames.append(im)
    save_emoji_gif("lwx_knight", knight_frames)

    # 3. lwx_glitch.gif - Shifting Purple, Cyan & Crimson Pixel Glitch Blocks
    glitch_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        phase = (f / float(n_frames)) * 2 * math.pi
        blocks = [
            (18 + int(math.sin(phase) * 6), 16, 46, 44, KNIGHT_PALETTE["armor_violet"]),
            (44 - int(math.cos(phase) * 6), 28, 80, 60, KNIGHT_PALETTE["armor_lavender"]),
            (22, 48 + int(math.sin(phase) * 4), 58, 80, KNIGHT_PALETTE["flame_mid"]),
            (50, 56 - int(math.sin(phase) * 4), 78, 76, KNIGHT_PALETTE["scarf_crimson"]),
        ]
        for x0, y0, x1, y1, col in blocks:
            d.rectangle([x0, y0, x1, y1], fill=(*col, 255), outline=(12, 9, 20, 255), width=2)
        glitch_frames.append(im)
    save_emoji_gif("lwx_glitch", glitch_frames)

    # 4. lwx_crown.gif - Glowing Pixel-Art Royal Violet & Cyan Crown
    crown_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        by = int(math.sin((f / float(n_frames)) * 2 * math.pi) * 4)
        pts = [
            (14, 70 + by),
            (10, 30 + by),
            (32, 48 + by),
            (48, 20 + by),
            (64, 48 + by),
            (86, 30 + by),
            (82, 70 + by),
        ]
        d.polygon(pts, fill=(*KNIGHT_PALETTE["armor_lavender"], 255), outline=(12, 9, 20, 255))
        d.rectangle([14, 64 + by, 82, 76 + by], fill=(*KNIGHT_PALETTE["armor_violet"], 255), outline=(12, 9, 20, 255), width=2)
        gem_col = KNIGHT_PALETTE["flame_core"] if f % 2 == 0 else KNIGHT_PALETTE["flame_mid"]
        for gx, gy in [(10, 26 + by), (48, 16 + by), (86, 26 + by), (48, 66 + by)]:
            d.ellipse([gx - 5, gy - 5, gx + 5, gy + 5], fill=(*gem_col, 255))
        crown_frames.append(im)
    save_emoji_gif("lwx_crown", crown_frames)

    # 5. lwx_spark.gif - Pulsing Soul-Blue & Lavender 4-Point Stars
    spark_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        phase = (f / float(n_frames)) * 2 * math.pi
        r1 = int(28 + math.sin(phase) * 6)
        cx, cy = 48, 48
        star1 = [(cx, cy - r1), (cx + 8, cy - 8), (cx + r1, cy), (cx + 8, cy + 8), (cx, cy + r1), (cx - 8, cy + 8), (cx - r1, cy), (cx - 8, cy - 8)]
        d.polygon(star1, fill=(*KNIGHT_PALETTE["flame_mid"], 255), outline=(*KNIGHT_PALETTE["pure_white"], 255))
        r2 = int(16 - math.sin(phase) * 4)
        cx2, cy2 = 72, 24
        star2 = [(cx2, cy2 - r2), (cx2 + 4, cy2 - 4), (cx2 + r2, cy2), (cx2 + 4, cy2 + 4), (cx2, cy2 + r2), (cx2 - 4, cy2 + 4), (cx2 - r2, cy2), (cx2 - 4, cy2 - 4)]
        d.polygon(star2, fill=(*KNIGHT_PALETTE["armor_lavender"], 255))
        spark_frames.append(im)
    save_emoji_gif("lwx_spark", spark_frames)

    # 6. lwx_palette.gif - Floating Pixel Crystal cycling Knight colors
    pal_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        by = int(math.sin((f / float(n_frames)) * 2 * math.pi) * 4)
        cols = [KNIGHT_PALETTE["armor_lavender"], KNIGHT_PALETTE["flame_mid"], KNIGHT_PALETTE["scarf_crimson"]]
        c_top = cols[f % 3]
        c_bot = cols[(f + 1) % 3]
        d.polygon([(48, 10 + by), (80, 48 + by), (48, 48 + by), (16, 48 + by)], fill=(*c_top, 255), outline=(12, 9, 20, 255))
        d.polygon([(16, 48 + by), (80, 48 + by), (48, 86 + by)], fill=(*c_bot, 255), outline=(12, 9, 20, 255))
        d.polygon([(48, 18 + by), (64, 48 + by), (48, 76 + by), (32, 48 + by)], fill=(*KNIGHT_PALETTE["pure_white"], 180))
        pal_frames.append(im)
    save_emoji_gif("lwx_palette", pal_frames)

    # 7. lwx_ticket.gif - Glowing Violet & Cyan VIP Ticket Pass
    ticket_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        by = int(math.sin((f / float(n_frames)) * 2 * math.pi) * 3)
        d.rounded_rectangle([10, 24 + by, 86, 72 + by], radius=10, fill=(*KNIGHT_PALETTE["armor_violet"], 255), outline=(*KNIGHT_PALETTE["armor_lavender"], 255), width=3)
        d.rectangle([20, 32 + by, 76, 64 + by], fill=(*KNIGHT_PALETTE["void_mid"], 255))
        bar_w = 16 + int(((f / float(n_frames)) * 40))
        d.rectangle([26, 44 + by, 26 + bar_w, 52 + by], fill=(*KNIGHT_PALETTE["flame_mid"], 255))
        ticket_frames.append(im)
    save_emoji_gif("lwx_ticket", ticket_frames)

    # 8. lwx_verify.gif - Knight Shield with Glowing Cyan Checkmark
    verify_frames = []
    for f in range(n_frames):
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        pts = [(48, 10), (82, 22), (76, 60), (48, 86), (20, 60), (14, 22)]
        d.polygon(pts, fill=(*KNIGHT_PALETTE["armor_violet"], 255), outline=(*KNIGHT_PALETTE["armor_lavender"], 255))
        inner = [(48, 18), (74, 28), (68, 56), (48, 78), (28, 56), (22, 28)]
        d.polygon(inner, fill=(*KNIGHT_PALETTE["void_mid"], 255))
        chk_col = KNIGHT_PALETTE["pure_white"] if f % 3 == 0 else KNIGHT_PALETTE["flame_mid"]
        d.line([(32, 48), (44, 60), (66, 36)], fill=(*chk_col, 255), width=7)
        verify_frames.append(im)
    save_emoji_gif("lwx_verify", verify_frames)


def build_animated_palette_cards(flame_sprite: Image.Image):
    palettes_dir = os.path.join(ROOT, "assets", "palettes")
    os.makedirs(palettes_dir, exist_ok=True)

    palettes = [
        (
            "knight_glitch",
            "LLEWXAM KNIGHT GLITCH",
            [("#0D0A14", "Void CRT"), ("#8B5CF6", "Knight Violet"), ("#B794FF", "Pixel Lavender"), ("#52B7FF", "Soul Flame"), ("#D6456B", "Crimson Scarf")],
        ),
        (
            "soul_azure",
            "SOUL-FIRE AZURE & ABYSS",
            [("#070B14", "Deep Abyss"), ("#1E3A8A", "Midnight Blue"), ("#3898FF", "Electric Azure"), ("#52B7FF", "Soul Cyan"), ("#C4EBFF", "Ice Core")],
        ),
        (
            "crimson_eclipse",
            "CRIMSON ECLIPSE & DARK",
            [("#0A0608", "Obsidian"), ("#3B0813", "Dark Blood"), ("#9E1B32", "Ruby Shadow"), ("#E11D48", "Crimson Glow"), ("#FFE4E6", "Rose Light")],
        ),
        (
            "atelier_watercolor",
            "ATELIER AQUARELA & NANKIM",
            [("#140D07", "Nankim Ink"), ("#1D889B", "Cerulean Sky"), ("#EF0574", "Visor Magenta"), ("#D57461", "Terracotta"), ("#F2E8D5", "Cartolina")],
        ),
        (
            "royal_obsidian",
            "ROYAL GOLD & OBSIDIAN",
            [("#09090B", "Matte Black"), ("#18181B", "Carbon"), ("#854D0E", "Antique Bronze"), ("#EAB308", "Royal Gold"), ("#FEF08A", "Champagne")],
        ),
        (
            "cyber_amethyst",
            "CYBER AMETHYST & VAPOR",
            [("#0F0720", "Night Grid"), ("#4C1D95", "Ultraviolet"), ("#C026D3", "Neon Fuchsia"), ("#22D3EE", "Cyber Cyan"), ("#F8FAFC", "Pure White")],
        ),
    ]

    f_tag = load_font(13, bold=True)
    f_title = load_font(22, bold=True)
    f_hex = load_font(14, bold=True)
    f_lbl = load_font(12, bold=False)

    w, h = 840, 240
    for pid, pname, swatches in palettes:
        frames = []
        for f in range(8):
            phase = (f / 8.0) * 2 * math.pi
            im = Image.new("RGBA", (w, h), (*KNIGHT_PALETTE["void_top"], 255))
            d = ImageDraw.Draw(im)

            for y in range(0, h, 3):
                d.line([(0, y), (w, y)], fill=(26, 17, 44, 255))

            fl = warp_flame_sprite(flame_sprite, phase, scale=0.52)
            im.alpha_composite(fl, dest=(w - fl.width - 14, 8))

            d.rectangle([0, 0, w - 1, 3], fill=(*KNIGHT_PALETTE["armor_violet"], 255))
            d.rectangle([0, h - 4, w - 1, h - 1], fill=(*KNIGHT_PALETTE["flame_mid"], 255))

            d.text((28, 18), "LWX LAB • DIRECAO DE ARTE & PALETA CROMATICA", font=f_tag, fill=(*KNIGHT_PALETTE["armor_lavender"], 255))
            d.text((28, 40), pname, font=f_title, fill=(*KNIGHT_PALETTE["pure_white"], 255))

            sx = 28
            sy = 78
            gap = 12
            cw = (w - sx * 2 - gap * 4) // 5
            ch = 136

            for idx, (hex_str, lbl) in enumerate(swatches):
                x = sx + idx * (cw + gap)
                rgb = tuple(int(hex_str.lstrip("#")[i:i+2], 16) for i in (0, 2, 4))
                active_highlight = (f % 5) == idx
                by = -3 if active_highlight else 0

                d.rounded_rectangle([x, sy + by, x + cw, sy + ch + by], radius=8, fill=(*rgb, 255))
                d.rectangle([x, sy + ch - 44 + by, x + cw, sy + ch + by], fill=(16, 11, 28, 255))
                border_c = KNIGHT_PALETTE["flame_mid"] if active_highlight else KNIGHT_PALETTE["armor_lavender"]
                d.rounded_rectangle([x, sy + by, x + cw, sy + ch + by], radius=8, outline=(*border_c, 240), width=2 if active_highlight else 1)

                d.text((x + 10, sy + ch - 38 + by), hex_str, font=f_hex, fill=(255, 255, 255, 255))
                d.text((x + 10, sy + ch - 18 + by), lbl, font=f_lbl, fill=(*KNIGHT_PALETTE["armor_lavender"], 255))

            frames.append(im.convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT))

        out_p = os.path.join(palettes_dir, f"{pid}.gif")
        frames[0].save(out_p, save_all=True, append_images=frames[1:], duration=100, loop=0, optimize=True)
        print("Saved animated palette GIF:", out_p)


def make_open_eyes_logo(logo_img: Image.Image) -> Image.Image:
    """
    Creates the 'both eyes open, before wink' frame of the Silia AI robot by mirroring
    the left half of the robot's head (which has the open cyan eye and no golden star)
    seamlessly onto the right half!
    """
    w, h = logo_img.size
    open_img = logo_img.copy()
    mid_x = int(w * 0.492)
    span_w = int(w * 0.35)
    y0, y1 = int(h * 0.24), int(h * 0.74)

    left_half = logo_img.crop((mid_x - span_w, y0, mid_x, y1))
    mirrored_right = left_half.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    open_img.paste(mirrored_right, (mid_x, y0))
    return open_img


def build_silia_ai_assets(flame_sprite: Image.Image):
    """
    Creates:
    1. assets/brand/silia-avatar.png (256x256 cute winking robot logo with golden star)
    2. assets/brand/silia-emblem.gif (160x160 animated winking robot logo: both eyes open -> winks right eye + golden star pops!)
    3. assets/brand/banner-silia.gif (840x260 animated Silia AI banner with winking robot & pixel-glitch title)
    4. assets/emojis/lwx_silia.gif (96x96 custom animated server emoji of Silia AI winking with golden star)
    """
    logo_src = os.path.join(BRAIN, "silia_ai_winking_robot_logo_1792520834441.png")
    banner_src = os.path.join(BRAIN, "silia_ai_winking_robot_banner_1792520854277.png")

    logo_wink = Image.open(logo_src).convert("RGBA")
    logo_open = make_open_eyes_logo(logo_wink)

    avatar_256 = logo_wink.resize((256, 256), Image.Resampling.LANCZOS)
    avatar_path = os.path.join(BRAND_DIR, "silia-avatar.png")
    avatar_256.save(avatar_path)
    print("Saved silia-avatar.png:", avatar_path)

    # 1. Animated silia-emblem.gif (160x160, 12 frames: frames 0..4 eyes open, frames 5..11 wink + golden star pop!)
    emblem_wink = logo_wink.resize((160, 160), Image.Resampling.LANCZOS)
    emblem_open = logo_open.resize((160, 160), Image.Resampling.LANCZOS)
    emblem_frames = []
    for f in range(12):
        phase = (f / 12.0) * 2 * math.pi
        is_winking = f >= 5
        fr = (emblem_wink if is_winking else emblem_open).copy()
        d = ImageDraw.Draw(fr)

        if is_winking:
            star_cx, star_cy = 114, 66
            spark_r = int(14 + math.sin(phase * 2) * 5)
            if f in (5, 6, 8, 10):
                d.polygon(
                    [
                        (star_cx, star_cy - spark_r),
                        (star_cx + 4, star_cy - 4),
                        (star_cx + spark_r, star_cy),
                        (star_cx + 4, star_cy + 4),
                        (star_cx, star_cy + spark_r),
                        (star_cx - 4, star_cy + 4),
                        (star_cx - spark_r, star_cy),
                        (star_cx - 4, star_cy - 4),
                    ],
                    fill=(255, 243, 161, 235),
                    outline=(255, 215, 0, 255),
                )
            for sx, sy in [(96, 44), (132, 48), (128, 86)]:
                dy = int(math.sin(phase + sx) * 3)
                d.rectangle([sx, sy + dy, sx + 4, sy + dy + 4], fill=(255, 223, 70, 255))

        border_col = (255, 215, 0) if is_winking and f % 2 == 1 else KNIGHT_PALETTE["armor_lavender"]
        d.rectangle([0, 0, 159, 159], outline=(*border_col, 255), width=3)
        emblem_frames.append(fr.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT))

    emblem_out = os.path.join(BRAND_DIR, "silia-emblem.gif")
    emblem_frames[0].save(
        emblem_out,
        save_all=True,
        append_images=emblem_frames[1:],
        duration=90,
        loop=0,
        optimize=True,
    )
    print("Saved animated silia-emblem.gif:", emblem_out)

    # 2. Custom animated server emoji lwx_silia.gif (96x96: frames 0..3 open eyes, frames 4..9 wink + golden star!)
    size = 96
    crop_box = (
        int(logo_wink.width * 0.16),
        int(logo_wink.height * 0.22),
        int(logo_wink.width * 0.86),
        int(logo_wink.height * 0.78),
    )
    crop_wink = logo_wink.crop(crop_box).resize((size - 6, size - 6), Image.Resampling.LANCZOS)
    crop_open = logo_open.crop(crop_box).resize((size - 6, size - 6), Image.Resampling.LANCZOS)

    mask = Image.new("L", (size - 6, size - 6), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([2, 2, size - 8, size - 8], radius=22, fill=255)

    silia_emoji_frames = []
    for f in range(10):
        is_winking = f >= 4
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        by = int(math.sin((f / 10.0) * 2 * math.pi) * 2)
        card = Image.new("RGBA", (size - 6, size - 6), (0, 0, 0, 0))
        card.paste(crop_wink if is_winking else crop_open, (0, 0), mask)
        cdraw = ImageDraw.Draw(card)
        b_col = (255, 215, 0) if is_winking else KNIGHT_PALETTE["armor_lavender"]
        cdraw.rounded_rectangle([2, 2, size - 8, size - 8], radius=22, outline=(*b_col, 255), width=3)
        im.alpha_composite(card, dest=(3, 3 + by))
        silia_emoji_frames.append(im)

    emoji_out = os.path.join(EMOJI_DIR, "lwx_silia.gif")
    pal_frames = []
    for fr in silia_emoji_frames:
        alpha = fr.getchannel("A")
        rgb = fr.convert("RGB").quantize(colors=63, method=Image.Quantize.FASTOCTREE)
        m = Image.eval(alpha, lambda a: 255 if a <= 64 else 0)
        rgb.paste(63, m)
        pal_frames.append(rgb)
    pal_frames[0].save(
        emoji_out,
        save_all=True,
        append_images=pal_frames[1:],
        duration=95,
        loop=0,
        transparency=63,
        disposal=2,
        optimize=True,
    )
    print(f"Saved custom animated emoji: {emoji_out} ({os.path.getsize(emoji_out)//1024} KB)")

    # 3. Animated banner-silia.gif (840x260) using silia_ai_winking_robot_banner_1792520854277.png
    w, h = 840, 260
    bg_silia_wink = Image.open(banner_src).convert("RGBA").resize((w, h), Image.Resampling.LANCZOS)

    # Create open-eye (no star) version of banner for frames 0..4 by mirroring left half of robot head (x=470..626) onto right half
    bg_silia_open = bg_silia_wink.copy()
    r_mid = 626
    r_span = 156
    r_left = bg_silia_wink.crop((r_mid - r_span, 24, r_mid, 162)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    bg_silia_open.paste(r_left, (r_mid, 24))

    f_tag = load_font(13, bold=True)
    f_sub = load_font(15, bold=True)

    title_normal = render_pixel_glitch_text(
        "SILIA AI",
        target_height=60,
        main_color=(*KNIGHT_PALETTE["armor_lavender"], 255),
        shadow_color=(*KNIGHT_PALETTE["armor_deep"], 255),
        glitch_frame=0,
    )
    title_glitch = render_pixel_glitch_text(
        "SILIA AI",
        target_height=60,
        main_color=(255, 243, 161, 255),
        shadow_color=(*KNIGHT_PALETTE["flame_outer"], 255),
        glitch_frame=3,
    )

    banner_frames = []
    for f in range(12):
        phase = (f / 12.0) * 2 * math.pi
        is_winking = f >= 5
        frame = (bg_silia_wink if is_winking else bg_silia_open).copy()

        vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        vdraw = ImageDraw.Draw(vignette)
        vdraw.rounded_rectangle([28, 36, 488, h - 36], radius=20, fill=(10, 7, 18, 155))
        vignette = vignette.filter(ImageFilter.GaussianBlur(16))
        frame = Image.alpha_composite(frame, vignette)

        fl_left = warp_flame_sprite(flame_sprite, phase, scale=0.65)
        frame.alpha_composite(fl_left, dest=(22, h - fl_left.height + 12))

        draw = ImageDraw.Draw(frame)

        if is_winking:
            star_x, star_y = 754, 106
            sr = int(26 + math.sin(phase * 2) * 7)
            draw.polygon(
                [
                    (star_x, star_y - sr),
                    (star_x + 7, star_y - 7),
                    (star_x + sr, star_y),
                    (star_x + 7, star_y + 7),
                    (star_x, star_y + sr),
                    (star_x - 7, star_y + 7),
                    (star_x - sr, star_y),
                    (star_x - 7, star_y - 7),
                ],
                fill=(255, 230, 90, 245),
                outline=(255, 250, 200, 255),
            )

        # Left-aligned Tag Pill (using • so font renders 100% cleanly)
        tag_str = "S I L I A   A I   •   A S S I S T E N T E   L W X"
        draw.rounded_rectangle([48, 44, 434, 70], radius=6, fill=(*KNIGHT_PALETTE["void_top"], 220), outline=(255, 215, 0, 200), width=1)
        draw.text((62, 49), tag_str, font=f_tag, fill=(255, 240, 150, 255))

        cur_t = title_glitch if f in (5, 9) else title_normal
        frame.alpha_composite(cur_t, dest=(48 + (3 if f == 5 else 0), 86))

        sub1 = "Conversa Privada & Laboratorio de Ideias"
        sub2 = "Escolha um modo abaixo e mande sua mensagem!"
        draw.text((50, 174), sub1, font=f_sub, fill=(*KNIGHT_PALETTE["pure_white"], 255))
        draw.text((50, 198), sub2, font=f_sub, fill=(*KNIGHT_PALETTE["flame_core"], 240))

        draw.rectangle([0, 0, w - 1, 3], fill=(255, 215, 0, 255))
        draw.rectangle([0, h - 4, w - 1, h - 1], fill=(*KNIGHT_PALETTE["armor_violet"], 255))

        banner_frames.append(frame.convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT))

    banner_out = os.path.join(BRAND_DIR, "banner-silia.gif")
    banner_frames[0].save(
        banner_out,
        save_all=True,
        append_images=banner_frames[1:],
        duration=90,
        loop=0,
        optimize=True,
    )
    print(f"Saved animated Silia AI banner: {banner_out} ({os.path.getsize(banner_out)//1024} KB)")


def main():
    flame_sprite = extract_organic_flame_sprite()
    build_knight_avatar_and_emblem(flame_sprite)
    build_animated_divider_gif()
    build_silia_ai_assets(flame_sprite)

    banners = [
        (
            "banner-portfolio.gif",
            "PORTFOLIO LWX",
            "Acervo Oficial • Direcao de Arte & Projetos Autorais",
            KNIGHT_PALETTE["armor_lavender"],
        ),
        (
            "banner-pricing.gif",
            "TABELA & VALORES",
            "Investimento Acessivel • Prazos • Escopo & Revisoes",
            KNIGHT_PALETTE["flame_mid"],
        ),
        (
            "banner-budget.gif",
            "ORCAMENTOS",
            "Atendimento Privado • Briefing • Proposta Sob Medida",
            KNIGHT_PALETTE["scarf_crimson"],
        ),
        (
            "banner-register.gif",
            "ACESSO LWX LAB",
            "Credencial Obrigatoria • Liberacao do Servidor",
            KNIGHT_PALETTE["armor_violet"],
        ),
        (
            "banner-reviews.gif",
            "AVALIACOES",
            "Reputacao Verificada • Feedback Real de Clientes",
            KNIGHT_PALETTE["flame_mid"],
        ),
        (
            "banner-welcome.gif",
            "LWX LAB STUDIO",
            "Bem-vindo ao Estudio Criativo Oficial de Llewxam",
            KNIGHT_PALETTE["armor_lavender"],
        ),
        (
            "banner-rules.gif",
            "DIRETRIZES",
            "Codigo de Conduta • Termos de Encomenda & FAQ",
            KNIGHT_PALETTE["scarf_crimson"],
        ),
    ]

    for fname, title, sub, col in banners:
        build_animated_banner_gif(fname, title, sub, col, flame_sprite)

    build_custom_animated_emojis(flame_sprite)
    build_animated_palette_cards(flame_sprite)
    print("All organic Knight-Style & Silia AI animated GIF banners, palettes, and custom emojis generated!")


if __name__ == "__main__":
    main()
