#!/usr/bin/env python3
"""Generate simple placeholder icons for Chrome extension"""
from PIL import Image, ImageDraw, ImageFont
import os

# Create icons directory
icons_dir = "extension/icons"
os.makedirs(icons_dir, exist_ok=True)

# Icon sizes
sizes = [16, 32, 48, 128]

# Colors - gradient purple
color1 = (102, 126, 234)  # #667eea
color2 = (118, 75, 162)   # #764ba2

for size in sizes:
    # Create new image with gradient background
    img = Image.new('RGB', (size, size), color1)
    draw = ImageDraw.Draw(img)

    # Create gradient effect
    for y in range(size):
        ratio = y / size
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # Add white circle in center
    circle_size = int(size * 0.7)
    circle_margin = (size - circle_size) // 2
    draw.ellipse(
        [circle_margin, circle_margin, size - circle_margin, size - circle_margin],
        fill='white'
    )

    # Add lightning bolt emoji text (simplified as 'C' for Chaptr)
    try:
        # Try to use a nice font
        font_size = int(size * 0.5)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()

        # Draw 'C' in center
        text = "C"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        x = (size - text_width) // 2
        y = (size - text_height) // 2 - int(size * 0.05)  # Slight adjustment

        draw.text((x, y), text, fill=color1, font=font)
    except:
        # If font fails, just use circle
        pass

    # Save icon
    output_path = f"{icons_dir}/icon{size}.png"
    img.save(output_path, "PNG")
    print(f"✓ Created {output_path}")

print("\n✅ All icons generated!")
