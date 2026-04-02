import { describe, test, expect } from 'bun:test'
import { estimateTokens } from './token-estimate'

describe('estimateTokens', () => {
  test('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
  test('estimates ~1 token per 4 chars', () => {
    expect(estimateTokens('abcdefgh')).toBe(2)
  })
  test('rounds up', () => {
    expect(estimateTokens('abc')).toBe(1)
  })
})
