/**
 * Demo household (FR-032): a sample family so anyone can try the whole flow without setup.
 * All contact details are fictional: 555 01xx numbers are reserved for fiction and
 * example.com is reserved for examples. Demo messages only ever reach the on screen phone.
 */
import { hashFamilyPassword } from "../auth/family-password";
import { newId } from "../ids";
import { epochSeconds, type FamilyMember, type Household, type Store } from "../ports/index";

export const DEMO_FIRST_NAME = "Ruth";
export const DEMO_PASSWORD = "blue river";
/** Short in the demo so the "no answer" case can be shown live. */
export const DEMO_WAIT_MINUTES = 2;
const DAY_SECONDS = 24 * 60 * 60;

export async function seedDemoHousehold(store: Store, now: Date): Promise<Household> {
  const householdId = newId("household");
  const expiresAt = epochSeconds(now) + DAY_SECONDS;
  const household: Household = {
    householdId,
    kind: "demo",
    olderAdultFirstName: DEMO_FIRST_NAME,
    waitMinutes: DEMO_WAIT_MINUTES,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
  };
  const members: FamilyMember[] = [
    {
      memberId: newId("member"),
      householdId,
      name: "Michael",
      relationship: "grandson",
      nicknames: ["Mike", "Mikey"],
      channel: "text",
      phone: "+15555550142",
      canVerify: true,
      getsHeadsUp: false,
      optedOut: false,
    },
    {
      memberId: newId("member"),
      householdId,
      name: "Sarah",
      relationship: "daughter",
      nicknames: [],
      channel: "email",
      email: "sarah@example.com",
      canVerify: true,
      getsHeadsUp: true,
      optedOut: false,
    },
  ];
  await store.putHousehold(household);
  for (const member of members) await store.putMember(member);
  const password = await hashFamilyPassword(DEMO_PASSWORD);
  await store.putPassword({ householdId, ...password, setAt: now.toISOString() });
  return household;
}
