# LA Metro Fare Evasion Dashboard

A mobile-friendly static dashboard for the Enforce the Fares campaign, hosted on
GitHub Pages.

## Updating the data

1. Replace `data/dashboard.xlsx` with the new spreadsheet (same sheet names).
2. Commit and push to `main`.

The GitHub Actions workflow (`.github/workflows/pages.yml`) converts the
spreadsheet to `data/data.json` and redeploys the site automatically. No need to
regenerate the JSON locally.

## Running locally

```sh
pip install openpyxl
python scripts/convert.py
python -m http.server 8000
# open http://localhost:8000
```

## Enabling GitHub Pages

In the repository on GitHub, go to **Settings → Pages** and set **Source** to
"GitHub Actions". The first push to `main` will deploy the site.
