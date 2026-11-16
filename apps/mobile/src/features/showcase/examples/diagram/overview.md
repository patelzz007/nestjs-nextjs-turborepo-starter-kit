## When to use

- Explaining a process or a sequence without an image file: release flows, sign-in steps

## When not to use

- Data with numbers: use a chart

## Notes

- Pele draws the Mermaid text (the web's renderer); react-native-svg draws the result, themed from the design tokens
- A wide flowchart turns vertical to fit the phone; a wider diagram scrolls sideways

## Diagram

`Diagram` draws Mermaid-syntax text as a themed SVG, with its accTitle and accDescr as its accessible name.

### Features

- **Every Mermaid type Pele supports**: flowcharts, sequences, state, class, ER, pie, Gantt.
- **Themed** from the tokens, light and dark.
- **Errors** shown in place, with the reason.

## Integrating with other components

Put it in documentation screens or help sheets; keep the source next to the content it explains.

## Frequently asked questions

### Does it need a network?

No: Pele runs in the app, so diagrams draw offline.
