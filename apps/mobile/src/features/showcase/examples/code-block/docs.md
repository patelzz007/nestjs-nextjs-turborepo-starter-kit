## Installation

`CodeBlock` ships with the kit in `packages/ui-native/src/components/code-block.tsx`; there is nothing to install.

```showcase-example
c-code-block-1
```

## Usage

```tsx
import { CodeBlock } from "@workspace/ui-native/components/code-block";
```

```tsx
<CodeBlock code={code} lines={lines} language="TypeScript" showLineNumbers onCopy={copy} copied={copied} />
```

## Copying

```showcase-example
c-code-block-2
```

## Streaming and chat

```showcase-example
c-code-block-3
```

```showcase-example
c-code-block-4
```

## Diffs

```showcase-example
c-code-block-5
```

```showcase-example
c-code-block-6
```

```showcase-example
c-code-block-18
```

## Highlights and focus

```showcase-example
c-code-block-7
```

```showcase-example
c-code-block-8
```

```showcase-example
c-code-block-20
```

## Terminal output

```showcase-example
c-code-block-9
```

```showcase-example
c-code-block-21
```

```showcase-example
c-code-block-27
```

## Long code

```showcase-example
c-code-block-10
```

```showcase-example
c-code-block-17
```

```showcase-example
c-code-block-26
```

## Review

```showcase-example
c-code-block-11
```

```showcase-example
c-code-block-22
```

```showcase-example
c-code-block-24
```

## Selection and search

```showcase-example
c-code-block-12
```

```showcase-example
c-code-block-13
```

```showcase-example
c-code-block-25
```

## Files

```showcase-example
c-code-block-14
```

```showcase-example
c-code-block-16
```

## Colours

```showcase-example
c-code-block-15
```

```showcase-example
c-code-block-19
```

## Folding

```showcase-example
c-code-block-23
```

## API Reference

```showcase-api

```

## Accessibility

- Line numbers are hidden from screen readers unless they are buttons (selection, folds, actions), then each is named.
- The copy button says "Copied" once the caller reports it.
