## Installation

`NativeSelect` ships with the kit in `packages/ui-native/src/components/native-select.tsx`; there is nothing to install.

```showcase-example
c-native-select-1
```

## Usage

```tsx
import { NativeSelect } from "@workspace/ui-native/components/native-select";
```

```tsx
<NativeSelect label="Size" options={SIZES} value={size} onChange={setSize} />
```

## Options

Disabled and grouped options.

```showcase-example
c-native-select-1
```

```showcase-example
c-native-select-2
```

## In a field

With a label and a hint.

```showcase-example
c-native-select-4
```

## API Reference

```showcase-api

```

## Accessibility

- The field reads its label and the picked option.
- The system sheet is read by the platform's own screen reader support.
