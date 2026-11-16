## Installation

`useFileUpload` ships with the kit in `packages/ui-native/src/lib/use-file-upload.ts`; there is nothing to install.

```showcase-example
c-file-upload-2
```

## Usage

```tsx
import { useFileUpload } from "@workspace/ui-native/lib/use-file-upload";
```

```tsx
const upload = useFileUpload({ accept: ["application/pdf"], maxSize: 10 * 1024 * 1024 });

<Button label="Choose file" onPress={upload.openPicker} />;
```

## Single file

An avatar or a cover.

```showcase-example
c-file-upload-2
```

```showcase-example
c-file-upload-10
```

## Many files

A list with progress.

```showcase-example
c-file-upload-5
```

## Images

A gallery.

```showcase-example
c-file-upload-4
```

## API Reference

```showcase-api

```

## Accessibility

- Each control the screen builds names its action ("Remove report.pdf").
- Rejections are shown as text, so they can be read out.
