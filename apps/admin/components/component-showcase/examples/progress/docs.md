## Installation

The progress parts ship with the kit in `packages/ui/src/components/progress.tsx`, built on Base UI's progress; there is nothing to install.

```showcase-example
c-progress-1
```

## Usage

```tsx
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from "@workspace/ui/components/progress";
```

```tsx
<Progress value={64}>
	<div className="flex justify-between">
		<ProgressLabel>Uploading invoice.pdf</ProgressLabel>
		<ProgressValue />
	</div>
	<ProgressTrack>
		<ProgressIndicator />
	</ProgressTrack>
</Progress>
```

## Examples

### Sizes

```showcase-example
c-progress-2
```

```showcase-example
c-progress-3
```

### File uploads

```showcase-example
c-progress-5
```

### Multi-step

```showcase-example
c-progress-7
```

## API Reference

```showcase-api

```

## Accessibility

- `role="progressbar"` with its value, minimum and maximum; named by `ProgressLabel` or an `aria-label`.
