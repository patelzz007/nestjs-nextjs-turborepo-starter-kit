## Installation

`PasswordInput` ships with the kit in `packages/ui/src/components/password-input.tsx`; there is nothing to install. Its strings come from the `passwordInput` labels of `UiKitLabelsProvider`.

```showcase-example
c-password-input-1
```

## Usage

```tsx
import { PasswordInput } from "@workspace/ui/components/password-input";
```

```tsx
<Label htmlFor="password">Password</Label>
<PasswordInput id="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
```

## API Reference

```showcase-api

```

## Accessibility

- The field is a native `input` whose `type` switches between `password` and `text`.
- The toggle is a button named for what it will do, and it is out of the tab order (`tabIndex={-1}`), so Tab moves from the field to the next control; pointer and screen-reader users can still press it.
- The Caps Lock warning is a polite `role="status"`, announced when it appears and cleared on blur.
