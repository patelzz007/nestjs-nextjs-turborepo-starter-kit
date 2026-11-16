## Installation

The toast ships with the app: the kit's `Toast` in `packages/ui-native/src/components/toast.tsx`, shown by the app shell's `ToastHost` (`src/features/toast`). There is nothing to install.

```showcase-example
c-sonner-1
```

## Usage

```tsx
import { useToast } from "../features/toast/facade";
```

```tsx
const toast = useToast();

toast.success("Merchant saved.", { title: "Acme Coffee" });

const id = toast.loading("Uploading invoice…");
// …later
toast.update(id, "success", "Invoice uploaded.");
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

- Every toast is announced to screen readers when it appears, with its title.
- A warning or an error stays longer than a confirmation, so there is time to read it.
- Its actions are buttons with a 44 pt touch area; it can also be swiped away.
- Keep anything essential available outside the toast: it disappears.
