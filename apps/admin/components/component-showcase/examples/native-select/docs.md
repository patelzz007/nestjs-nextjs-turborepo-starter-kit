## Installation

`NativeSelect`, `NativeSelectOption` and `NativeSelectOptGroup` ship with the kit in `packages/ui/src/components/native-select.tsx`; there is nothing to install.

```showcase-example
c-native-select-1
```

## Usage

```tsx
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@workspace/ui/components/native-select";
```

```tsx
<NativeSelect id="country" name="country" defaultValue="MY">
	<NativeSelectOption value="MY">Malaysia</NativeSelectOption>
	<NativeSelectOption value="SG">Singapore</NativeSelectOption>
</NativeSelect>
```

## Examples

### Grouped options

```showcase-example
c-native-select-2
```

### With a label

```showcase-example
c-native-select-4
```

### Invalid

```showcase-example
c-native-select-6
```

## API Reference

```showcase-api

```

## Accessibility

- It is a native `select`: keyboard, type-ahead and screen-reader support come from the browser.
- Name it with a `Label` tied by `htmlFor`; `aria-invalid` styles and announces an error.
