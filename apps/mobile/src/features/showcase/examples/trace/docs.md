## Installation

`Trace` ships with the kit in `packages/ui-native/src/components/trace.tsx`; there is nothing to install.

```showcase-example
c-trace-1
```

## Usage

```tsx
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
```

```tsx
<Trace>
	<TraceLine icon={SearchIcon} title="Searched the codebase" description="3 results" />
	<TraceStep icon={TerminalIcon} title="Ran pnpm test" description="12 passed">
		<CodeBlock code={output} language="bash" />
	</TraceStep>
</Trace>
```

## Live runs

```showcase-example
c-trace-2
```

```showcase-example
c-trace-4
```

```showcase-example
c-trace-9
```

## Nested timings

```showcase-example
c-trace-10
```

```showcase-example
c-trace-12
```

## Detail elsewhere

```showcase-example
c-trace-11
```

```showcase-example
c-trace-17
```

## Approvals and fixes

```showcase-example
c-trace-5
```

```showcase-example
c-trace-16
```

## API Reference

```showcase-api

```

## Accessibility

- Each line is one element named by its title and description; glyphs are decorative.
- A step announces whether it is expanded.
- The running title's breathing stops under Reduce Motion.
