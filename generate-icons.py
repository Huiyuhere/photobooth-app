#!/usr/bin/env python3
"""
Generate all required iOS app icon sizes from the source icon.
"""

from PIL import Image
import os

# Source icon path
SOURCE_ICON = "/home/ubuntu/photobooth-app/client/public/images/app-icon.png"

# iOS icon sizes (size, scale, idiom, filename)
IOS_ICONS = [
    # iPhone
    (20, 2, "iphone", "AppIcon-20x20@2x.png"),
    (20, 3, "iphone", "AppIcon-20x20@3x.png"),
    (29, 2, "iphone", "AppIcon-29x29@2x.png"),
    (29, 3, "iphone", "AppIcon-29x29@3x.png"),
    (40, 2, "iphone", "AppIcon-40x40@2x.png"),
    (40, 3, "iphone", "AppIcon-40x40@3x.png"),
    (60, 2, "iphone", "AppIcon-60x60@2x.png"),
    (60, 3, "iphone", "AppIcon-60x60@3x.png"),
    # iPad
    (20, 1, "ipad", "AppIcon-20x20@1x.png"),
    (20, 2, "ipad", "AppIcon-20x20@2x-ipad.png"),
    (29, 1, "ipad", "AppIcon-29x29@1x.png"),
    (29, 2, "ipad", "AppIcon-29x29@2x-ipad.png"),
    (40, 1, "ipad", "AppIcon-40x40@1x.png"),
    (40, 2, "ipad", "AppIcon-40x40@2x-ipad.png"),
    (76, 1, "ipad", "AppIcon-76x76@1x.png"),
    (76, 2, "ipad", "AppIcon-76x76@2x.png"),
    (83.5, 2, "ipad", "AppIcon-83.5x83.5@2x.png"),
    # App Store
    (1024, 1, "ios-marketing", "AppIcon-1024x1024@1x.png"),
]

def generate_icons():
    # Load source icon
    source = Image.open(SOURCE_ICON)
    
    # Output directory
    output_dir = "/home/ubuntu/photobooth-app/ios/App/App/Assets.xcassets/AppIcon.appiconset"
    
    # Ensure directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate each icon size
    for base_size, scale, idiom, filename in IOS_ICONS:
        size = int(base_size * scale)
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        output_path = os.path.join(output_dir, filename)
        resized.save(output_path, "PNG")
        print(f"Generated: {filename} ({size}x{size})")
    
    # Generate Contents.json
    contents = {
        "images": [],
        "info": {
            "author": "xcode",
            "version": 1
        }
    }
    
    for base_size, scale, idiom, filename in IOS_ICONS:
        size_str = f"{int(base_size)}x{int(base_size)}" if base_size == int(base_size) else f"{base_size}x{base_size}"
        contents["images"].append({
            "filename": filename,
            "idiom": idiom,
            "scale": f"{scale}x",
            "size": size_str
        })
    
    import json
    contents_path = os.path.join(output_dir, "Contents.json")
    with open(contents_path, "w") as f:
        json.dump(contents, f, indent=2)
    print(f"Generated: Contents.json")

if __name__ == "__main__":
    generate_icons()
    print("\\nAll iOS app icons generated successfully!")
