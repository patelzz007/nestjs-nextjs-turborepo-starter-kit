## Installation

`ImageResizer` ships with the kit in `packages/ui/src/components/image-resizer.tsx`; there is nothing to install.

```showcase-example
c-image-resizer-1
```

## Usage

```tsx
import { ImageResizer } from "@workspace/ui/components/image-resizer";
```

```tsx
<ImageResizer src={image.url} alt={image.alt} value={size} onValueChange={setSize} onValueCommitted={save} maxWidth={640} />
```

## API Reference

```showcase-api

```

## Keyboard

| Key              | Action                                     |
| :--------------- | :----------------------------------------- |
| `Tab`            | Moves between the handles.                 |
| `←` `→` `↑` `↓`  | Resizes by `step` from the focused handle. |
| `Shift` + arrows | Resizes by `largeStep`.                    |

## Accessibility

- Each handle is focusable and named from the `imageResizer` labels; the size is announced as it changes.
