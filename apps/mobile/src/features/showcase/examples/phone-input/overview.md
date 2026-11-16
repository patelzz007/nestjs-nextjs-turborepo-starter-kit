## When to use

- A phone number with its country, formatted as it is typed
- A number the form stores in E.164 (`+60123456789`)
- A stored number shown read only, selectable to copy

## When not to use

- A number with no country, such as an extension: use [Input](/showcase/input) with the phone keypad
- A one-time code sent to the phone: use [InputOTP](/showcase/input-otp)
- Picking a country on its own: use [SelectField](/showcase/select)

## Notes

- The country comes from the number, else the person's pick, else `defaultCountry`
- Whether a number is complete and valid is the form's schema to say

## PhoneInput: a phone number and its country

`PhoneInput` pairs a country button (flag and calling code, a searchable sheet of countries) with a number field that formats as it is typed, using libphonenumber-js.

### What is it?

A country picker and a formatted number field.

### Why use it?

Numbers read correctly and save in one format, whatever country they are from.

### Features

- **Formatting.** As typed, national or international.
- **Countries.** Searchable sheet, emoji flags.
- **E.164.** One stored format.
- **Read only.** Selectable, not editable.

## Integrating with other components

Put it in a [Field](/showcase/field).

## Frequently asked questions

### How do I validate it?

In the form's schema: libphonenumber-js's `isValidPhoneNumber(value)` says whether the number is complete.

### Can I show country names in another language?

Pass `countryName`; the sheet uses it.
