import { desc, like, eq } from 'drizzle-orm'
import { DatabaseService, type Database } from './index'
import { emailAddresses, emails, people } from './schema'
import type { people_v1 } from 'googleapis'
import { ulid } from 'ulid'
import type { Contact } from '@/types/people'
import { parseEmail } from '@/utils/index'

export class PeopleRepository {
  private db: Database

  constructor() {
    this.db = DatabaseService.getInstance().getDb()
  }

  async insertContacts(contacts: people_v1.Schema$Person[]): Promise<void> {
    try {
      this.db.transaction(async (tx) => {
        const peopleData = contacts.map((contact) => ({
          id: contact.resourceName ?? '',
          name: contact.names?.[0]?.displayName ?? '',
          photoUrl: contact.photos?.[0]?.url ?? ''
        }))

        const emailAddressesData = contacts.flatMap(
          (contact) =>
            contact.emailAddresses?.map((email) => ({
              id: ulid(),
              email: email.value ?? '',
              personId: contact.resourceName ?? ''
            })) ?? []
        )

        await tx.insert(people).values(peopleData).onConflictDoNothing()
        await tx.insert(emailAddresses).values(emailAddressesData).onConflictDoNothing()
      })
    } catch (error) {
      console.error('Error inserting contacts', error)
    }
  }

  async getLastFullSync(): Promise<number | null> {
    const result = await this.db
      .select({ date: people.createdAt })
      .from(people)
      .orderBy(desc(people.createdAt))
      .limit(1)

    return result[0].date ?? null
  }

  async fuzzySearch(query: string): Promise<Contact[]> {
    const select = {
      id: people.id,
      name: people.name,
      photoUrl: people.photoUrl
    }

    const matchingPeople = await this.db
      .select(select)
      .from(people)
      .where(like(people.name, `%${query}%`))
      .union(
        this.db
          .select(select)
          .from(emailAddresses)
          .innerJoin(people, eq(emailAddresses.personId, people.id))
          .where(like(emailAddresses.email, `%${query}%`))
      )
      .limit(5)

    const matchingEmails = await this.db
      .select({
        id: emails.id,
        fromAddress: emails.fromAddress
      })
      .from(emails)
      .where(like(emails.fromAddress, `%${query}%`))
      .groupBy(emails.fromAddress)
      .limit(5)

    // Then fetch all email addresses for matched people
    const peopleWithEmails = await Promise.all(
      matchingPeople.map(async (person) => {
        const addresses = await this.db
          .select({
            email: emailAddresses.email
          })
          .from(emailAddresses)
          .where(eq(emailAddresses.personId, person.id))

        return {
          ...person,
          emailAddresses: addresses.map((a) => a.email)
        }
      })
    )

    const emailContacts: Contact[] = matchingEmails.map((email) => {
      const parsed = parseEmail(email.fromAddress)
      return {
        id: email.id,
        name: parsed.name,
        photoUrl: null,
        emailAddresses: [parsed.email]
      }
    })

    return [...emailContacts, ...peopleWithEmails]
  }
}

export const peopleRepository = new PeopleRepository()
