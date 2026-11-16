## Installation

The toast parts ship with the kit in `packages/ui/src/components/toast.tsx`, built on Base UI's toast. The app already mounts a `Toaster` in `apps/admin/app/layout.tsx`.

```showcase-example
c-sonner-1
```

## Usage

```tsx
import { toastMessage } from "@workspace/ui/components/toast";
```

```tsx
toastMessage.success({ title: "Merchant saved", description: "Acme Coffee was updated." });

const id = toastMessage.loading({ title: "Uploading invoice…" });
// …later
toastMessage.update(id, { type: "success", title: "Invoice uploaded" });
```

## Examples

### Positions

```showcase-example
c-sonner-3
```

### Action button

```showcase-example
c-sonner-6
```

### Promise

```showcase-example
c-sonner-7
```

### Upload progress

```showcase-example
c-sonner-10
```

### Updatable

```showcase-example
c-sonner-21
```

## API Reference

```showcase-api

```

## Accessibility

- Toasts are announced through a live region; errors more urgently than confirmations.
- They pause while hovered or focused; actions are buttons reachable by keyboard.
- Keep anything essential available outside the toast: it disappears.
