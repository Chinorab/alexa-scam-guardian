/** Sends one message to one saved family member on their saved channel. Never anywhere else. */
import type { FamilyMember, Household } from "@asg/core/ports/index";
import type { Deps } from "../deps";
import type { Rendered } from "../messages/messages";

export async function deliver(
  deps: Deps,
  household: Household,
  member: FamilyMember,
  message: Rendered,
): Promise<"sent" | "failed"> {
  try {
    // Demo households only ever reach the on screen phone. Text messages use the text channel,
    // which is the demo phone until US carrier registration is approved (FR-014).
    if (member.channel === "text") {
      if (!member.phone) return "failed";
      const channel = household.kind === "demo" ? deps.demoOutbox : deps.textChannel;
      await channel.send({
        householdId: household.householdId,
        memberId: member.memberId,
        to: member.phone,
        body: message.text,
      });
      return "sent";
    }
    if (!member.email) return "failed";
    const mailer = household.kind === "demo" ? deps.demoOutbox : deps.mailer;
    await mailer.send({
      householdId: household.householdId,
      memberId: member.memberId,
      to: member.email,
      subject: message.subject,
      text: message.text,
    });
    return "sent";
  } catch {
    return "failed";
  }
}
