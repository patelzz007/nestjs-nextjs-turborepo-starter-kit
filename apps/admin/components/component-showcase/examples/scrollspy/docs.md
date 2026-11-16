## Installation

`Scrollspy` ships with the kit in `packages/ui/src/components/scrollspy.tsx`; there is nothing to install.

```showcase-example
c-scrollspy-1
```

## Usage

```tsx
import { Scrollspy } from "@workspace/ui/components/scrollspy";
```

```tsx
const containerRef = React.useRef<HTMLDivElement | null>(null);

<Scrollspy targetRef={containerRef}>
	<a href="#overview" data-scrollspy-anchor="overview">
		Overview
	</a>
	<a href="#pricing" data-scrollspy-anchor="pricing">
		Pricing
	</a>
</Scrollspy>
<div ref={containerRef} className="h-96 overflow-y-auto">
	<section id="overview">…</section>
	<section id="pricing">…</section>
</div>
```

## Examples

### Horizontal

```showcase-example
c-scrollspy-2
```

## API Reference

```showcase-api

```

## Accessibility

- The links are real anchors to the sections, so they work with the keyboard and without JavaScript.
- The active link carries `data-active`; set `aria-current` on it when the state should be announced.
