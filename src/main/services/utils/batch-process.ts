export class BatchProcessor {
  /**
   * Process an array of items in batches with controlled concurrency
   * @param items - Array of items to process
   * @param processFn - Async function to process each item
   * @param options - Batch processing options
   * @returns Promise that resolves when all batches are processed
   */
  static async process<T, R>(
    items: T[],
    processFn: (item: T) => Promise<R>,
    options: {
      batchSize?: number
      concurrentBatches?: number
      onBatchComplete?: (results: R[], batchIndex: number) => void
      onItemError?: (error: Error, item: T, itemIndex: number) => void
    } = {}
  ): Promise<R[]> {
    const {
      batchSize = 10,
      concurrentBatches = 1,
      onBatchComplete = (): void => {},
      onItemError = (error): void => console.error('Error processing item:', error)
    } = options

    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    const results: R[] = []

    for (let i = 0; i < batches.length; i += concurrentBatches) {
      const batchPromises = batches
        .slice(i, i + concurrentBatches)
        .map(async (batch, batchIndex) => {
          const actualBatchIndex = i + batchIndex
          const batchResults: R[] = []

          const itemPromises = batch.map(async (item, itemIndex) => {
            try {
              const result = await processFn(item)
              batchResults.push(result)
              return result
            } catch (error) {
              onItemError(error as Error, item, actualBatchIndex * batchSize + itemIndex)
              return null
            }
          })

          await Promise.all(itemPromises)

          onBatchComplete(batchResults, actualBatchIndex)
          return batchResults
        })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.flat().filter((r): r is R => r !== null))
    }

    return results
  }
}
