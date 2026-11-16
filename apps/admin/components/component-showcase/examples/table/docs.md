## Installation

The table parts ship with the kit in `packages/ui/src/components/table.tsx`; there is nothing to install.

```showcase-example
c-table-1
```

## Usage

```tsx
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
```

```tsx
<Table>
	<TableCaption>Recent invoices</TableCaption>
	<TableHeader>
		<TableRow>
			<TableHead>Invoice</TableHead>
			<TableHead className="text-end">Amount</TableHead>
		</TableRow>
	</TableHeader>
	<TableBody>
		{invoices.map((invoice) => (
			<TableRow key={invoice.id}>
				<TableCell>{invoice.id}</TableCell>
				<TableCell className="text-end tabular-nums">{invoice.amount}</TableCell>
			</TableRow>
		))}
	</TableBody>
</Table>
```

## Examples

### With a footer

```showcase-example
c-table-2
```

### Actions column

```showcase-example
c-table-4
```

### Employee profile

```showcase-example
c-table-16
```

## API Reference

```showcase-api

```

## Accessibility

- Real table markup: header cells are `th` and screen readers navigate by row and column.
- A `TableCaption` describes the table.
