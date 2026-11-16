## Installation

The OTP parts ship with the kit in `packages/ui/src/components/input-otp.tsx`, built on the `input-otp` package, which is already installed.

```showcase-example
c-input-otp-1
```

## Usage

```tsx
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";
```

```tsx
<InputOTP maxLength={6} value={code} onChange={setCode} onComplete={verify}>
	<InputOTPGroup>
		<InputOTPSlot index={0} />
		<InputOTPSlot index={1} />
		<InputOTPSlot index={2} />
	</InputOTPGroup>
	<InputOTPSeparator />
	<InputOTPGroup>
		<InputOTPSlot index={3} />
		<InputOTPSlot index={4} />
		<InputOTPSlot index={5} />
	</InputOTPGroup>
</InputOTP>
```

## Examples

### Digits only

```showcase-example
c-input-otp-2
```

### Letters and numbers

```showcase-example
c-input-otp-4
```

### Verification card

```showcase-example
c-input-otp-6
```

## API Reference

```showcase-api

```

## Accessibility

- There is one real input under the slots, so screen readers and autofill see a normal text field: name it with a label or `aria-label`.
- Set `aria-invalid` on the slots to show a rejected code, and announce the error in text next to it.
