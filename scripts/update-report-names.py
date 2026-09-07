"""Replace only the two cover labels; verify all other content before publishing.

Requires PyMuPDF. Originals and verification artifacts remain outside public output.
"""
import argparse
import hashlib
import json
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'color-web/test/detailed-reports'
BACKUPS = ROOT / 'tmp/pdfs/originals'
REPLACEMENTS = {
    '測驗網站：心色探索館': ('測驗網站：', 'ColorLab'),
    '測驗名稱：我在色彩學當中的人格': ('測驗名稱：我在色彩學中的 ', 'MBTI'),
}

def spans(page):
    return [s for b in page.get_text('dict')['blocks'] if 'lines' in b
            for line in b['lines'] for s in line['spans']]

def audit(path):
    with fitz.open(path) as doc:
        found = [(p.number, s) for p in doc for s in spans(p) if s['text'] in REPLACEMENTS]
        assert len(found) == 2 and all(i == 0 for i, _ in found), path.name
        assert {s['text'] for _, s in found} == set(REPLACEMENTS), path.name
        return found

def image_hashes(doc):
    return [[hashlib.sha256(doc.xref_stream(x[0])).hexdigest() for x in p.get_images()] for p in doc]

def update(path):
    original = BACKUPS / path.name
    assert not original.exists(), f'Backup already exists: {path.name}'
    before = path.read_bytes()
    original.write_bytes(before)
    doc = fitz.open(stream=before, filetype='pdf')
    page = doc[0]
    targets = [s for s in spans(page) if s['text'] in REPLACEMENTS]
    font_ref = next(f[0] for f in page.get_fonts() if 'NotoSansTC-Regular' in f[3])
    font_data = doc.extract_font(font_ref)[3]
    cjk = fitz.Font(fontbuffer=font_data)
    latin = fitz.Font('helv')
    rects = [fitz.Rect(s['bbox']) for s in targets]
    for rect in rects:
        page.add_redact_annot(rect, fill=(1, 1, 1), cross_out=False)
    # Explicitly retain every embedded image and vector graphic.
    page.apply_redactions(images=0, graphics=0, text=0)
    page.insert_font(fontname='ColorLabCJK', fontbuffer=font_data)
    for target in targets:
        prefix, suffix = REPLACEMENTS[target['text']]
        assert all(cjk.has_glyph(ord(c)) for c in prefix), path.name
        size = target['size']
        total = cjk.text_length(prefix, fontsize=size) + latin.text_length(suffix, fontsize=size)
        x = target['bbox'][2] - total
        y = target['origin'][1]
        assert x > 0 and y < page.rect.height
        color = fitz.sRGB_to_pdf(target['color'])
        page.insert_text((x, y), prefix, fontname='ColorLabCJK', fontsize=size, color=color)
        x += cjk.text_length(prefix, fontsize=size)
        page.insert_text((x, y), suffix, fontname='helv', fontsize=size, color=color)
        rects.append(fitz.Rect(target['bbox'][2] - total - 2, target['bbox'][1] - 2,
                               target['bbox'][2] + 2, target['bbox'][3] + 2))
    updated = doc.tobytes(garbage=3, deflate=True)
    doc.close()
    with fitz.open(stream=before, filetype='pdf') as old, fitz.open(stream=updated, filetype='pdf') as new:
        assert len(old) == len(new)
        assert image_hashes(old) == image_hashes(new), f'Artwork changed: {path.name}'
        expected = old[0].get_text()
        actual = new[0].get_text()
        for a, (prefix, suffix) in REPLACEMENTS.items():
            expected = expected.replace(a, '')
            # Some PDF extractors insert a line break between font runs.
            actual = actual.replace(prefix.strip(), '').replace(suffix, '')
        assert ''.join(expected.split()) == ''.join(actual.split()), f'Other text changed: {path.name}'
        for i in range(1, len(old)):
            assert old[i].get_text() == new[i].get_text(), f'Page {i+1}: {path.name}'
            assert old[i].get_pixmap().samples == new[i].get_pixmap().samples, f'Render page {i+1}: {path.name}'
        # Cover render must be identical outside the old/new label areas.
        for d in (old, new):
            for rect in rects:
                d[0].draw_rect(rect, color=None, fill=(1, 1, 1), overlay=True)
        assert old[0].get_pixmap().samples == new[0].get_pixmap().samples, f'Cover art/layout changed: {path.name}'
    path.write_bytes(updated)
    return {'file': path.name, 'pages': len(fitz.open(stream=updated, filetype='pdf')),
            'sha256': hashlib.sha256(updated).hexdigest(), 'other_text_images_and_render': 'unchanged'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--only')
    args = parser.parse_args()
    files = sorted(REPORTS.glob(args.only or '*.pdf'))
    for path in files:
        audit(path)
    print(f'Audit passed: {len(files)} PDFs, exactly two cover labels each.', flush=True)
    if not args.apply:
        return
    BACKUPS.mkdir(parents=True, exist_ok=True)
    results = []
    for index, path in enumerate(files):
        results.append(update(path))
        if index % 20 == 0:
            print(f'Verified {index+1}/{len(files)}', flush=True)
    (ROOT / 'tmp/pdfs/name-update-verification.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(f'Updated and verified: {len(results)} PDFs.', flush=True)

if __name__ == '__main__':
    main()
