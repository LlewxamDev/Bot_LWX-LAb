import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BASE_IMG_PATH = Path(
    r"C:\Users\Evandro\.gemini\antigravity\brain\84a05893-5ab6-4635-be21-b20898d8fcb6\knight_blue_fire_banner_base_1792527557027.png"
)
OUT_GIF_PATH = ROOT / "assets" / "brand" / "bot-profile-banner.gif"
ARTIFACT_GIF_PATH = Path(
    r"C:\Users\Evandro\.gemini\antigravity\brain\84a05893-5ab6-4635-be21-b20898d8fcb6\bot_profile_banner_animated.gif"
)


def build_animated_bot_profile_banner() -> None:
    W, H = 680, 272
    src = Image.open(BASE_IMG_PATH).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    arr = np.array(src, dtype=np.float32)

    R = arr[:, :, 0]
    G = arr[:, :, 1]
    B = arr[:, :, 2]

    yy, xx = np.mgrid[0:H, 0:W]
    x_norm = xx / float(W)
    y_norm = yy / float(H)

    # 1. Continuous 2D Displacement Field for the Flowing Scarf Only:
    # The flowing scarf tail sits in x_norm in [0.15, 0.55], y_norm in [0.23, 0.46].
    # Protect the Knight's helmet, shoulder, hands, and sword (everything with x_norm > 0.545 or near the sword hilt).
    is_scarf_region = (
        (x_norm >= 0.14)
        & (x_norm <= 0.545)
        & (y_norm >= 0.21)
        & (y_norm <= 0.465)
        # Exclude the sword pommel/hands area around (x_norm > 0.51 and y_norm > 0.36)
        & ~((x_norm >= 0.505) & (y_norm >= 0.355))
    )

    # Smooth the scarf region mask so the dark sky above/below stretches seamlessly with ZERO ghosting or seams!
    scarf_field_pil = Image.fromarray((is_scarf_region.astype(np.uint8) * 255), mode="L").filter(
        ImageFilter.GaussianBlur(7.5)
    )
    scarf_field = np.array(scarf_field_pil, dtype=np.float32) / 255.0

    # Strictly zero out any movement on the Knight's helmet, body, hands, and sword
    knight_rigid_zone = (
        ((x_norm >= 0.548) & (x_norm <= 0.85) & (y_norm >= 0.12) & (y_norm <= 0.94))
        | ((x_norm >= 0.50) & (x_norm <= 0.65) & (y_norm >= 0.355) & (y_norm <= 0.94))
    )
    knight_rigid_smooth = (
        np.array(
            Image.fromarray((knight_rigid_zone.astype(np.uint8) * 255), mode="L").filter(
                ImageFilter.GaussianBlur(3.0)
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    scarf_field = scarf_field * (1.0 - knight_rigid_smooth)

    # Distance from shoulder anchor (x_norm = 0.545) to left tip (x_norm = 0.17)
    dist_from_shoulder = np.clip((0.545 - x_norm) / 0.375, 0.0, 1.0)

    # 2. Blue Fire Mask (all blue flames around the bottom, left, and right, excluding the rigid Knight & Scarf)
    is_blue_flame = (B > 105) & (B > R * 1.22) & (y_norm >= 0.32)
    flame_mask_pil = Image.fromarray((is_blue_flame.astype(np.uint8) * 255), mode="L").filter(
        ImageFilter.GaussianBlur(3.5)
    )
    flame_weight = (
        (np.array(flame_mask_pil, dtype=np.float32) / 255.0)
        * (1.0 - knight_rigid_smooth)
        * (1.0 - np.clip(scarf_field * 1.5, 0.0, 1.0))
    )

    # Pre-generate rising flame tongues (pointed wisp shapes, not round dots)
    rng = np.random.default_rng(109)
    num_wisps = 28
    wisp_x = rng.uniform(0.03, 0.97, num_wisps)
    wisp_y0 = rng.uniform(0.28, 0.92, num_wisps)
    wisp_speed = rng.uniform(0.22, 0.44, num_wisps)
    wisp_h = rng.integers(6, 13, num_wisps)
    wisp_phase = rng.uniform(0, 2 * math.pi, num_wisps)

    num_frames = 16
    frames: list[Image.Image] = []

    for f in range(num_frames):
        phase = 2.0 * math.pi * f / num_frames

        # A. Scarf Wind Wave Displacement (travels smoothly from shoulder to tip)
        scarf_dy = (
            np.sin(phase - dist_from_shoulder * 4.6) * (dist_from_shoulder ** 1.15) * 9.0
            + np.cos(phase * 2.0 - dist_from_shoulder * 7.0) * (dist_from_shoulder ** 1.5) * 2.2
        ) * scarf_field
        scarf_dx = (
            np.sin(phase - dist_from_shoulder * 3.8) * (dist_from_shoulder ** 1.2) * 1.8
        ) * scarf_field

        # B. Blue Fire Upward Dancing Wave Displacement
        # Subtracting phase in y makes the flame ripples travel UPWARD!
        flame_dx = (
            3.2 * np.sin(yy / 9.5 - phase * 2.0 + xx / 21.0)
            + 1.6 * np.cos(yy / 6.0 - phase * 3.0 - xx / 15.0)
        ) * flame_weight
        flame_dy = (
            3.8 * np.cos(xx / 14.0 - phase * 2.0 + yy / 13.0)
            + 1.8 * np.sin(xx / 8.5 + phase * 1.0 - yy / 9.0)
        ) * flame_weight

        total_dx = scarf_dx + flame_dx
        total_dy = scarf_dy + flame_dy

        # Bilinear sampling of the source image for silky-smooth sub-pixel animation
        sample_x = np.clip(xx - total_dx, 0.0, W - 1.001)
        sample_y = np.clip(yy - total_dy, 0.0, H - 1.001)

        x0 = np.floor(sample_x).astype(np.int32)
        y0 = np.floor(sample_y).astype(np.int32)
        x1 = np.minimum(x0 + 1, W - 1)
        y1 = np.minimum(y0 + 1, H - 1)

        wx = (sample_x - x0)[:, :, None]
        wy = (sample_y - y0)[:, :, None]

        top_Row = arr[y0, x0] * (1.0 - wx) + arr[y0, x1] * wx
        bot_Row = arr[y1, x0] * (1.0 - wx) + arr[y1, x1] * wx
        warped = top_Row * (1.0 - wy) + bot_Row * wy

        # C. Dynamic Cloth Shading on the Waving Scarf (highlights on wave crests, shadows in troughs)
        scarf_crest = np.cos(phase - dist_from_shoulder * 4.6) * (dist_from_shoulder ** 1.1) * scarf_field
        warped[:, :, 0] = np.clip(warped[:, :, 0] + scarf_crest * 16.0, 0, 255)
        warped[:, :, 1] = np.clip(warped[:, :, 1] + scarf_crest * 5.0, 0, 255)
        warped[:, :, 2] = np.clip(warped[:, :, 2] + scarf_crest * 9.0, 0, 255)

        # D. Intense Blue Fire Glow Shimmer (pulsing cyan/ice-blue flame cores)
        shimmer = (
            0.55 * np.sin(xx / 16.0 - yy / 10.0 + phase * 2.0)
            + 0.45 * np.cos(xx / 9.0 + yy / 8.0 - phase * 1.0)
        ) * flame_weight

        warped[:, :, 1] = np.clip(warped[:, :, 1] + shimmer * 24.0, 0, 255)
        warped[:, :, 2] = np.clip(warped[:, :, 2] + shimmer * 32.0, 0, 255)

        # E. Subtle rising flame licks (pointed flame wisps rising from the blue fire bed)
        pil_frame = Image.fromarray(np.clip(warped, 0, 255).astype(np.uint8), mode="RGB").convert("RGBA")
        wisp_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        wdraw = ImageDraw.Draw(wisp_layer)

        progress = f / float(num_frames)
        for i in range(num_wisps):
            wy_norm = (wisp_y0[i] - progress * wisp_speed[i]) % 1.0
            if wy_norm < 0.25 or wy_norm > 0.88:
                continue
            wx_norm = wisp_x[i] + 0.012 * math.sin(phase * 2.0 + wisp_phase[i])
            # Keep wisps away from the Knight's body and the waving scarf
            if 0.50 <= wx_norm <= 0.84 and wy_norm < 0.85:
                continue
            if 0.16 <= wx_norm <= 0.55 and 0.20 <= wy_norm <= 0.50:
                continue

            px = int(wx_norm * W)
            py = int(wy_norm * H)
            fh = int(wisp_h[i])
            sway = int(2.5 * math.sin(phase * 2.0 + wisp_phase[i]))
            fade = math.sin(math.pi * (wy_norm - 0.25) / 0.63)
            alpha = int(max(0, min(210, 195 * fade)))

            # Teardrop/flame-tongue polygon (wide base, pointed swaying tip)
            flame_poly = [
                (px - 2, py + fh // 2),
                (px, py + fh // 2 + 2),
                (px + 2, py + fh // 2),
                (px + sway, py - fh // 2),
            ]
            wdraw.polygon(flame_poly, fill=(65, 195, 255, alpha))
            inner_poly = [
                (px - 1, py + fh // 3),
                (px + 1, py + fh // 3),
                (px + sway // 2, py - fh // 3),
            ]
            wdraw.polygon(inner_poly, fill=(210, 248, 255, min(255, int(alpha * 1.15))))

        wisp_layer = wisp_layer.filter(ImageFilter.GaussianBlur(0.4))
        pil_frame = Image.alpha_composite(pil_frame, wisp_layer).convert("RGB")
        frames.append(pil_frame)

    OUT_GIF_PATH.parent.mkdir(parents=True, exist_ok=True)
    quantized = [
        frm.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        for frm in frames
    ]

    for target in (OUT_GIF_PATH, ARTIFACT_GIF_PATH):
        quantized[0].save(
            target,
            save_all=True,
            append_images=quantized[1:],
            duration=60,
            loop=0,
            optimize=True,
        )
    print(f"Saved seamless animated bot profile banner to {OUT_GIF_PATH} ({OUT_GIF_PATH.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build_animated_bot_profile_banner()
