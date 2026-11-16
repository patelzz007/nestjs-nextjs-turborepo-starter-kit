## Installation

`PasswordInput` ships with the kit in `packages/ui-native/src/components/password-input.tsx`; there is nothing to install.

```showcase-example
c-password-input-1
```

## Usage

```tsx
import { PasswordInput } from "@workspace/ui-native/components/password-input";
```

```tsx
<Field label="Password">
	<PasswordInput value={password} onChange={setPassword} />
</Field>
```

## Visibility

The screen can own the eye button's state.

```showcase-example
c-password-input-1
```

## API Reference

```showcase-api

```

## Accessibility

- The eye button says what it does ("Show password" / "Hide password").
- Password autofill and the platform's strong-password suggestions work.
