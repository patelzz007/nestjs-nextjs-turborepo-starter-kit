## When to use

- Documenting a process, an architecture or a state machine with text you can review in a diff
- Flowcharts, sequence and state diagrams in docs and admin pages, themed with the app

## When not to use

- A data chart: use [Chart](/components/chart)
- A drawing people edit with the mouse: this renders text, it is not an editor

## Notes

- `source` is Mermaid-style text; the diagram is drawn as SVG by Pele, coloured from the design tokens
- A fenced `mermaid` block in the app's Markdown docs renders through it

## Diagram: diagrams from text

`Diagram` draws a Mermaid-syntax diagram as themed SVG: its colours, radius and fonts come from the design tokens, so it follows light and dark mode. Diagrams live as text, next to the code they describe.

### What is Diagram?

A renderer for text like `flowchart LR; A --> B`, with an optional caption. It is what turns `mermaid` blocks in the docs into pictures.

### Why use Diagram?

Text diagrams are versioned, reviewed and updated with the code; images go stale. Theming them from tokens keeps them on brand.

### Diagram features

- **Mermaid syntax.** Flowcharts, sequences, states and more.
- **Themed SVG.** Colours, radius and fonts from the design tokens.
- **Caption.** A figure caption under the diagram.

## Integrating with other components

Use it in docs pages, in a [Card](/components/card) on an admin page, or in a [Dialog](/components/dialog) to explain a workflow.

## Frequently asked questions

### Which diagram types work?

Those Pele draws from Mermaid syntax: flowcharts, sequence diagrams, state diagrams and others.

### Is it accessible?

It is a figure with a caption; describe the diagram in text near it when it carries information people need.
