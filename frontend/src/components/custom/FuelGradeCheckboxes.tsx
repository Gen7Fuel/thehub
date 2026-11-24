import { useQuery } from '@tanstack/react-query'
import { fuelGradeOptionsQuery } from '@/api/fuel-management/fuel-grades.service'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface FuelGradeCheckboxesProps {
  selected: string[]
  onChange: (grades: string[]) => void
  allowedKeys?: string[]
}

export function FuelGradeCheckboxes({ selected, onChange, allowedKeys }: FuelGradeCheckboxesProps) {
  const { data: catalog = [], isPending, isError, refetch } = useQuery(fuelGradeOptionsQuery)

  if (isPending) return <p role="status" className="text-sm text-muted-foreground">Loading fuel grades…</p>
  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <p role="alert" className="text-sm text-destructive">Could not load fuel grades.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
      </div>
    )
  }

  const choices = catalog.filter(grade => grade.active && (!allowedKeys || allowedKeys.includes(grade.key)))
  const retained = selected.filter(key => !choices.some(grade => grade.key === key))

  if (!choices.length && !retained.length) {
    return <p className="text-sm text-muted-foreground">No fuel grades available.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {choices.map(grade => (
        <label key={grade.key} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
          <Checkbox
            checked={selected.includes(grade.key)}
            onCheckedChange={checked => onChange(checked === true
              ? [...selected, grade.key]
              : selected.filter(key => key !== grade.key))}
          />
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: grade.color }} />
          {grade.name}
        </label>
      ))}
      {retained.map(key => {
        const grade = catalog.find(entry => entry.key === key)
        return (
          <label key={key} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
            <Checkbox checked onCheckedChange={() => onChange(selected.filter(entry => entry !== key))} />
            {grade?.name ?? key}
            <span className="text-xs text-muted-foreground">{grade?.active === false ? 'Archived' : 'Unavailable'}</span>
          </label>
        )
      })}
    </div>
  )
}
