export type SaveResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_found' | 'conflict' }

export type MembershipAction = 'add' | 'remove' | 'clear'
