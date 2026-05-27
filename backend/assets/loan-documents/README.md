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

On a machine with LibreOffice and poppler (`pdftotext`):

```bash
cd backend
npm run loan-docs:build-templates
npm run loan-docs:generate-field-maps
```

Commit updated `*.template.pdf` and `*.fields.json`.
