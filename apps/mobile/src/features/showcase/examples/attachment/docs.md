## Installation

`Attachment` ships with the kit in `packages/ui-native/src/components/attachment.tsx`; there is nothing to install.

```showcase-example
c-attachment-1
```

## Usage

```tsx
import { Attachment } from "@workspace/ui-native/components/attachment";
```

```tsx
<Attachment name="invoice-3182.pdf" description="PDF · 240 KB" onPress={open} />
```

## Composer

```showcase-example
c-attachment-2
```

## Images

```showcase-example
c-attachment-3
```

## Sizes

```showcase-example
c-attachment-4
```

## Upload states

```showcase-example
c-attachment-5
```

## Picking files

```showcase-example
c-attachment-6
```

## API Reference

```showcase-api

```

## Accessibility

- Each chip reads its name and detail; uploading and processing chips say they are busy.
- Actions and remove are named buttons ("Download invoice-3182.pdf").
