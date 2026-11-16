## Installation

`EmptyState` ships with the kit in `packages/ui-native/src/components/empty.tsx`; there is nothing to install.

```showcase-example
c-empty-1
```

## Usage

```tsx
import { EmptyState } from "@workspace/ui-native/components/empty";
```

```tsx
<EmptyState icon={FolderIcon} title="No projects yet" message="Create a project to start tracking your work.">
	<Button label="Create project" size="sm" onPress={createProject} />
</EmptyState>
```

## Surfaces

```showcase-example
c-empty-2
```

```showcase-example
c-empty-3
```

```showcase-example
c-empty-6
```

## Inside a card

```showcase-example
c-empty-5
```

```showcase-example
c-empty-8
```

```showcase-example
c-empty-12
```

## Illustrations

```showcase-example
c-empty-13
```

```showcase-example
c-empty-17
```

```showcase-example
c-empty-19
```

## API Reference

```showcase-api

```

## Accessibility

- The title and message are read in order, then the actions.
- Icons and illustrations are decorative and hidden from screen readers.
