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
2. Puppeteer prints HTML to PDF (A4, print backgrounds) on **Aasra Fincorp Pvt. Ltd.** letterhead.
3. `pdf-lib` rewrites the PDF with classic xref tables (required by `node-signpdf`).
4. On **contract execution** (customer OTP acceptance), `LoanDocumentDigitalSignerService` applies the NBFC (RE) **IT Act digital signature** via PKCS#7 using `CRESAI_PFX_FILE` + password. Pre-acceptance previews are generated **without** the NBFC certificate.
5. PDF bytes are uploaded to Spaces/local storage; `application.key_fact_esigned` is updated; the signed PDF is emailed to the borrower.

### Two kinds of “signature”

| Layer | Who | How |
|-------|-----|-----|
| **NBFC (RE) eSign** | Aasra Fincorp Pvt. Ltd. | PKCS#7 certificate in `CRESAI_PFX_FILE` — cryptographically embedded in the PDF (visible stamp on the last page, bottom-right + Adobe Signatures panel) |
| **Borrower acceptance** | Customer | OTP verification + IP address & timestamp rendered in the acceptance block (`sig_ip`, `sig_ts`, borrower name) |

On acceptance, a **visible DSC stamp** (logo, signer name, date, DSC serial) is drawn onto the **last page** of the sanction letter (bottom-right) and overlaid with the signature widget so the stamp area is tamper-bound to the PKCS#7 signature.

## Environment

```env
CRESAI_PFX_FILE=your-signing-cert.pfx
CRESAI_PFX_PASSWORD=          # or CRESAI_PASSWORD
PUPPETEER_EXECUTABLE_PATH=      # optional; system Chromium path
# Signature panel metadata (defaults: Aasra Fincorp Pvt. Ltd., New Delhi IN, info@moneycash.in)
# LOAN_DOCUMENT_SIGN_NAME=
# LOAN_DOCUMENT_SIGN_LOCATION=
# LOAN_DOCUMENT_SIGN_CONTACT=
# Optional RFC-3161 TSA (DocTimeStamp after NBFC PKCS#7 sign)
# LOAN_DOCUMENT_TSA_URL=https://your-tsa.example.com/tsr
# LOAN_DOCUMENT_TSA_LTV=false
```

Optional (not used by `node-signpdf` today): `CERSAI_INSTITUTION_CODE`, `CRESAI_USER_ADMINISTRATOR`.

Spaces: see `backend/.env.example` (`STORAGE_DRIVER=spaces`, `SPACES_ENDPOINT`, `SPACES_KEY_PREFIX=local`).

## Chromium / Puppeteer (staging / production)

Loan PDFs require a Chromium/Chrome binary. The backend auto-detects common paths (`/usr/bin/chromium`, `/usr/bin/chromium-browser`, …). If none exist, Puppeteer falls back to its bundled browser (installed via `npm ci` unless `PUPPETEER_SKIP_DOWNLOAD=true`).

**Staging checklist**

1. Install Chromium and fonts on the backend host:

```bash
sudo apt-get update
sudo apt-get install -y chromium fonts-liberation fonts-noto-core ca-certificates
```

2. Set the path only if auto-detect fails (Debian Bookworm uses `/usr/bin/chromium`, not `chromium-browser`):

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

   **Do not** use `/usr/bin/chromium-browser` on Ubuntu — it is a Snap wrapper and fails under PM2/systemd (`not a snap cgroup for tag snap.chromium.chromium`).

3. Avoid pointing at a non-existent path — a bad `PUPPETEER_EXECUTABLE_PATH` prevents Puppeteer from launching.

4. If using `PUPPETEER_SKIP_DOWNLOAD=true`, you **must** install system Chromium; bundled Chromium is not downloaded.

5. Restart the backend after changing env vars, then trigger a loan-document preview/acceptance flow and check logs for `Using Chromium at …` or Puppeteer launch errors.

## Local preview

```bash
cd backend
npm install
npm run loan-docs:preview-pdf
# → storage/local/preview/loan-document-preview.pdf
```

On a **minimal Linux VPS**, bundled Puppeteer Chrome fails with `libatk-1.0.so.0`. One-time setup:

```bash
cd backend
npm run loan-docs:setup-chromium
npm run loan-docs:preview-pdf
```

You should see `Using Chromium at /usr/bin/chromium`. Set the same in `.env` for the running backend:

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

## Editing the template

After changing `MoneyCash_Loan_Document.html`, update field IDs in `loan-document-html-field-map.util.ts` if new inputs are added. Regenerate a preview PDF and spot-check pagination.

Legacy Word/PDF overlay templates (`*.template.pdf`, `*.fields.json`) are no longer used at runtime.
