## Installation

`Field, FieldSet` ships with the kit in `packages/ui-native/src/components/field.tsx`; there is nothing to install.

```showcase-example
c-field-1
```

## Usage

```tsx
import { Field, FieldSet } from "@workspace/ui-native/components/field";
```

```tsx
<Field label="Email" hint="We never share it." error={errors.email}>
	<Input value={email} onChange={setEmail} />
</Field>
```

## Label row

Required, optional and extras at the end of the label row.

```showcase-example
c-field-1
```

```showcase-example
c-field-2
```

## Errors

One message or a list.

```showcase-example
c-field-11
```

## Groups

`FieldSet` puts related controls under a legend.

```showcase-example
c-field-10
```

## API Reference

```showcase-api

```

## Accessibility

- The label is the control's accessible name, the hint its accessibility hint; ", required" is added for a required field.
- Errors are announced politely as alerts when they appear.
- `FieldSet` is a named group with its legend as a header.
