## Installation

The filters ship with the kit in `packages/ui/src/components/filters/`, fourteen files of which most import no UI at all (types, the query, operators, dates, i18n); there is nothing to install.

```showcase-example
c-filters-1
```

## Usage

```tsx
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery } from "@workspace/ui/components/filters/filters-query";
import type { FilterField, FilterQuery } from "@workspace/ui/components/filters/filters-types";
```

```tsx
const FIELDS: FilterField[] = [
	{ id: "title", label: "Title", type: "text" },
	{
		id: "status",
		label: "Status",
		type: "select",
		options: [
			{ value: "active", label: "Active" },
			{ value: "archived", label: "Archived" },
		],
	},
];

const [query, setQuery] = React.useState<FilterQuery>(() => createFilterQuery());

<Filters fields={FIELDS} query={query} onQueryChange={setQuery} />;
```

`fields` is the only required prop: leave `query` off and the bar keeps its own state, seeded from `defaultQuery`. Choosing an attribute adds the rule at once, reading "Select condition", and picking a condition moves the same popover on to the value.

## The query is a tree

A query is always a group, never a bare array. The root holds rules and other groups in order, and its `combinator` says how they join:

```tsx
const query: FilterQuery = {
	id: "root",
	type: "group",
	combinator: "and",
	rules: [
		{ id: "r1", type: "rule", path: ["status"], operator: "is", value: "active" },
		{
			id: "g1",
			type: "group",
			combinator: "or",
			rules: [{ id: "r2", type: "rule", path: ["title"], operator: "contains", value: "invoice" }],
		},
	],
};
```

## Layouts

```tsx
// Chips, for a toolbar over a table.
<Filters fields={FIELDS} />
// The condition builder, opened from a trigger that shows the rule count.
<Filters fields={FIELDS} variant="advanced" />
// The same builder in place, for a sidebar or a settings page.
<Filters fields={FIELDS} variant="advanced" advancedMode="inline" />
```

```showcase-example
c-filters-10
```

```showcase-example
c-filters-11
```

## Nested attributes

A field carrying `fields` renders as a branch the picker drills into; a rule stores the whole path, root first.

```showcase-example
c-filters-2
```

## Taking the query somewhere

The filters stop at the tree and compile nothing — deliberately: the tree is the integration surface, and SQL is one target beside Prisma, a REST query string or a client predicate. The query is plain JSON, so it goes on the wire as it is (a date rule stores a relative token, not a `Date`).

```showcase-example
c-filters-7
```

## More examples

### Date editors

```showcase-example
c-filters-5
```

### Avatars and paging

```showcase-example
c-filters-4
```

### Controlled and translated

```showcase-example
c-filters-12
```

## API Reference

```showcase-api

```

## Accessibility

- Chips, the attribute picker, the condition menus and every value editor are labelled kit controls, operable with the keyboard alone.
- Each chip's remove button is a labelled button for the rule it removes.
