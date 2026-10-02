/** Family page form parsing and validation (FR-025). Errors say what to fix, never blame. */
import {
  RELATIONSHIPS,
  type Channel,
  type FamilyMember,
  type Relationship,
} from "@asg/core/ports/index";

export type FormBody = Record<string, string | File | (string | File)[]>;
export type Errors = Record<string, string>;

const text = (body: FormBody, key: string) => {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
};

/** US numbers only: 10 digits, or 11 starting with 1. Returns E.164 or undefined. */
export function usPhone(input: string): string | undefined {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && !/^[01]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && !/^1[01]/.test(digits)) return `+${digits}`;
  return undefined;
}

/** Names: letters in any language, spaces, apostrophes, hyphens and periods. No markup or line breaks. */
const NAME = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
export const validName = (name: string) => NAME.test(name);

export const validEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

export interface MemberValues {
  name: string;
  relationship: Relationship;
  relationshipOther: string;
  nicknames: string;
  channel: Channel;
  phone: string;
  email: string;
  canVerify: boolean;
  getsHeadsUp: boolean;
}

export function memberValues(member?: FamilyMember): MemberValues {
  return {
    name: member?.name ?? "",
    relationship: member?.relationship ?? "grandson",
    relationshipOther: member?.relationshipOther ?? "",
    nicknames: member?.nicknames.join(", ") ?? "",
    channel: member?.channel ?? "text",
    phone: member?.phone ? member.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2 $3") : "",
    email: member?.email ?? "",
    canVerify: member?.canVerify ?? true,
    getsHeadsUp: member?.getsHeadsUp ?? false,
  };
}

export function parseMember(body: FormBody): {
  values: MemberValues;
  errors: Errors;
  fields?: Omit<FamilyMember, "memberId" | "householdId" | "optedOut">;
} {
  const relationship = text(body, "relationship") as Relationship;
  const values: MemberValues = {
    name: text(body, "name"),
    relationship: RELATIONSHIPS.includes(relationship) ? relationship : "other",
    relationshipOther: text(body, "relationshipOther"),
    nicknames: text(body, "nicknames"),
    channel: text(body, "channel") === "email" ? "email" : "text",
    phone: text(body, "phone"),
    email: text(body, "email").toLowerCase(),
    canVerify: body.canVerify === "on",
    getsHeadsUp: body.getsHeadsUp === "on",
  };
  const errors: Errors = {};
  if (!values.name) errors.name = "Enter a first name.";
  else if (values.name.length > 60) errors.name = "Use 60 letters or fewer.";
  else if (!validName(values.name))
    errors.name = "Use letters only, for example Michael or Mary Ann.";
  if (values.relationship === "other" && !values.relationshipOther) {
    errors.relationshipOther = "Say how they are related, for example family friend.";
  } else if (
    values.relationship === "other" &&
    (values.relationshipOther.length > 40 || !validName(values.relationshipOther))
  ) {
    errors.relationshipOther = "Use a few words, for example family friend.";
  }
  const nicknames = values.nicknames
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (nicknames.some((n) => n.length > 30 || !validName(n))) {
    errors.nicknames = "Use letters only, separated by commas, for example Mike, Mikey.";
  }
  const phone = usPhone(values.phone);
  if (values.channel === "text" && !phone)
    errors.phone = "Enter a US mobile number with 10 digits.";
  if (values.channel === "email" && !validEmail(values.email))
    errors.email = "Enter an email address like name@example.com.";
  if (!values.canVerify && !values.getsHeadsUp) {
    errors.roles = "Choose at least one: confirm calls, or get a heads up.";
  }
  if (Object.keys(errors).length > 0) return { values, errors };

  const fields: Omit<FamilyMember, "memberId" | "householdId" | "optedOut"> = {
    name: values.name,
    relationship: values.relationship,
    nicknames,
    channel: values.channel,
    canVerify: values.canVerify,
    getsHeadsUp: values.getsHeadsUp,
  };
  if (values.relationship === "other") fields.relationshipOther = values.relationshipOther;
  if (values.channel === "text" && phone) fields.phone = phone;
  if (values.channel === "email") fields.email = values.email;
  return { values, errors, fields };
}

export const WAIT_CHOICES = [2, 5, 10, 15, 30, 60];

export function parseSettings(body: FormBody): {
  firstName: string;
  waitMinutes: number;
  errors: Errors;
} {
  const firstName = text(body, "firstName");
  const waitMinutes = Number(text(body, "waitMinutes"));
  const errors: Errors = {};
  if (!firstName) errors.firstName = "Enter the first name Alexa should use.";
  else if (firstName.length > 40) errors.firstName = "Use 40 letters or fewer.";
  else if (!validName(firstName)) errors.firstName = "Use letters only, for example Ruth.";
  if (!WAIT_CHOICES.includes(waitMinutes)) errors.waitMinutes = "Choose a wait time from the list.";
  return { firstName, waitMinutes, errors };
}

export function parsePassword(body: FormBody): { password: string; errors: Errors } {
  const password = text(body, "password");
  const confirm = text(body, "confirm");
  const errors: Errors = {};
  if (password.replace(/[^a-z0-9]/gi, "").length < 3)
    errors.password = "Use at least 3 letters or numbers.";
  else if (password.length > 60) errors.password = "Use 60 characters or fewer.";
  else if (password !== confirm) errors.confirm = "The two entries do not match.";
  return { password, errors };
}
