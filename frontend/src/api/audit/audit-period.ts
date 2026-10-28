export type AuditFrequency = 'daily' | 'weekly' | 'monthly' | 'all'

const dateLabel = (date: Date) =>
  date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })

export function describeAuditPeriod(frequency: AuditFrequency, value: Date): string {
  const date = new Date(value)

  if (frequency === 'daily') return `day ${dateLabel(date)}`

  if (frequency === 'weekly') {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `week ${dateLabel(start)} to ${dateLabel(end)}`
  }

  if (frequency === 'monthly') {
    return `month ${date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })}`
  }

  return `day ${dateLabel(date)}, ${describeAuditPeriod('weekly', date)}, and ${describeAuditPeriod('monthly', date)}`
}
