export interface Credential {
  id: string
  secret: string
}

export const promptEnum = ['IMPROVE_EMAIL', 'WRITE_EMAIL', 'SUMMARIZE_EMAIL'] as const

export type PromptType = (typeof promptEnum)[number]

export interface Prompt {
  id: PromptType
  prompt: string
}
