export const DEFAULT_SOURCE_HANDLE_ID = 'source:default'
export const DEFAULT_TARGET_HANDLE_ID = 'target:default'

function encodeHandleSegment(value: string) {
  return encodeURIComponent(value)
}

export function sourceHandleId(columnName: string) {
  return `source:${encodeHandleSegment(columnName)}`
}

export function targetHandleId(columnName: string) {
  return `target:${encodeHandleSegment(columnName)}`
}
