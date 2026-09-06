# Report characters and information covers

## Original artwork

The four transparent illustrations are extracted unchanged from page 1 of the
existing `color-web/test/detailed-reports/ISTP-{red,yellow,green,blue}.pdf` reports.
`scripts/extract-report-characters.py` exports web-encoded copies; the original
reports remain unchanged. No AI redraw, replaced face, or invented limb is used.
Home selection and tied result characters use a short greeting; the wake page
uses a gentle loop with pause and reduced-motion support. Scoring is unchanged.

## Source-backed thumbnails (checked 2026-09-06)

`app/content-media.mjs` maps exact official article URLs to their published images:

- https://www.1980.org.tw/news_show.php?news_id=830 — article illustration.
- https://1980.org.tw/news_show.php?news_id=832 — article illustration.
- https://www.mohw.gov.tw/cp-16-85046-1.html — 115-year government programme poster.
- https://www.tpa-tw.org/news — 2026 annual-meeting announcement image, used only
  for the matching 2026 meeting card, not for unrelated association resources.

Images stay hosted by their sources and link back to the official text. Credits
are visible in the detail dialog. This does not imply endorsement or transfer of
copyright. Do not assume that images on a source page are freely redistributable.
Missing images use a local CSS editorial cover explicitly marked as illustrative.
The workshop page has no matching poster; generic page banners are not reused.
No unrelated association listing image or journal figure is substituted.
If an editor supplies a new non-placeholder image, it takes precedence over this
mapping. This does not enable automatic publishing or scrape visitors' browsers.

Tests: `check-characters.cjs`, `check-content-media.cjs`, `check-motion.cjs`,
`check-public-content.cjs`. The first two accept `COLORLAB_QA_URL` for read-only
live checks; their image-failure simulation affects the isolated QA browser only.
