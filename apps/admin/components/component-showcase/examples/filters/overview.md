## When to use

- Toolbars of removable filter chips over a table or a list: one field, condition and value per chip
- Nested AND / OR condition builders, opened from a trigger over a report or laid out inline
- Attribute catalogues too large or too deep to list at once, and option lists paged from a server

## When not to use

- One day or span of days picked on its own: use [Date Selector](/components/date-selector)
- A couple of select filters on a records table: [Data Table](/components/data-table)'s `filters` prop is enough

## Notes

- A rule reaches `onQueryChange` unfinished (no operator yet, or no value where one is needed): skip it when compiling
- Negate swaps to an operator's `inverse` where one exists and otherwise sets `negated`: a compiler must read `negated`
- `renderValue`, `icon` and a custom `editor` count towards the field schema by presence only: changing one keeps the old one cached

## Filters: a query builder from a field schema

`Filters` turns a schema of attributes into a filter bar. People pick an attribute, a condition and a value; the result is one plain-JSON query tree you compile into a predicate, a query string, or a database where-clause. Chips, an advanced builder with nested groups, and an inline builder share the same state.

### What is Filters?

A field schema (`FilterField[]`: text, number, select, multi-select, date, boolean… with nested `fields` for branches) and a `FilterQuery` tree — a group of rules joined by `and` or `or`, which may hold other groups, so `(A and B) or C` is expressible from the start.

### Why use Filters?

Reports and admin lists grow filter needs over time. Starting from a tree and a schema means you never rewrite the filter UI when someone asks for OR, nesting, negation or a new attribute.

### Filters features

- **Three layouts.** Chips, an advanced builder in a popover, or the builder inline.
- **Query tree.** Nested groups with `and` / `or`, negation, and relative date tokens.
- **Typed editors.** Text, numbers, sliders, dates, choices, avatars, badges.
- **Big schemas.** Nested attributes drilled into, searched, and option lists paged from a server.
- **Localised.** Operators and chrome from the `filters` labels.
- **No compiler included.** The tree is the integration point: SQL, Prisma, a REST query or a client predicate.

## Integrating with other components

Put the bar above a [Data Grid](/components/data-grid) or a [Data Table](/components/data-table) and compile the query into the table's filters or the API request. Attribute pickers drill with the kit's [Cascader](/components/cascader).

## Frequently asked questions

### How do I apply the query?

Walk the tree: for each group combine its rules with its `combinator`; for each rule apply its `operator` (minding `negated`) to the field at its `path`. The Table Filtering example compiles it into a client predicate.

### Can I keep the filters in the URL?

Yes: the query is plain JSON with no dates or functions, so it serialises as it is.

### Is it accessible?

Every chip and editor is a labelled kit control; adding, editing and removing filters works with the keyboard alone.
