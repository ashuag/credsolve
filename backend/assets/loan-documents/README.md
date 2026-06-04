# Loan document PDF (HTML → signed PDF)

Customers receive a single **Loan Sanction letter cum Key Fact Statement** PDF generated at runtime from the HTML template.

## Files

| File | Purpose |
|------|---------|
| `templates/MoneyCash_Loan_Document.html` | Source layout (sanction letter, KFS, commercial terms) |
| `moneycash-logo.png`, `asra-fincorp-logo.png` | Assets referenced in HTML |

Per-application filled PDFs are stored via `KycFilesService` (DigitalOcean Spaces or local disk):

`customer/<customer_uuid>/loan-documents/<application_uuid>/key-fact-statement.pdf`

With `SPACES_KEY_PREFIX=local`, objects live under `mcashin/local/customer/...` on `sgp1.digitaloceanspaces.com`.

## Generation pipeline

1. `buildLoanDocumentHtmlFieldValues()` fills HTML `input#id` fields from application/lead data.
2. Puppeteer prints HTML to PDF (A4, print backgrounds).
3. `pdf-lib` rewrites the PDF with classic xref tables (required by `node-signpdf`).
4. `LoanDocumentDigitalSignerService` PKCS#7-signs using `CRESAI_PFX_FILE` + password env vars.
5. PDF bytes are uploaded to Spaces/local storage; `application.key_fact_esigned` is updated.

## Environment

```env
CRESAI_PFX_FILE=your-signing-cert.pfx
CRESAI_PFX_PASSWORD=          # or CRESAI_PASSWORD
PUPPETEER_EXECUTABLE_PATH=      # optional; system Chromium path
```

Optional (not used by `node-signpdf` today): `CERSAI_INSTITUTION_CODE`, `CRESAI_USER_ADMINISTRATOR`.

Spaces: see `backend/.env.example` (`STORAGE_DRIVER=spaces`, `SPACES_ENDPOINT`, `SPACES_KEY_PREFIX=local`).

## Chromium / Puppeteer (production)

Install Chromium and dependencies on the backend host, or set `PUPPETEER_EXECUTABLE_PATH`.

Debian/Ubuntu example:

```bash
sudo apt-get install -y chromium-browser fonts-liberation
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Local preview

```bash
cd backend
npm install
npm run loan-docs:preview-pdf
# → storage/local/preview/loan-document-preview.pdf
```

## Editing the template

After changing `MoneyCash_Loan_Document.html`, update field IDs in `loan-document-html-field-map.util.ts` if new inputs are added. Regenerate a preview PDF and spot-check pagination.

Legacy Word/PDF overlay templates (`*.template.pdf`, `*.fields.json`) are no longer used at runtime.
