## When to use

- Narrowing a list, table or board by field values: status, owner, dates, amounts
- Saved views and shared links: the query is plain JSON a server can run

## When not to use

- One search box over everything: use a search Input
- Two or three fixed choices: use a SegmentedControl or ToggleGroup

## Notes

- Uses the web kit's query model and rules (`@workspace/ui-kit-logic` `filters`): operators, groups, dates, copy
- A `bar` of chips, or a `builder` of nested AND/OR groups; fields and values are edited in a bottom sheet
- Dates are stored as days or relative phrases, never as instants, so "today" stays today

## Filters

`Filters` edits a `FilterQuery`: each rule is a field, an operator and a value. Tap Add filter to pick a field (search finds it at any depth), choose an operator and a value in a sheet, and the rule becomes a chip.

### Features

- **Fields**: text, number, range, select, multiselect, boolean, and branches of fields.
- **Options** fixed, fetched as people search (`loadOptions`), and named later for restored ids (`resolveValues`).
- **Custom editors** per field (`editor`): calendars, sliders, any kit control.
- **Builder mode**: nested groups joined by AND or OR.
- **Copy and operators** replaceable for any language; sizes, read-only and disabled.

## Integrating with other components

Drive a DataTable, a list or a Kanban with the query; open the builder in a BottomSheet from a card's header; save `serializeFilterQuery(query)` as a view.

## Frequently asked questions

### How does the query reach a server?

`serializeFilterQuery(query)` gives JSON; the server parses it with `FilterQuerySchema` and maps each path to a column. Never trust a client's query as an authorisation rule.

### Can I filter on the phone without a server?

Yes: `flattenFilterConditions(query)` lists the conditions, and a small matcher runs them over rows (see Table Filtering).
