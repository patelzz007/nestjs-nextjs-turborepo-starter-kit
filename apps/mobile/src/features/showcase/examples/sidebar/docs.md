## Installation

`Sidebar` ships with the kit in `packages/ui-native/src/components/sidebar.tsx`; there is nothing to install.

```showcase-example
c-sidebar-1
```

## Usage

```tsx
import { Sidebar, type SidebarGroup } from "@workspace/ui-native/components/sidebar";
```

```tsx
<Sidebar groups={GROUPS} header={HEADER} footer={FOOTER} />
```

## Collapsing

```showcase-example
c-sidebar-2
```

## Search

```showcase-example
c-sidebar-3
```

```showcase-example
c-sidebar-5
```

## Inspector

```showcase-example
c-sidebar-4
```

## API Reference

```showcase-api

```

## Accessibility

- Items are links (sub-menus are buttons) that say which is the current page and whether they are open.
- Counts are read with their item; group labels are headers.
