# Email

The mail slice is the one place the API sends email from. Feature slices inject `MailService`; the transport behind it is a repository picked in the module. Locally that repository talks to [Mailpit](https://mailpit.axllent.org/), a Docker container that catches every message and shows it in a web inbox. In production the same repository talks to any SMTP relay.

```
Feature slice ──send()──> MailService ──IMailGateway──> SmtpMailGateway ──> SmtpRepository ──SMTP──> Mailpit (local)
                                                                                                └──> SES / Postmark / relay (prod)
```

## Why Mailpit

A dev database full of real customer rows plus a working SMTP account is how test emails reach customers. Mailpit removes the account from the equation: nothing leaves the machine, every message is visible at `http://localhost:8025`, and a REST API lets end-to-end tests assert what was sent.

Add it to `docker-compose.yml` next to PostgreSQL:

```yaml [docker-compose.yml]
mail-local:
  image: axllent/mailpit:v1.31.4
  ports:
    - '127.0.0.1:1025:1025' # SMTP
    - '127.0.0.1:8025:8025' # Web UI
  environment:
    MP_MAX_MESSAGES: '500'
  healthcheck:
    test: ['CMD', '/mailpit', 'readyz']
    interval: 2s
    timeout: 3s
    retries: 30
```

::: warning Bind to 127.0.0.1
Mailpit has no authentication. Publishing its ports on every interface exposes the inbox to anyone on the same network.
:::

Environment:

```bash [.env.dev]
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=CleanSlice <noreply@cleanslice.local>
```

The starter kit maps the ports into its own range (`4231` SMTP, `4232` web UI); the numbers live in `.env`, nothing in the code knows them.

## Slice Structure

```
api/src/slices/setup/mail/
├── mail.module.ts                  # @Global; binds IMailGateway -> SmtpMailGateway
├── index.ts
├── domain/
│   ├── mail.types.ts               # IMailMessage, IOutboundMail, IMailResult
│   ├── mail.gateway.ts             # abstract IMailGateway
│   ├── mail.service.ts             # MailService
│   └── mail.errors.ts              # MailNotConfiguredError, MailDeliveryError
└── data/
    ├── mail.gateway.ts             # SmtpMailGateway
    ├── mail.mapper.ts
    └── repositories/smtp/
        ├── smtp.repository.ts      # nodemailer transport from SMTP_* env
        └── smtp.types.ts
```

Install the transport:

```bash
bun add nodemailer
```

## Domain Layer

The domain knows one abstract class and two shapes:

```typescript [domain/mail.types.ts]
export interface IMailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/** What reaches the gateway: the service has already resolved `from`. */
export interface IOutboundMail extends IMailMessage {
  from: string;
}

export interface IMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}
```

```typescript [domain/mail.gateway.ts]
export abstract class IMailGateway {
  abstract send(message: IOutboundMail): Promise<IMailResult>;
}
```

The service fills in the default sender and delegates. A missing `SMTP_FROM` is a configuration error, not a delivery error:

```typescript [domain/mail.service.ts]
@Injectable()
export class MailService {
  constructor(
    private readonly mailGateway: IMailGateway,
    private readonly config: ConfigService,
  ) {}

  async send(message: IMailMessage): Promise<IMailResult> {
    const from = message.from || this.config.get<string>('SMTP_FROM');

    if (!from) {
      throw new MailNotConfiguredError('SMTP_FROM');
    }

    return this.mailGateway.send({ ...message, from });
  }
}
```

```typescript [domain/mail.errors.ts]
export class MailNotConfiguredError extends BaseError {
  public override code = ErrorCodes.MAIL_NOT_CONFIGURED;

  constructor(variable: string) {
    super(
      `Mail is not configured: set ${variable} in the environment`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class MailDeliveryError extends BaseError {
  public override code = ErrorCodes.MAIL_DELIVERY_FAILED;

  constructor(to: string | string[], cause?: Error) {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    super(`Could not deliver mail to "${recipients}"`, HttpStatus.BAD_GATEWAY, {
      cause,
    });
  }
}
```

## Data Layer

The SMTP repository is a black box: env vars and `nodemailer`, nothing from `domain/` or `data/`. It can move to another project unchanged.

```typescript [data/repositories/smtp/smtp.repository.ts]
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, SMTPSentMessageInfo, Transporter } from 'nodemailer';
import { ISmtpConfig, ISmtpMessage, ISmtpSendResult } from './smtp.types';

const toAddress = (entry: string | { address: string }): string =>
  typeof entry === 'string' ? entry : entry.address;

@Injectable()
export class SmtpRepository {
  private readonly transporter: Transporter<SMTPSentMessageInfo>;

  constructor(config: ConfigService) {
    const smtp = SmtpRepository.readConfig(config);

    this.transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    });
  }

  async send(message: ISmtpMessage): Promise<ISmtpSendResult> {
    const info = await this.transporter.sendMail(message);

    return {
      messageId: info.messageId,
      accepted: info.accepted.map(toAddress),
      rejected: info.rejected.map(toAddress),
      response: info.response,
    };
  }

  async verify(): Promise<boolean> {
    return this.transporter.verify();
  }

  private static readConfig(config: ConfigService): ISmtpConfig {
    return {
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(config.get<string>('SMTP_PORT', '1025')),
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      user: config.get<string>('SMTP_USER') || undefined,
      password: config.get<string>('SMTP_PASSWORD') || undefined,
    };
  }
}
```

The gateway maps the domain message onto the repository's shape and turns transport failures into a domain error with the cause attached:

```typescript [data/mail.gateway.ts]
@Injectable()
export class SmtpMailGateway extends IMailGateway {
  constructor(
    private readonly smtp: SmtpRepository,
    private readonly mapper: MailMapper,
  ) {
    super();
  }

  async send(message: IOutboundMail): Promise<IMailResult> {
    try {
      const result = await this.smtp.send(this.mapper.toSmtp(message));
      return this.mapper.toResult(result);
    } catch (error) {
      throw new MailDeliveryError(message.to, error as Error);
    }
  }
}
```

::: tip No verify() on boot
The repository exposes `verify()` but the module never calls it at startup. A relay that is down should fail the one request that sends, with `502 MAIL_DELIVERY_FAILED`, not the boot of the API.
:::

## Module

```typescript [mail.module.ts]
@Global()
@Module({
  providers: [
    MailService,
    MailMapper,
    SmtpRepository,
    {
      provide: IMailGateway,
      useClass: SmtpMailGateway,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
```

It is global for the same reason as `PrismaModule`: infrastructure every feature may need. Register it in `app.module.ts` after `HealthModule`.

## Sending From a Feature Slice

```typescript [slices/invite/domain/invite.service.ts]
@Injectable()
export class InviteService {
  constructor(
    private readonly inviteGateway: IInviteGateway,
    private readonly mail: MailService,
  ) {}

  async invite(email: string): Promise<IInviteData> {
    const invite = await this.inviteGateway.create(email);

    await this.mail.send({
      to: email,
      subject: 'You are invited',
      html: `<a href="${invite.url}">Accept the invitation</a>`,
    });

    return invite;
  }
}
```

Run the flow and open `http://localhost:8025`.

::: warning Await or outbox
`await this.mail.send(...)` is right when the email is the outcome: a password reset, a magic link, an invitation. When it is a side effect of something that must succeed anyway (a welcome email after registration), do not couple them with a bare `await`, and do not drop the promise either. Record the intent and deliver it from a worker or an outbox. A send inside a database transaction is never rolled back with it. See [Reliable Operations](/architecture/reliable-operations).
:::

## Adding Another Provider

An HTTP provider (SES API, Resend, Postmark) is a second repository and a second gateway, chosen in the module. Feature slices do not change:

```typescript [mail.module.ts]
{
  provide: IMailGateway,
  useClass: process.env.MAIL_PROVIDER === 'ses' ? SesMailGateway : SmtpMailGateway,
}
```

Keep the SMTP repository even when the product ships with SES. It is what Mailpit runs on locally.

## Testing

- **Unit:** feature services and `MailService` take a fake `IMailGateway` (`{ send: jest.fn() }`). The gateway test takes a fake `SmtpRepository` and asserts the mapping and the `MailDeliveryError` wrapping.
- **End-to-end:** run the flow against Mailpit, then read the inbox:

```bash
curl -s http://localhost:8025/api/v1/messages | jq '.messages[] | {From, To, Subject}'
curl -s -X DELETE http://localhost:8025/api/v1/messages   # empty it between tests
```

A green build proves the code compiles. The Mailpit round trip proves the relay handshake.

## What's Next?

- [Gateways](/backend/gateways) -- Abstract class in domain, implementation in data
- [Error Handling](/backend/error-handling) -- `BaseError` and error codes
- [Setup Slices](/guide/setup-slices) -- Where the mail slice sits among the others
