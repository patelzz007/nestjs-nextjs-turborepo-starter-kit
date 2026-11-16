## Installation

`Diagram` ships with the kit in `packages/ui/src/components/diagram.tsx`, drawn by Pele; there is nothing to install.

```showcase-example
c-diagram-1
```

## Usage

```tsx
import { Diagram } from "@workspace/ui/components/diagram";
```

```tsx
<Diagram source={"flowchart LR\n  PR[Pull request] --> CI[CI checks] --> Deploy"} caption="From pull request to production" />
```

## API Reference

```showcase-api

```

## Accessibility

- A `figure` with its caption; give a text description where the diagram carries information.
