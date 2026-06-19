import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function centsToFloat(cents: number) {
  return cents / 100
}

export function floatToCents(value: number) {
  return Math.round(value * 100)
}

export function moneyInputToCents(value: string) {
  const cleaned = value.replace(/[^\d]/g, '')
  return Number(cleaned)
}

export function formatMoneyInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}
