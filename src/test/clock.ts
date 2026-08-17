import { vi } from 'vitest'

export const TEST_NOW = new Date('2026-08-17T03:00:00.000Z')

export function useTestClock(now: Date = TEST_NOW) {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  return now
}
