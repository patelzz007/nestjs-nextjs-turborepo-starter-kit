## Installation

`DataGrid` ships with the kit in `packages/ui-native/src/components/data-grid.tsx`; there is nothing to install.

```showcase-example
c-data-grid-1
```

## Usage

```tsx
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
```

```tsx
<DataGrid table={table} recordCount={rows.length}>
	<DataGridContainer>
		<DataGridTable />
	</DataGridContainer>
	<DataGridPagination />
</DataGrid>
```

## Layouts

```showcase-example
c-data-grid-2
```

```showcase-example
c-data-grid-3
```

```showcase-example
c-data-grid-4
```

```showcase-example
c-data-grid-5
```

```showcase-example
c-data-grid-6
```

## Rows

```showcase-example
c-data-grid-7
```

```showcase-example
c-data-grid-8
```

```showcase-example
c-data-grid-9
```

```showcase-example
c-data-grid-14
```

```showcase-example
c-data-grid-29
```

```showcase-example
c-data-grid-30
```

## Columns

```showcase-example
c-data-grid-10
```

```showcase-example
c-data-grid-11
```

```showcase-example
c-data-grid-12
```

```showcase-example
c-data-grid-13
```

```showcase-example
c-data-grid-15
```

```showcase-example
c-data-grid-16
```

```showcase-example
c-data-grid-18
```

```showcase-example
c-data-grid-20
```

## Containers and states

```showcase-example
c-data-grid-17
```

```showcase-example
c-data-grid-19
```

```showcase-example
c-data-grid-21
```

## Admin lists

```showcase-example
c-data-grid-22
```

```showcase-example
c-data-grid-23
```

## Footers

```showcase-example
c-data-grid-24
```

```showcase-example
c-data-grid-25
```

```showcase-example
c-data-grid-26
```

## Scale

```showcase-example
c-data-grid-27
```

```showcase-example
c-data-grid-28
```

```showcase-example
c-data-grid-32
```

```showcase-example
c-data-grid-34
```

## Spreadsheet editing

```showcase-example
c-data-grid-31
```

## Languages

```showcase-example
c-data-grid-33
```

## API Reference

```showcase-api

```

## Accessibility

- Sortable headers are buttons that say how their column is sorted; header menus are sheets screen readers stay inside.
- Width handles are adjustable: swipe up or down to step a column's width. Column grips and row handles offer move actions.
- With cell selection, each cell is a button that says its column and value, and whether it is selected; the selection bar announces its count.
- Placeholder rows, the spinner and 'Loading more…' are announced; nothing relies on colour alone.
