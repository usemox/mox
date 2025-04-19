import type { EmailBody } from '@/types/email'
import type { EmailBodyMiddleware } from '.'

import { generateObject } from 'ai'
import { Database } from '../database'
import { z } from 'zod'
import { middlewareResults, actionItems } from '../database/schema'
import { ulid } from 'ulid'
import { cleanHtml } from '../utils'
import { AIProvider, aiProviderService } from '../ai_providers'

const PROMPT = `You are a helpful assistant whose job is to analyze email content and extract action items.
Your task is to identify any tasks, requests, or commitments that require action from the recipient.
You only respond with the JSON object.

An action item should include:
- description: A clear description of what needs to be done
- dueDate: The deadline for the action item (if specified in the email)

EXAMPLE:

DATA PROVIDED:
<html>
  <div>
    <p>Hi Team,</p>
    <p>Please review the attached document and provide feedback by Friday.</p>
    <p>Also, don't forget we have a meeting scheduled for tomorrow at 2pm.</p>
    <p>Best regards,</p>
    <p>John</p>
  </div>
</html>

RESPONSE:
{
  "actionItems": [
    {
      "description": "Review the attached document and provide feedback",
      "dueDate": "Friday"
    },
    {
      "description": "Attend meeting",
      "dueDate": "tomorrow at 2pm"
    }
  ]
}

If no action items are found, return an empty array:

RESPONSE:
{
  "actionItems": []
}
`

export class ExtractActionItemMiddleware implements EmailBodyMiddleware {
  priority = 2
  name = 'extract-action-items'

  async process(
    db: Database,
    { emailId, body }: { emailId: string; body: EmailBody }
  ): Promise<Record<string, unknown>> {
    const openai = await aiProviderService.getClient(AIProvider.OpenAI)
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        actionItems: z.array(
          z.object({
            description: z.string(),
            dueDate: z.string().nullable().optional()
          })
        )
      }),
      system: PROMPT,
      prompt: `Email HTML Body:
      ${cleanHtml(body.html) ?? body.plain}`
    })

    // Store the middleware result
    await db.insert(middlewareResults).values({
      id: ulid(),
      middlewareId: this.name,
      emailId,
      result: JSON.stringify(object)
    })

    // Store each action item in the action_items table
    if (object.actionItems.length > 0) {
      const actionItemValues = object.actionItems.map((item) => ({
        id: ulid(),
        emailId,
        description: item.description,
        dueDate: item.dueDate || null,
        completed: false
      }))

      await db.insert(actionItems).values(actionItemValues)
    }

    return { actionItems: object.actionItems, emailId }
  }
}
