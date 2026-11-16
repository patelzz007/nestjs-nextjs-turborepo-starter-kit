## When to use

- Sharing a link, a voucher, a pairing code or a payment with a phone
- Printed or on-screen codes merchants and customers scan

## When not to use

- Reading QR codes: this only draws them
- A value people type or copy: show it as text with a copy button

## Notes

- Codes are always black on white inside their frame, whatever the theme, so every scanner reads them
- `label` names the image for assistive technology; show the value as text too when people may need it

## QR Code: scannable codes, drawn by the kit

`QrCode` renders a QR code from a string with the kit's own encoder. It is always black-on-white for reliable scanning, sized by `size`, and named by `label`.

### What is QR Code?

An SVG of a QR code for any value — a URL, a voucher code, a pairing token.

### Why use QR Code?

Handing a link from a screen to a phone is fastest with a code. Drawing it locally needs no third-party service and leaks nothing.

### QR Code features

- **Local encoding.** No network call.
- **Reliable contrast.** Black on white in every theme.
- **Sizes and a label.**

## Integrating with other components

Show it in a [Card](/components/card) or a [Dialog](/components/dialog) beside the value as text and a copy [Button](/components/button).

## Frequently asked questions

### Does it work in dark mode?

Yes: the code itself stays black on white inside its frame, which is what scanners need.

### Is it accessible?

It is an image named by `label`; always offer the value in text as well.
