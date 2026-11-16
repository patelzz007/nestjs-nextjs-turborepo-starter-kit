## When to use

- A handwritten signature: an agreement, a delivery, a consent form
- Initials per clause
- A signature exported as SVG or kept as strokes

## When not to use

- A typed name as the signature: use [Input](/showcase/input) and show it in a script face
- A drawing tool: the pad keeps only strokes in one ink
- Identity checks: a signature drawn on a phone proves little on its own

## Notes

- Strokes are kept as points scaled to the pad, so they draw the same at any size
- Offer another way to sign (typing a name): signing needs a hand

## SignaturePad: a handwritten signature

`SignaturePad` takes strokes from a finger or a stylus in a theme ink. `useSignatureHistory` adds undo, redo and clear; `signatureToSvg` exports.

### What is it?

A drawing surface and its strokes.

### Why use it?

A signature on screen matches what people sign on paper.

### Features

- **Ink.** A theme token and a weight.
- **History.** Undo, redo, clear.
- **Export.** SVG or JSON.
- **Read only.** Shows a signed record.

## Integrating with other components

Pair it with a [Checkbox](/showcase/checkbox) for consent and a [Button](/showcase/button) to submit.

## Frequently asked questions

### Why does the screen scroll while I sign?

Use `onDrawingChange` to lock the scroll view while a stroke is drawn.

### How do I upload it?

Send `signatureToSvg(strokes, …)`, or the strokes as JSON.
