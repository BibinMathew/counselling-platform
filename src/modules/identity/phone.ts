import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeIndianPhone(input: string) {
  const parsed = parsePhoneNumberFromString(input.trim(), "IN");

  if (!parsed || !parsed.isValid() || parsed.country !== "IN") {
    return null;
  }

  return parsed.number;
}
