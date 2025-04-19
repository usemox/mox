import type { EmailBody } from '@/types/email'
import type { EmailBodyMiddleware } from '.'

import { generateObject } from 'ai'
import { Database } from '../database'
import { z } from 'zod'
import { middlewareResults } from '../database/schema'
import { ulid } from 'ulid'
import { aiProviderService, AIProvider } from '../ai_providers'

const PROMPT = `You are a helpful assistent your job is to go through the HTML Email contents and extract the login code, who sent the code and the validity period.
You only respond with the JSON object.

The login code is a string of digits and is also named as:
- OTP
- One-Time Password
- Verification Code
- Security Code
- Login Code

The service name is the name of the company that sent the code.

The validity period is the time period in which the code is valid.

EXAMPLE:

DATA PROVIDED:
<html>
  <body>
    <p>Hello, your Google login code is 123456</p>
  </body>
</html>

RESPONSE:
{
  code: "123456",
  service: "Google",
  validFor: null
}

DATA PROVIDED:
<html>
  <body>
    <p>We noticed a suspicious log-in on your OpenAI account. If that was you, enter this code:</p>
    <h2>328782</h2>
    <p>For more information about why you received this email, please see the help center article on One-Time Passwords.</p>
    <p>This code will expire in 1 hour.</p>
  </body>
</html>

RESPONSE:
{
  code: "328782",
  service: "OpenAI",
  validFor: "1 hour"
}

If any of the fields are not present, you should respond with null.
`

export class ExtractOTPMiddleware implements EmailBodyMiddleware {
  priority = 1
  name = 'extract-otp'

  async process(
    db: Database,
    { emailId, body }: { emailId: string; body: EmailBody }
  ): Promise<Record<string, unknown>> {
    const openai = await aiProviderService.getClient(AIProvider.OpenAI)
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        code: z.string().optional().nullable(),
        service: z.string().optional().nullable(),
        validFor: z.string().optional().nullable()
      }),
      system: PROMPT,
      prompt: `Email HTML Body:
      ${body.html}`
    })

    await db.insert(middlewareResults).values({
      id: ulid(),
      middlewareId: this.name,
      emailId,
      result: object
    })

    return { ...object, emailId }
  }
}
