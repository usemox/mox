export class CustomPeopleError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CustomPeopleError'
  }
}
