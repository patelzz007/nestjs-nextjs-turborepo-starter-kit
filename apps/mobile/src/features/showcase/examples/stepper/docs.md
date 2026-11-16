## Installation

`Stepper` ships with the kit in `packages/ui-native/src/components/stepper.tsx`; there is nothing to install.

```showcase-example
c-stepper-1
```

## Usage

```tsx
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
```

```tsx
<Stepper steps={STEPS} value={step} onChange={setStep} />
```

## Moving through

```showcase-example
c-stepper-4
```

## Looks

```showcase-example
c-stepper-11
```

```showcase-example
c-stepper-17
```

```showcase-example
c-stepper-32
```

```showcase-example
c-stepper-31
```

## Vertical

```showcase-example
c-stepper-13
```

```showcase-example
c-stepper-16
```

## Rich steps

```showcase-example
c-stepper-7
```

```showcase-example
c-stepper-43
```

## API Reference

```showcase-api

```

## Accessibility

- Each step is named by its position, title and state.
- With `onChange` the steps are tabs that say which is selected; blocked steps are disabled.
- A loading step says it is busy; badges are decorative.
