## Installation

The trace parts ship with the kit in `packages/ui/src/components/trace.tsx`; there is nothing to install.

```showcase-example
c-trace-1
```

## Usage

```tsx
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";
```

```tsx
<Trace>
	<TraceLine>
		<TraceIcon>
			<Search aria-hidden="true" />
		</TraceIcon>
		<TraceTitle>Searched the docs (done)</TraceTitle>
		<TraceDescription>3 results</TraceDescription>
	</TraceLine>
	<TraceCollapsible>
		<TraceCollapsibleTrigger>
			<TraceTitle>Ran the tests (failed)</TraceTitle>
		</TraceCollapsibleTrigger>
		<TraceCollapsibleContent>{/* the output */}</TraceCollapsibleContent>
	</TraceCollapsible>
</Trace>
```

## Examples

### Streaming run

```showcase-example
c-trace-2
```

### Sub-agents

```showcase-example
c-trace-4
```

### CI pipeline

```showcase-example
c-trace-9
```

### Cited sources

```showcase-example
c-trace-6
```

## API Reference

```showcase-api

```

## Accessibility

- Lines are text; expandable steps are disclosure buttons with `aria-expanded`.
- State is shown by colour and motion: say it in each title too.
