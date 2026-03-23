import { createHash } from "crypto";

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim().toLowerCase();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.substring(0, spaceIndex),
    lastName: trimmed.substring(spaceIndex + 1),
  };
}

export function normalizeDocument(doc: string): string {
  return doc.replace(/[.\-/]/g, "");
}

export function normalizeCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export function normalizeZipcode(zip: string): string {
  return zip.replace(/\D/g, "");
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface UserDataInput {
  phone: string;
  email?: string;
  name: string;
  document: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
}

interface MetaUserData {
  ph: string[];
  em?: string[];
  fn: string[];
  ln?: string[];
  ct: string[];
  st: string[];
  zp: string[];
  country: string[];
  external_id: string[];
}

export function buildUserData(input: UserDataInput): MetaUserData {
  const phone = normalizePhone(input.phone);
  const { firstName, lastName } = normalizeName(input.name);
  const doc = normalizeDocument(input.document);
  const city = normalizeCity(input.city);
  const state = input.state.trim().toLowerCase();
  const zip = normalizeZipcode(input.zipcode);
  const country = input.country.trim().toLowerCase();

  const userData: MetaUserData = {
    ph: [hashValue(phone)],
    fn: [hashValue(firstName)],
    ct: [hashValue(city)],
    st: [hashValue(state)],
    zp: [hashValue(zip)],
    country: [hashValue(country)],
    external_id: [hashValue(doc)],
  };

  if (input.email) {
    userData.em = [hashValue(normalizeEmail(input.email))];
  }

  if (lastName) {
    userData.ln = [hashValue(lastName)];
  }

  return userData;
}
