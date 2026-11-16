## Installation

`SignaturePad` ships with the kit in `packages/ui-native/src/components/signature-pad.tsx`; there is nothing to install.

```showcase-example
c-signature-pad-2
```

## Usage

```tsx
import { SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
```

```tsx
const signature = useSignatureHistory();

<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />;
```

## History

Undo, redo and clear.

```showcase-example
c-signature-pad-2
```

## In a form

Required before submitting.

```showcase-example
c-signature-pad-3
```

```showcase-example
c-signature-pad-7
```

## Export

SVG or JSON.

```showcase-example
c-signature-pad-5
```

## API Reference

```showcase-api

```

## Accessibility

- The pad says how many strokes it holds.
- Offer a typed alternative for people who cannot draw.
