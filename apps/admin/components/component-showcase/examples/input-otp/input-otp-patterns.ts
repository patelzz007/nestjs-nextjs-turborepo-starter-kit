// The character patterns the Input OTP examples restrict entry to. These are
// the same values `input-otp` exports as `REGEXP_ONLY_*`; the kit does not
// re-export them and the admin app does not depend on `input-otp` directly.

/** Digits only (`0-9`). */
export const OTP_DIGITS_ONLY_PATTERN = "^\\d+$";

/** Latin letters and digits. */
export const OTP_DIGITS_AND_LETTERS_PATTERN = "^[a-zA-Z0-9]+$";
