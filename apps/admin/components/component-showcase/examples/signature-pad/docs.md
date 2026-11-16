## Installation

The signature pad parts ship with the kit in `packages/ui/src/components/signature-pad.tsx`; there is nothing to install. Its strings come from the `signaturePad` labels.

```showcase-example
c-signature-pad-1
```

## Usage

```tsx
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadUndo,
} from "@workspace/ui/components/signature-pad";
```

```tsx
<SignaturePad onValueChange={setStrokes}>
	<SignaturePadArea>
		<SignaturePadGuide />
		<SignaturePadPlaceholder />
		<SignaturePadControls>
			<SignaturePadUndo />
			<SignaturePadClear />
		</SignaturePadControls>
	</SignaturePadArea>
</SignaturePad>
```

## Examples

### Undo and redo

```showcase-example
c-signature-pad-2
```

### Form validation

```showcase-example
c-signature-pad-3
```

### Export formats

```showcase-example
c-signature-pad-5
```

### Draw or type

```showcase-example
c-signature-pad-6
```

### Stylus mode

```showcase-example
c-signature-pad-9
```

### Upload

```showcase-example
c-signature-pad-12
```

## API Reference

```showcase-api

```

## Keyboard

| Key                                   | Action                                            |
| :------------------------------------ | :------------------------------------------------ |
| `⌘ Z` / `Ctrl Z`                      | Undoes the last stroke, while the area has focus. |
| `⌘ ⇧ Z`, `⌘ Y` / `Ctrl ⇧ Z`, `Ctrl Y` | Redoes it.                                        |

## Accessibility

- The drawing area is a focusable `role="application"` named by its label; it owns the undo and redo shortcuts while focused.
- The controls are named buttons. Offer a typed alternative for people who cannot draw.
- `readOnly` and `disabled` take the area out of the tab order.
