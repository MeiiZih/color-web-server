"""Extract the original embedded artwork; never redraw or modify the reports."""
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
output = root / 'color-web/assets/characters'
output.mkdir(parents=True, exist_ok=True)
for color in ('red', 'yellow', 'green', 'blue'):
    source = root / f'color-web/test/detailed-reports/ISTP-{color}.pdf'
    images = list(PdfReader(source).pages[0].images)
    assert len(images) == 1, f'Inspect {source} before selecting artwork'
    image = images[0]
    target = output / f'{color}.webp'
    image.image.save(target, format='WEBP', quality=85, method=6)
    print(color, image.image.size, image.image.mode, target.stat().st_size)
