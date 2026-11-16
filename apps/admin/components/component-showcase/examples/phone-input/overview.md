## When to use

- Phone numbers for sign-up, contact and delivery forms, picked by country and formatted as people type
- Numbers stored and sent in E.164 (`+60123456789`), the format SMS and voice APIs expect
- Forms that pre-fill the country from the billing address or the locale

## When not to use

- A code sent to the number after it is entered: use [Input OTP](/components/input-otp)
- A field that accepts any string, such as an extension or a free-form contact: use [Input](/components/input)

## Notes

- Nothing validates the number on its own: check it in your schema and pass `aria-invalid`, which turns the country button and the field red
- Name the field with a label tied to its `id`, or an `aria-label`; a placeholder is not a name
- Height comes from `variant` (`sm`, `default` or `lg`), not `size`, which stays the native input attribute

## Phone Input: international numbers with a country picker

`PhoneInput` is a phone field with a searchable country picker, built on `react-phone-number-input`. It formats the number for the chosen country as people type and hands you the value in E.164.

### What is Phone Input?

A country button with a flag and dial code, joined to a text field. Choosing a country sets the prefix; typing a full international number picks the country for you. The list opens in a searchable popover, so finding one of two hundred countries is quick.

### Why use Phone Input?

Phone numbers are formatted differently everywhere, and backends need one canonical form. `PhoneInput` shows people their local format while you store `+60123456789`, ready for an SMS or voice API.

### Phone Input features

- **E.164 value.** `onChange` receives the canonical international number.
- **Searchable countries.** A popover list with flags and dial codes.
- **As-you-type formatting.** Spaces and brackets as the country writes them.
- **Default country.** `defaultCountry` with an ISO code such as `MY`.
- **States and sizes.** `aria-invalid`, `disabled`, `readOnly`, and `variant` for `sm`, `default` or `lg`.
- **Localised.** The picker's strings come from the `phoneInput` labels.

## Integrating with other components

Place it in a [Field](/components/field) with a [Label](/components/label) and an error. After it, send a code and collect it with [Input OTP](/components/input-otp).

## Frequently asked questions

### What format is the value in?

E.164: a plus sign, the country code and the number, with no spaces — `+60123456789`.

### How do I set the default country?

`defaultCountry="MY"` (an ISO 3166-1 alpha-2 code). Derive it from the account's billing country or the browser locale when you can.

### How do I validate it?

Validate the E.164 string in your Zod schema — at its simplest `/^\+[1-9]\d{1,14}$/`, or with `isValidPhoneNumber` from `react-phone-number-input` for per-country rules — and set `aria-invalid` when it fails.

### How do I show an existing number?

Pass it as `value` in E.164; the country and the formatting follow from the dial code.
