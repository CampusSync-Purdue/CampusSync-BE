import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const logDirectory = join(process.cwd(), 'logs')
const logFile = join(logDirectory, 'application.log')

export function writeLog(entry: Record<string, unknown>, isError = false): void {
  const line = `${JSON.stringify(entry)}\n`

  if (isError) {
    console.error(line.trim())
  } else {
    console.info(line.trim())
  }

  void mkdir(logDirectory, { recursive: true })
    .then(() => appendFile(logFile, line, 'utf8'))
    .catch((error: unknown) => {
      // Do not interrupt an API response if local logging is unavailable.
      console.error('Unable to write application log.', error)
    })
}
