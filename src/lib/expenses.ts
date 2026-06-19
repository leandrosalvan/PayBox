import { prisma } from '@/lib/prisma'
import { setDueDay } from '@/lib/locales'

export type ExpenseType = 'single' | 'fixed' | 'installment'

export function setExpenseDueDate(baseDate: Date, day: number) {
  return setDueDay(baseDate, day)
}

export function generateSeriesInstances(
  walletId: string,
  seriesId: string,
  startDate: Date,
  dueDay: number,
  count: number,
  baseValues: {
    description: string
    amount: number
    categoryId?: string | null
    paidById?: string | null
    createdById: string
  },
  type: ExpenseType,
  installmentStart: number = 1
) {
  const instances = []
  let currentDate = new Date(startDate)
  for (let i = 0; i < count; i++) {
    const dueDate = setExpenseDueDate(currentDate, dueDay)
    instances.push({
      seriesId,
      walletId,
      description: baseValues.description,
      amount: baseValues.amount,
      dueDate,
      status: 'pending',
      installmentNumber: type === 'installment' ? installmentStart + i : null,
      categoryId: baseValues.categoryId || null,
      paidById: baseValues.paidById || null,
      createdById: baseValues.createdById,
    })
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
  }
  return instances
}

export async function renewFixedSeriesIfNeeded(walletId: string) {
  const fixedSeries = await prisma.expenseSeries.findMany({
    where: { walletId, type: 'fixed', endDate: { gte: new Date() } },
  })

  const now = new Date()
  const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, 1)

  for (const series of fixedSeries) {
    if (!series.endDate) continue
    if (series.endDate <= threeMonthsFromNow) {
      const lastExpense = await prisma.expense.findFirst({
        where: { seriesId: series.id },
        orderBy: { dueDate: 'desc' },
      })
      if (!lastExpense) continue
      const nextDate = new Date(lastExpense.dueDate.getFullYear(), lastExpense.dueDate.getMonth() + 1, 1)
      const newEndDate = new Date(series.endDate.getFullYear(), series.endDate.getMonth() + 12, 1)
      const count = 12
      const instances = generateSeriesInstances(
        walletId,
        series.id,
        nextDate,
        series.dueDay,
        count,
        {
          description: series.description,
          amount: series.amount,
          categoryId: series.categoryId,
          paidById: series.paidByDefaultId,
          createdById: series.createdById,
        },
        'fixed'
      )
      await prisma.expense.createMany({ data: instances })
      await prisma.expenseSeries.update({
        where: { id: series.id },
        data: { endDate: newEndDate },
      })
    }
  }
}

export async function updateOverdueStatus(walletId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.expense.updateMany({
    where: {
      walletId,
      status: 'pending',
      dueDate: { lt: today },
    },
    data: { status: 'overdue' },
  })
}

export function parseMonth(monthString: string) {
  const [year, month] = monthString.split('-').map(Number)
  return { year, month: month - 1 }
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0, 0)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return { start, end }
}
