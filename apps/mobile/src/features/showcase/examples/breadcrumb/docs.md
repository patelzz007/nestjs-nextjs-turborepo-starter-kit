## Installation

`Breadcrumb` ships with the kit in `packages/ui-native/src/components/breadcrumb.tsx`; there is nothing to install.

```showcase-example
c-breadcrumb-1
```

## Usage

```tsx
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
```

```tsx
const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", onPress: goHome },
	{ key: "settings", label: "Settings" },
];

<Breadcrumb items={ITEMS} />;
```

## Long trails

```showcase-example
c-breadcrumb-2
```

```showcase-example
c-breadcrumb-6
```

## Rich levels

```showcase-example
c-breadcrumb-7
```

```showcase-example
c-breadcrumb-15
```

## Looks

```showcase-example
c-breadcrumb-10
```

```showcase-example
c-breadcrumb-14
```

## API Reference

```showcase-api

```

## Accessibility

- The trail is named "Breadcrumb"; levels are links, and the last one is read as the current page.
- Separators are hidden from screen readers.
- The ellipsis says how many levels it hides, or opens a menu of them.
