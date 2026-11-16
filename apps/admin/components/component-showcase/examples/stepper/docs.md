## Installation

The stepper parts ship with the kit in `packages/ui/src/components/stepper.tsx`; there is nothing to install.

```showcase-example
c-stepper-1
```

## Usage

```tsx
import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperSeparator, StepperTrigger } from "@workspace/ui/components/stepper";
```

```tsx
<Stepper defaultValue={1}>
	<StepperNav>
		<StepperItem step={1}>
			<StepperTrigger>
				<StepperIndicator>1</StepperIndicator>
			</StepperTrigger>
			<StepperSeparator />
		</StepperItem>
		<StepperItem step={2}>
			<StepperTrigger>
				<StepperIndicator>2</StepperIndicator>
			</StepperTrigger>
		</StepperItem>
	</StepperNav>
	<StepperPanel>
		<StepperContent value={1}>Account</StepperContent>
		<StepperContent value={2}>Billing</StepperContent>
	</StepperPanel>
</Stepper>
```

## Examples

### Completed and loading states

```showcase-example
c-stepper-2
```

```showcase-example
c-stepper-3
```

### Controlled

```showcase-example
c-stepper-4
```

### Descriptions

```showcase-example
c-stepper-8
```

### Vertical

```showcase-example
c-stepper-14
```

### Delivery stops

```showcase-example
c-stepper-16
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                       |
| :---------------- | :--------------------------- |
| `←` `→` / `↑` `↓` | Moves between step triggers. |
| `Enter` `Space`   | Goes to the focused step.    |

## Accessibility

- Triggers are tabs controlling their step's panel; the active step is selected and announced.
- Two steppers on one page need distinct ids on their triggers.
