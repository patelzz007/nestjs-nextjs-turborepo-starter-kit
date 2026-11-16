## Installation

`QrCode` ships with the kit in `packages/ui/src/components/qr-code.tsx`, with its encoder in the kit's shared lib; there is nothing to install.

```showcase-example
c-qr-code-1
```

## Usage

```tsx
import { QrCode } from "@workspace/ui/components/qr-code";
```

```tsx
<QrCode value={voucher.url} size={192} label={`QR code for voucher ${voucher.code}`} />
```

## API Reference

```showcase-api

```

## Accessibility

- An image named by `label`; show the value as text beside it too.
