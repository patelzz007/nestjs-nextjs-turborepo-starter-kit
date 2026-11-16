## Installation

`DropdownMenu` ships with the kit in `packages/ui-native/src/components/dropdown-menu.tsx`; there is nothing to install.

```showcase-example
c-dropdown-menu-1
```

## Usage

```tsx
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
```

```tsx
const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit" },
	{ value: "delete", label: "Delete", variant: "destructive" },
];

<DropdownMenu label="Actions" items={ITEMS} onSelect={run} />;
```

## Item kinds

```showcase-example
c-dropdown-menu-6
```

```showcase-example
c-dropdown-menu-7
```

```showcase-example
c-dropdown-menu-8
```

## Rich menus

```showcase-example
c-dropdown-menu-9
```

```showcase-example
c-dropdown-menu-10
```

```showcase-example
c-dropdown-menu-11
```

## API Reference

```showcase-api

```

## Accessibility

- The trigger is a button named by its label, and says whether the menu is open.
- Rows are menu items, checkboxes or radios, with their checked and disabled states.
- Group headings are headers; a submenu's back row is named "Back to …".
