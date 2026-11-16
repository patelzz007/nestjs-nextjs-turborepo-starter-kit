## Installation

`Rating` ships with the kit in `packages/ui/src/components/rating.tsx`; there is nothing to install. Its accessible names come from the `rating` labels.

```showcase-example
c-rating-1
```

## Usage

```tsx
import { Rating } from "@workspace/ui/components/rating";
```

```tsx
<Rating rating={4.5} showValue />

<Rating rating={score} editable onRatingChange={setScore} aria-label="Your rating" />
```

## Examples

### Decimal value

```showcase-example
c-rating-2
```

### Editable

```showcase-example
c-rating-4
```

### Sizes

```showcase-example
c-rating-5
```

### Review summary

```showcase-example
c-rating-6
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                                           |
| :---------------- | :----------------------------------------------- |
| `Tab`             | Moves focus to the selected star (or the first). |
| `←` `→` / `↑` `↓` | Moves the score down or up by one star.          |
| `Home` `End`      | Sets the lowest or highest score.                |

## Accessibility

- Read-only, the stars are one `role="img"` named with the score ("Rated 3.5 out of 5").
- Editable, they are a `radiogroup` of star `radio`s with one tab stop; each star's name gives its value.
