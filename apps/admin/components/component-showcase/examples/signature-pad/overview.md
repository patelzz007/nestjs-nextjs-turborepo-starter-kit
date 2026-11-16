## When to use

- Contracts, agreements and statements of work signed in place, down to initials per clause
- Required form fields, proof of delivery on a phone, and a profile signature reused on documents
- Mouse, finger or stylus ink exported as PNG, JPEG, SVG or JSON, or uploaded as an image `Blob`

## When not to use

- A scanned or photographed mark the signer already has as an image: use [File Upload](/components/file-upload)
- A typed name accepted as a signature: an [Input](/components/input) is enough (the Draw or Type example offers both)

## Notes

- Image exports draw ink that has no `color` of its own in black, on a transparent background except `jpeg`; pass `background` for paper white
- `readOnly` locks a signed pad at full ink strength while `disabled` dims it; both stop input and drop the area from the tab order
- With `name` set, keep `format` as `svg` or `json`: `png` and `jpeg` rasterise the hidden form field after every stroke

## Signature Pad: drawn signatures for forms and documents

`SignaturePad` captures a handwritten signature with a mouse, a finger or a stylus. Strokes are stored as data — points with pressure — so a signature can be undone, redrawn at any size and exported as an image, SVG or JSON.

### What is Signature Pad?

A drawing surface with the parts a signing flow needs: a guide line, a placeholder, controls for undo, redo, clear and save, and a preview of a saved signature. Helpers turn strokes into an SVG path, a data URL or a `Blob` for upload.

### Why use Signature Pad?

Agreements, deliveries and consent forms often need a signature on the spot. Storing strokes instead of a bitmap keeps signatures crisp at any size, makes undo trivial and lets you choose the export format later.

### Signature Pad features

- **Pressure and smoothing.** Strokes follow pen pressure; stylus mode ignores the palm.
- **Undo and redo.** Per stroke, with the standard shortcuts.
- **Exports.** PNG, JPEG, SVG, JSON, or a `Blob` through `signaturePadToBlob`.
- **Forms.** `name` submits the signature with a native form; `required` and `aria-invalid` for validation.
- **Read-only and disabled.** Show a signed pad without allowing changes.

## Integrating with other components

Put it in a [Field](/components/field) for a label and an error, in a [Dialog](/components/dialog) for "sign to continue", or in a [Card](/components/card) under the agreement's terms. Upload the exported `Blob` with your API and show it later with `SignaturePadPreview`.

## Frequently asked questions

### Which format should I store?

JSON keeps the strokes, so you can re-render, re-export or replay them; SVG is a compact, sharp image; PNG and JPEG suit systems that only take bitmaps.

### Does it work on phones and tablets?

Yes. It takes touch and pen input, follows pressure where the device reports it, and stylus mode ignores a resting palm.

### How do I make the signature required?

Set `required` and check the value in your schema; set `aria-invalid` to show the error state, as the Form Validation example does.

### Is it accessible?

The drawing area is a focusable `role="application"` that owns the undo and redo shortcuts. Offer a typed alternative (the Draw or Type example) for people who cannot draw.
