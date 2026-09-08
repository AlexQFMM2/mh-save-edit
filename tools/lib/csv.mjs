import fs from 'node:fs'

export function parseCsv(file) {
  const input = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const records = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some(Boolean)) records.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (field || row.length) {
    row.push(field)
    records.push(row)
  }

  const headers = records.shift() ?? []
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

export function indexCsv(rows, key) {
  return new Map(rows.map((row) => [Number.parseInt(row[key], 10), row]))
}
