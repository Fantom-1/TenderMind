# Sample data

Drop demo documents here so evaluators can run the full pipeline without
hunting for test files.

## Layout

```
sample_data/
├── tender/                          One RFP / tender document
│   └── <your-tender>.pdf            digital PDF, scanned PDF, or DOCX
└── bidders/
    ├── bidder_a/                    Each bidder = one folder
    │   ├── company_profile.pdf
    │   ├── financials.pdf
    │   └── certifications.pdf
    ├── bidder_b/
    │   └── ...
    └── bidder_c/                    Include at least one blurry scan to
        └── blurry_scan.pdf          showcase the NEEDS_REVIEW flow.
```

## Suggested mix

- **`tender/`** — one CRPF-style procurement RFP with clear mandatory
  criteria (turnover, certifications, delivery timelines, etc.).
- **`bidders/bidder_a/`** — clean documents that should pass.
- **`bidders/bidder_b/`** — partially compliant; missing one mandatory
  certificate, expect `NOT_ELIGIBLE`.
- **`bidders/bidder_c/`** — at least one blurry/low-resolution scan so OCR
  confidence drops below the threshold and the item lands in the review
  queue (`NEEDS_REVIEW`).

## How to use these in the app

1. Log in as `uploader@demo.local` / `Uploader@123`.
2. Tenders → **Upload tender** → pick `sample_data/tender/<file>.pdf`.
3. Wait for criteria extraction to finish (status pill flips to
   `criteria_extracted`).
4. Open the tender → **Bidders** tab → for each `bidder_*/` folder click
   **Add a bidder**, name it, and select all files in that folder
   (multi-select with Ctrl/Shift).
5. Tick the bidders → **Run evaluation**.
6. Open each bidder to see verdict + confidence breakdown.
7. Log in as `approver@demo.local` / `Approver@123` to approve and
   download the signed PDF.

## Privacy

Anything you place in this folder is treated as demo content and may be
committed to the repo. Do **not** put real procurement data here.
