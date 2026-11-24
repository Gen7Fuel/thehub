import { useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fuelGradesService, type FuelGrade, type FuelGradeInput } from '@/api/fuel-management/fuel-grades.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/fuel-management/manage/grades')({
  component: FuelGradesRoute,
})

function FuelGradesRoute() {
  const { user } = useAuth()

  if (user?.access?.fuelManagement?.manage?.grades !== true) {
    return <p role="alert" className="p-6">You don’t have permission to manage fuel grades.</p>
  }

  return <FuelGrades />
}

const gradeQueryKey = ['fuel-grades'] as const
type EditorValues = Omit<FuelGradeInput, 'cstoreFuelTypes'> & { cstoreFuelTypes: string }

function FuelGrades() {
  const queryClient = useQueryClient()
  const gradesQuery = useQuery({ queryKey: gradeQueryKey, queryFn: fuelGradesService.list })
  const [editor, setEditor] = useState<{ id?: string; values: EditorValues } | null>(null)
  const grades = gradesQuery.data ?? []

  const refreshGrades = () => queryClient.invalidateQueries({ queryKey: gradeQueryKey })
  const saveGrade = useMutation({
    mutationFn: ({ id, values }: NonNullable<typeof editor>) => {
      const input = {
        ...values,
        cstoreFuelTypes: values.cstoreFuelTypes.split(',').map(code => code.trim()).filter(Boolean),
      }
      return id ? fuelGradesService.update(id, input) : fuelGradesService.create(input)
    },
    onSuccess: async () => {
      await refreshGrades()
      setEditor(null)
    },
  })
  const toggleGrade = useMutation({
    mutationFn: (grade: FuelGrade) => fuelGradesService.update(grade._id, { active: !grade.active }),
    onSuccess: refreshGrades,
  })

  const startEditing = (grade?: FuelGrade) => {
    saveGrade.reset()
    setEditor(grade ? {
      id: grade._id,
      values: {
        name: grade.name, shortName: grade.shortName, color: grade.color, sortOrder: grade.sortOrder,
        cstoreFuelTypes: grade.cstoreFuelTypes?.join(', ') ?? '',
      },
    } : {
      values: { name: '', shortName: '', color: '#475569', sortOrder: (grades.at(-1)?.sortOrder ?? 0) + 1, cstoreFuelTypes: '' },
    })
  }

  function updateField<K extends keyof EditorValues>(field: K, value: EditorValues[K]) {
    setEditor((current) => current && ({ ...current, values: { ...current.values, [field]: value } }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editor) saveGrade.mutate(editor)
  }

  return (
    <section className="w-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Fuel Grades</h1>
          <Button onClick={() => startEditing()} disabled={!gradesQuery.isSuccess || saveGrade.isPending}>
            Add grade
          </Button>
        </div>

        {editor && (
          <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-4">
            <h2 className="font-semibold">{editor.id ? 'Edit grade' : 'Add grade'}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm font-medium">
                Name
                <Input required maxLength={80} value={editor.values.name}
                  onChange={(event) => updateField('name', event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Short name
                <Input required maxLength={16} value={editor.values.shortName}
                  onChange={(event) => updateField('shortName', event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Color
                <Input type="color" value={editor.values.color}
                  onChange={(event) => updateField('color', event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Display order
                <Input type="number" min={0} step={1} required value={Number.isNaN(editor.values.sortOrder) ? '' : editor.values.sortOrder}
                  onChange={(event) => updateField('sortOrder', event.target.valueAsNumber)} />
              </label>
            </div>
            <div className="max-w-md space-y-1">
              <label htmlFor="cstore-fuel-type" className="text-sm font-medium">CStore Fuel Type</label>
              <Input id="cstore-fuel-type" value={editor.values.cstoreFuelTypes} autoCapitalize="characters"
                aria-describedby="cstore-fuel-type-help"
                onChange={(event) => updateField('cstoreFuelTypes', event.target.value)} />
              <p id="cstore-fuel-type-help" className="text-xs text-muted-foreground">
                Optional. Separate multiple codes with commas. MID is reserved for the Regular/Premium split.
              </p>
            </div>
            {saveGrade.isError && <p role="alert" className="text-sm text-destructive">{saveGrade.error.message}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saveGrade.isPending}>{saveGrade.isPending ? 'Saving…' : 'Save grade'}</Button>
              <Button type="button" variant="outline" onClick={() => setEditor(null)} disabled={saveGrade.isPending}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {gradesQuery.isPending && <p role="status">Loading fuel grades…</p>}
        {gradesQuery.isError && (
          <div className="flex items-center gap-3">
            <p role="alert" className="text-sm text-destructive">{gradesQuery.error.message}</p>
            <Button variant="outline" onClick={() => void gradesQuery.refetch()}>Retry</Button>
          </div>
        )}
        {gradesQuery.isSuccess && grades.length === 0 && <p className="text-muted-foreground">No grades configured.</p>}
        {toggleGrade.isError && <p role="alert" className="text-sm text-destructive">{toggleGrade.error.message}</p>}
        {grades.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th scope="col" className="p-3">Grade</th>
                  <th scope="col" className="p-3">Short name</th>
                  <th scope="col" className="p-3">CStore Fuel Type</th>
                  <th scope="col" className="p-3">Color</th>
                  <th scope="col" className="p-3">Order</th>
                  <th scope="col" className="p-3">Status</th>
                  <th scope="col" className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade) => (
                  <tr key={grade._id} className="border-b last:border-b-0">
                    <th scope="row" className="p-3 font-medium">{grade.name}</th>
                    <td className="p-3">{grade.shortName}</td>
                    <td className="p-3">{grade.cstoreFuelTypes?.join(', ') || '—'}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden="true" className="size-4 rounded border" style={{ backgroundColor: grade.color }} />
                        {grade.color}
                      </span>
                    </td>
                    <td className="p-3">{grade.sortOrder}</td>
                    <td className="p-3">{grade.active ? 'Active' : 'Archived'}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEditing(grade)} disabled={saveGrade.isPending}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleGrade.mutate(grade)} disabled={toggleGrade.isPending}>
                          {grade.active ? 'Archive' : 'Restore'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
