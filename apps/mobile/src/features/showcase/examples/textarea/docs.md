## Installation

`Textarea` ships with the kit in `packages/ui-native/src/components/textarea.tsx`; there is nothing to install.

```showcase-example
c-textarea-3
```

## Usage

```tsx
import { Textarea } from "@workspace/ui-native/components/textarea";
```

```tsx
<Field label="Message">
	<Textarea value={message} onChange={setMessage} />
</Field>
```

## In a field

Label and hint from `Field`.

```showcase-example
c-textarea-3
```

```showcase-example
c-textarea-4
```

## Counting

A running count by the label.

```showcase-example
c-textarea-6
```

## API Reference

```showcase-api

```

## Accessibility

- Named by its field's label.
- Return adds a line; the form's own button submits.
