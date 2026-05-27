#!/usr/bin/env python3
"""Rebrand loan DOCX templates: Bansal → MoneyCash and embed MoneyCash logo."""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'assets' / 'loan-documents' / 'templates'
LOGO_SRC = ROOT / 'assets' / 'loan-documents' / 'moneycash-logo.png'
LOGO_MEDIA = 'moneycash-logo.png'
KFS_IMAGE_RID = 'rId11'

REPLACEMENTS: list[tuple[str, str]] = [
    ('https://www.bansalinhold.com/', 'https://www.moneycash.in/'),
    ('http://www.bansalinhold.com/', 'https://www.moneycash.in/'),
    ('https://www.bansalinhold.com', 'https://www.moneycash.in'),
    ('http://www.bansalinhold.com', 'https://www.moneycash.in'),
    ('bansalinholdltd95@gmail.com', 'legal@moneycash.in'),
    ('BANSAL IN-HOLD LIMITED', 'MoneyCash'),
    ('Bansal In-Hold Limited', 'MoneyCash'),
]

BANSAL_ENTITY_SPLIT = re.compile(
    r'BANSAL IN-HOLD\s*</w:t>\s*</w:r>\s*<w:r[^>]*>\s*(?:<w:rPr>[\s\S]*?</w:rPr>\s*)?<w:t>\s*LIMITED',
    re.IGNORECASE,
)

LOGO_PARA_PATTERN = re.compile(r'<w:p[^>]*>[\s\S]*?LOGO Company[\s\S]*?</w:p>', re.IGNORECASE)


def load_logo_png() -> bytes:
    if not LOGO_SRC.is_file():
        raise FileNotFoundError(f'Missing logo: {LOGO_SRC}')
    data = LOGO_SRC.read_bytes()
    try:
        from PIL import Image

        with Image.open(BytesIO(data)) as img:
            img = img.convert('RGBA')
            img.thumbnail((875, 320), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (875, 320), (255, 255, 255, 0))
            ox = (875 - img.width) // 2
            oy = (320 - img.height) // 2
            canvas.paste(img, (ox, oy), img)
            out = BytesIO()
            canvas.save(out, format='PNG')
            return out.getvalue()
    except ImportError:
        return data


def patch_xml(xml: str) -> str:
    out = BANSAL_ENTITY_SPLIT.sub('MoneyCash', xml)
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)
    out = out.replace('IN-HOLD LIMITED i.e.', 'MoneyCash i.e.')
    out = out.replace('official website of BANSAL', 'official website of MoneyCash')
    out = re.sub(r'(<w:t[^>]*>)\s*BANSAL\s*(</w:t>)', r'\1MoneyCash\2', out)
    out = re.sub(r'(<w:t[^>]*>)\s*IN-HOLD\s*(</w:t>)', r'\1\2', out)
    out = re.sub(r'(<w:t[^>]*>)\s*LIMITED\s*(</w:t>)', r'\1\2', out)
    return out


def extract_logo_paragraph(loan_agreement: Path) -> str:
    with zipfile.ZipFile(loan_agreement) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    for match in re.finditer(r'<w:p[^>]*>[\s\S]*?</w:p>', xml):
        para = match.group()
        if 'r:embed="rId7"' in para and not re.sub(r'<[^>]+>', '', para).strip():
            return para.replace('r:embed="rId7"', f'r:embed="{KFS_IMAGE_RID}"')
    raise RuntimeError('Logo paragraph not found in loan-agreement.docx')


def patch_docx(path: Path, *, inject_kfs_logo: str | None) -> None:
    logo_png = load_logo_png()
    backup = path.with_suffix(path.suffix + '.bak')
    if not backup.exists():
        shutil.copy2(path, backup)

    out_buf = BytesIO()
    with zipfile.ZipFile(path, 'r') as zin:
        with zipfile.ZipFile(out_buf, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            wrote_logo_media = False
            for info in zin.infolist():
                name = info.filename
                raw = zin.read(name)

                if name.endswith('.xml') or name.endswith('.rels'):
                    text = patch_xml(raw.decode('utf-8'))
                    if name == 'word/document.xml' and inject_kfs_logo:
                        text = LOGO_PARA_PATTERN.sub(inject_kfs_logo, text, count=1)
                    raw = text.encode('utf-8')

                if name == 'word/media/image1.png':
                    raw = logo_png

                if inject_kfs_logo and name == f'word/media/{LOGO_MEDIA}':
                    raw = logo_png
                    wrote_logo_media = True

                zout.writestr(info, raw)

            if inject_kfs_logo and not wrote_logo_media:
                zout.writestr(f'word/media/{LOGO_MEDIA}', logo_png)

    data = out_buf.getvalue()
    if inject_kfs_logo:
        data = _ensure_kfs_rels_and_content_types(data)

    path.write_bytes(data)
    print(f'Patched {path.name}')


def _ensure_kfs_rels_and_content_types(data: bytes) -> bytes:
    out_buf = BytesIO()
    with zipfile.ZipFile(BytesIO(data), 'r') as zin:
        files = {i.filename: zin.read(i.filename) for i in zin.infolist()}
    rels_key = 'word/_rels/document.xml.rels'
    ct_key = '[Content_Types].xml'
    rels = files[rels_key].decode('utf-8')
    if f'media/{LOGO_MEDIA}' not in rels:
        rels = rels.replace(
            '</Relationships>',
            f'<Relationship Id="{KFS_IMAGE_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{LOGO_MEDIA}"/></Relationships>',
        )
    files[rels_key] = rels.encode('utf-8')
    ct = files[ct_key].decode('utf-8')
    if 'Extension="png"' not in ct:
        ct = ct.replace(
            '</Types>',
            '<Default Extension="png" ContentType="image/png"/></Types>',
        )
    files[ct_key] = ct.encode('utf-8')
    with zipfile.ZipFile(out_buf, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for name, raw in files.items():
            zout.writestr(name, raw)
    return out_buf.getvalue()


def main() -> int:
    kfs = TEMPLATES / 'key-fact-statement.docx'
    agreement = TEMPLATES / 'loan-agreement.docx'
    if not kfs.is_file() or not agreement.is_file():
        print('Missing templates:', TEMPLATES, file=sys.stderr)
        return 1
    logo_para = extract_logo_paragraph(agreement)
    patch_docx(agreement, inject_kfs_logo=None)
    patch_docx(kfs, inject_kfs_logo=logo_para)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
