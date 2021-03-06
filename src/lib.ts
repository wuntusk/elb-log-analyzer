import { validateColumns } from './utils/validateColumns'
import { generateFilter } from './utils/filter'
import { collectFileNames } from './utils/collectFileNames'
import { parseAndProcessFiles } from './utils/parseAndProcessFiles'
import { generateProcessor } from './utils/generateProcessor'
import { LibraryOptions } from './types/library'

export async function asyncForEach(
  array: Array<any>,
  callback: (item: any, index: number, array: Array<any>) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

export default async function ({
  files = [],
  cols = ['count', 'requested_resource'],
  prefixes = [],
  sortBy = 0,
  limit = 10,
  ascending = false,
  start,
  end,
  onProgress = () => {},
  onStart = () => {},
}: LibraryOptions) {
  const fileNames = await collectFileNames(files)

  onStart(fileNames)

  // Fail when user requests a column that is not support by the analyzer
  if (!validateColumns(cols)) {
    throw new Error('One or more of the requested columns does not exist.')
  }

  // Fail when user gives a sortBy value for a non-existent column
  if (sortBy < 0 || sortBy > cols.length - 1) {
    throw new Error(
      "Invalid 'sortBy' parameter. 'sortBy' cannot be lower than 0 or greater than number of columns."
    )
  }

  const processor = generateProcessor({
    requestedColumns: cols,
    sortBy,
    limit,
    ascending,
    prefixes,
    start,
    end,
  })

  const filterFunc = generateFilter(prefixes.slice(), cols)

  // await parseAndProcessFiles(fileNames, processor.process.bind(processor, filterFunc), onProgress)

  const fileGroups:Array<string[]> = []

  while (fileNames.length > 2000) {
    fileGroups.push(fileNames.splice(0, 2000))
  }

  if (fileNames.length > 0) {
    fileGroups.push(fileNames)
  }

  await asyncForEach(fileGroups, async fileGroup => {
    await parseAndProcessFiles(fileGroup, processor.process.bind(processor, filterFunc), onProgress)
  })

  let logs = processor.getResults()

  if (ascending) {
    logs = logs.slice(0, limit)
  } else {
    logs = logs.slice(logs.length > limit ? logs.length - limit : 0).reverse()
  }
  return logs
}
