# BukidPay brand assets

The approved BukidPay logo is the source of truth for the product identity.
Do not redraw the monogram, replace the lettering with a font, alter its
spacing, or recolor individual shapes.

## Production assets

- `public/brand/bukidpay-logo.svg` — complete vertical logo lockup with the
  BukidPay wordmark.
- `public/brand/bukidpay-mark.svg` — symbol-only trace from the exact approved
  artwork, for compact placements such as the app header and icon.

Both production SVGs have transparent backgrounds and path-based artwork; they
contain no live text or embedded raster image.

## Canonical palette

- Forest: `#0A4227`
- Leaf: `#619F3B`

## Trace records

The approved source PNG, palette-canonical PNG, and untouched VTracer output
are retained in `.artifacts/brand/`. The vector was generated with VTracer
1.0.0-alpha.3, distributed under the MIT License.

The approved raster contains subtle tonal variation and antialiasing. The
production SVG intentionally resolves that variation to the two canonical flat
brand colors while preserving the source geometry, lettering, and spacing.
