## Installation

`ButtonGroup`, `ButtonGroupText` and `ButtonGroupSeparator` ship with the kit in `packages/ui-native/src/components/button-group.tsx`; there is nothing to install.

```showcase-example
c-button-group-1
```

## Usage

```tsx
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@workspace/ui-native/components/button-group";
```

```tsx
<ButtonGroup accessibilityLabel="Archive or report">
	<Button label="Archive" variant="outline" onPress={archive} />
	<Button label="Report" variant="outline" onPress={report} />
</ButtonGroup>
```

## Attached and separated

Attached children share their edges; `variant="separated"` spaces them, and groups nest.

```showcase-example
c-button-group-1
```

```showcase-example
c-button-group-14
```

## With fields and menus

Inputs, input groups and menus join the same way as buttons.

```showcase-example
c-button-group-16
```

```showcase-example
c-button-group-39
```

## Text cells

`ButtonGroupText` holds a count or a readout beside the buttons.

```showcase-example
c-button-group-8
```

```showcase-example
c-button-group-37
```

## Vertical

`orientation="vertical"` stacks the children into a column.

```showcase-example
c-button-group-13
```

## API Reference

```showcase-api

```

## Accessibility

- The group has the group role and its `accessibilityLabel` as its name; every child keeps its own role and name.
- `ButtonGroupText` is read as text and `ButtonGroupSeparator` is hidden from screen readers.
- Joined buttons keep their own 44 pt touch areas; leave room around a group of small buttons so their touch areas do not overlap.
