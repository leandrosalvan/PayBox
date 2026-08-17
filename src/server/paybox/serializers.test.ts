import { describe, expect, it } from 'vitest'
import { effectiveExpenseStatus, maskEmail } from '@/server/paybox/serializers'

describe('serializadores seguros', () => {
  it('mascara email de membro', () => {
    expect(maskEmail('leandro@example.com')).toBe('le*****@example.com')
  })

  it('calcula atraso sem alterar a despesa', () => {
    const dueDate = new Date('2026-08-01T00:00:00.000Z')
    expect(effectiveExpenseStatus('pending', dueDate, new Date('2026-08-17T03:00:00.000Z'))).toBe('overdue')
    expect(effectiveExpenseStatus('paid', dueDate, new Date('2026-08-17T03:00:00.000Z'))).toBe('paid')
  })
})
