import { makeAutoObservable, runInAction } from 'mobx'

type ContactSelectItem = {
  value: string
  label: string
  description: string
  data: string
}

class ContactsStore {
  contacts: ContactSelectItem[] = []
  isLoading = false

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async getContacts(query: string): Promise<void> {
    if (this.isLoading) return

    if (query.length < 3) {
      runInAction(() => {
        this.contacts = []
      })
      return
    }

    runInAction(() => {
      this.isLoading = true
    })

    const res = await window.api.people.search(query)

    runInAction(() => {
      if (!res.success) {
        this.isLoading = false
        return
      }

      this.contacts =
        res.data?.flatMap((contact) =>
          contact.emailAddresses.map((email) => ({
            value: email,
            label: contact.name,
            description: email,
            data: email
          }))
        ) ?? []

      this.isLoading = false
    })
  }
}

export const contactsStore = new ContactsStore()
