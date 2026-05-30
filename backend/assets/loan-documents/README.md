# Loan document PDF templates

Customer sanction letter (Key Fact Statement) and loan agreement PDFs are generated at runtime from **pre-built templates** — no LibreOffice in production.

## Files

| File | Purpose |
|------|---------|
| `templates/*.docx` | Source layout (edit in Word; dev only) |
| `templates/*.template.pdf` | Frozen PDF shell committed to git |
| `templates/*.fields.json` | Overlay coordinates for `[NAME]`, `[AMOUNT]`, etc. |

Per-application filled PDFs are written under `KYC_FILES_ROOT`:

`customer/<customer_uuid>/loan-documents/<application_uuid>/key-fact-statement.pdf`

## After editing Word templates

On a machine with LibreOffice and poppler (`pdftotext`), convert each DOCX to PDF and commit the outputs:

```bash
cd backend/assets/loan-documents/templates
soffice --headless --convert-to pdf --outdir . key-fact-statement.docx
soffice --headless --convert-to pdf --outdir . loan-agreement.docx
mv key-fact-statement.pdf key-fact-statement.template.pdf
mv loan-agreement.pdf loan-agreement.template.pdf
```

Regenerate `*.fields.json` overlay maps from the template PDFs (requires `pdftotext -bbox`) or adjust coordinates manually in the JSON files.

Commit updated `*.template.pdf` and `*.fields.json`.
