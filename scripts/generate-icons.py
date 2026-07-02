import os
from PIL import Image

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_png_path = os.path.join(base_dir, 'public', 'exelearning.png')
    
    if not os.path.exists(src_png_path):
        print(f"Error: source image not found at {src_png_path}")
        return

    print(f"Loading source image: {src_png_path}")
    img = Image.open(src_png_path)
    
    # Ensure it is RGBA
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # 1. Generate sizes in public/icons
    icons_dir = os.path.join(base_dir, 'public', 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    for size in sizes:
        dest_path = os.path.join(icons_dir, f"{size}x{size}.png")
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(dest_path, "PNG")
        print(f"Saved: {dest_path}")

    # 2. Generate public/exelearning.ico
    ico_path = os.path.join(base_dir, 'public', 'exelearning.ico')
    img.save(ico_path, format='ICO', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Saved ICO: {ico_path}")

    # 3. Generate public/favicon.ico
    favicon_path = os.path.join(base_dir, 'public', 'favicon.ico')
    img.save(favicon_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Saved favicon: {favicon_path}")

    # 4. Generate doc/favicon.ico if doc folder exists
    doc_favicon_path = os.path.join(base_dir, 'doc', 'favicon.ico')
    if os.path.exists(os.path.dirname(doc_favicon_path)):
        img.save(doc_favicon_path, format='ICO', sizes=[(16, 16), (32, 32)])
        print(f"Saved doc favicon: {doc_favicon_path}")

    # 5. Generate public/exe_elp.icns (macOS)
    icns_path = os.path.join(base_dir, 'public', 'exe_elp.icns')
    try:
        img.save(icns_path, format='ICNS')
        print(f"Saved ICNS: {icns_path}")
    except Exception as e:
        print(f"Error saving ICNS format using PIL: {e}")
        print("Attempting alternate ICNS generation or fallback...")

if __name__ == '__main__':
    main()
