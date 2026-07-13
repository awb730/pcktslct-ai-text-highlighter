from PIL import Image

source = Image.open("pocket-select-logo.png")

sizes = [16, 48, 128]
for size in sizes:
    resized = source.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(f"pocket-icon{size}.png")

print("Done — icons generated.")