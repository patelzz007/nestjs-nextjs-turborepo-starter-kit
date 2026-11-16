## When to use

- Read-only star scores at three sizes, with partial stars for averages such as 3.5 or 4.6
- Star inputs that collect a whole-star score in feedback and review forms
- Review summaries with a count bar per star level, and five-step emoji scales for quick feedback

## When not to use

- A score picked in half or finer steps rather than whole stars: use [Slider](/components/slider)
- A required choice between a few labelled options: use [Radio Group](/components/radio-group)

## Notes

- Editable, a `Rating` is a `radiogroup` of star radios: one tab stop, the arrow keys move the score
- Picks are whole numbers from 1 to `maxRating`; a decimal `rating` draws a partial star but cannot be picked
- `starClassName` styles the `showValue` number, not the stars; recolour stars from `className` through the `rating-star-filled` slot

## Rating: star scores, shown or collected

`Rating` draws a row of stars for a score. Read-only, it is a single image named "Rated 3.5 out of 5" and draws partial stars for averages; with `editable`, it becomes a radio group that people click or move through with the keyboard to set a whole-star score.

### What is Rating?

The familiar five-star score — for products, support conversations, merchants. One component covers showing an average and asking for a new rating.

### Why use Rating?

Stars are understood everywhere and fit in a table cell, a card or a form row. Using one component for display and input keeps sizes and colours consistent, and the accessible names come for free.

### Rating features

- **Partial stars.** A decimal `rating` fills the last star proportionally.
- **Editable.** `editable` with `onRatingChange`, keyboard-operable.
- **Show the value.** `showValue` prints the number beside the stars.
- **Sizes and scale.** `size` and `maxRating`.
- **States and labels.** `disabled`, `aria-invalid`, and localised names from the `rating` labels.

## Integrating with other components

Show a product's average beside its title in a [Card](/components/card), list counts per star with [Progress](/components/progress) bars for a review summary, and collect a score with a [Textarea](/components/textarea) for the written review inside a [Field](/components/field).

## Frequently asked questions

### Can it show half stars?

Yes for display: pass `rating={3.5}`. Input picks whole stars; the Half-Star Input example shows how to build half-star input on top.

### Is the editable rating keyboard-accessible?

Yes. It is a radio group: Tab reaches it, the arrow keys change the score, and each star is announced ("3 stars out of 5").

### How do I read the chosen score?

`onRatingChange` receives the whole number of stars picked; keep it in state and pass it back as `rating`.
