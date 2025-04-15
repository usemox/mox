export function parseEmail(sender: string): {
  name: string
  email: string
} {
  if (!sender.includes('<')) {
    const email = sender.trim()
    return { name: email, email }
  }

  const matches = sender.match(/^(.*?)\s*<(.+?)>$/)
  if (matches) {
    const [, name, email] = matches
    return {
      name: name.trim() || email,
      email: email.trim()
    }
  }

  return { name: sender, email: sender }
}

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const formatCategories = (categories: string[]): string[] => {
  return categories
    .filter((label) => label?.startsWith('CATEGORY_'))
    .map((label) => label.replace('CATEGORY_', ''))
}
