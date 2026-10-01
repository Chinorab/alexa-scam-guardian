/** Real email through Amazon SES v2 (research R9). The sender comes from SES_FROM. */
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { EmailMessage, Mailer } from "@asg/core/ports/index";

export interface SesMailerOptions {
  /** Verified SES identity, for example "Scam Guardian <alerts@example.org>". */
  from: string;
  /** Optional configuration set for bounce and complaint tracking. */
  configurationSet?: string;
  client?: Pick<SESv2Client, "send">;
}

export class SesMailer implements Mailer {
  private readonly client: Pick<SESv2Client, "send">;

  constructor(private readonly options: SesMailerOptions) {
    this.client = options.client ?? new SESv2Client({});
  }

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const result = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.options.from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: message.text, Charset: "UTF-8" },
              ...(message.html ? { Html: { Data: message.html, Charset: "UTF-8" } } : {}),
            },
          },
        },
        ...(this.options.configurationSet
          ? { ConfigurationSetName: this.options.configurationSet }
          : {}),
      }),
    );
    return { messageId: result.MessageId ?? "" };
  }
}
