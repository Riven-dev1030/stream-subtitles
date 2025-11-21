#!/usr/bin/env python3
"""
Generate Chrome Extension icons for Stream Subtitles
Creates 4 sizes: 16x16, 32x32, 48x48, 128x128
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Create icons directory if it doesn't exist
icons_dir = 'extension/icons'
os.makedirs(icons_dir, exist_ok=True)

# Icon sizes to generate
sizes = [16, 32, 48, 128]

# Colors - matching the extension theme
gradient_start = (102, 126, 234)  # #667eea
gradient_end = (118, 75, 162)     # #764ba2
white = (255, 255, 255)

def create_gradient_background(size):
    """Create a vertical gradient from purple to darker purple"""
    image = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(image)

    for y in range(size):
        # Calculate color for this row
        ratio = y / size
        r = int(gradient_start[0] + (gradient_end[0] - gradient_start[0]) * ratio)
        g = int(gradient_start[1] + (gradient_end[1] - gradient_start[1]) * ratio)
        b = int(gradient_start[2] + (gradient_end[2] - gradient_start[2]) * ratio)

        draw.line([(0, y), (size, y)], fill=(r, g, b))

    return image

def draw_subtitle_icon(draw, size):
    """Draw subtitle bars on the icon"""
    # Calculate dimensions based on icon size
    padding = size // 8
    bar_height = max(2, size // 16)
    spacing = max(2, size // 12)

    # Draw three horizontal bars (representing subtitle text lines)
    y_start = size - padding - bar_height * 3 - spacing * 2

    for i in range(3):
        y = y_start + i * (bar_height + spacing)
        width = size - padding * 2

        # Make middle bar slightly shorter for visual interest
        if i == 1:
            x_offset = size // 10
            draw.rectangle(
                [padding + x_offset, y, padding + width - x_offset, y + bar_height],
                fill=white
            )
        else:
            draw.rectangle(
                [padding, y, padding + width, y + bar_height],
                fill=white
            )

def create_icon(size):
    """Create a single icon of the specified size"""
    # Create gradient background
    image = create_gradient_background(size)
    draw = ImageDraw.Draw(image)

    # Add rounded corners for larger sizes
    if size >= 48:
        # Create mask for rounded corners
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        radius = size // 8
        mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)

        # Apply mask
        rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        rounded.paste(image, (0, 0))
        rounded.putalpha(mask)
        image = rounded
        draw = ImageDraw.Draw(image)

    # Draw subtitle icon
    draw_subtitle_icon(draw, size)

    # Add a small play triangle for larger icons
    if size >= 48:
        triangle_size = size // 6
        center_x = size // 2
        center_y = size // 3

        triangle = [
            (center_x - triangle_size//2, center_y - triangle_size//2),
            (center_x - triangle_size//2, center_y + triangle_size//2),
            (center_x + triangle_size//2, center_y)
        ]
        draw.polygon(triangle, fill=white)

    return image

# Generate all icon sizes
print("Generating Chrome Extension icons...")

for size in sizes:
    icon = create_icon(size)
    filename = f'{icons_dir}/icon{size}.png'
    icon.save(filename, 'PNG')
    print(f"✓ Generated {filename}")

print("\n✓ All icons generated successfully!")
print(f"  Location: {icons_dir}/")
print(f"  Files: {', '.join([f'icon{s}.png' for s in sizes])}")
