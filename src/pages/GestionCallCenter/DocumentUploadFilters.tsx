import { useState } from 'react'
import { Search, ChevronDown, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { usePublicInstitutions } from '@/hooks/useInstitutions'
import { AllianceCombobox } from '@/pages/Refunds/components/AllianceCombobox'
import { santiagoShortcut, weeklyDocumentFilters, validateDocumentFilters, type DocumentUploadFilters as Filters } from '@/lib/callCenterDocumentUploads'
import type { DocumentUploadMeta } from '@/services/callCenterDocumentUploadsApi'

export function DocumentUploadFilters({ filters, meta, partners, onSearch, busy }: { filters: Filters; meta?: DocumentUploadMeta; partners: Array<{ id: string; nombre: string }>; onSearch: (filters: Filters) => void; busy: boolean }) {
  const [draft, setDraft] = useState(filters)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const institutions = usePublicInstitutions()
  const field = (key: keyof Filters, value: string) => setDraft(prev => ({ ...prev, [key]: value || undefined, page: 1 }))
  const submit = () => {
    try { validateDocumentFilters(draft); setError(''); onSearch({ ...draft, page: 1 }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Revisa las fechas.') }
  }
  const select = (key: keyof Filters, label: string, options: Array<{ value: string; label: string }>) => <div className="space-y-2 min-w-0"><Label>{label}</Label><Select value={String(draft[key] ?? 'all')} onValueChange={value => {
    if (key === 'isPartner') setDraft(prev => ({ ...prev, isPartner: value === 'all' ? undefined : value as '0' | '1', partnerId: value === '0' ? undefined : prev.partnerId, page: 1 }))
    else field(key, value === 'all' ? '' : value)
  }}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
  return <section className="space-y-4 border-b pb-5 min-w-0" aria-label="Filtros de documentos subidos">
    <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">Documentos pendientes</Badge><span className="text-sm text-muted-foreground">Fecha de carga · Santiago</span></div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={draft.preset ? 'secondary' : 'outline'} onClick={() => setDraft(prev => ({ ...prev, preset: 'current_week', uploadedFrom: undefined, uploadedTo: undefined, page: 1 }))}>Semana actual</Button>
      {([{ key: 'today', label: 'Hoy' }, { key: 'yesterday', label: 'Ayer' }, { key: 'seven', label: 'Últimos 7 días' }] as const).map(shortcut => <Button key={shortcut.key} size="sm" variant="outline" disabled={!meta?.generatedAt} onClick={() => { if (meta?.generatedAt) setDraft(prev => ({ ...prev, preset: undefined, ...santiagoShortcut(meta.generatedAt, shortcut.key), page: 1 })) }}>{shortcut.label}</Button>)}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="space-y-2"><Label htmlFor="uploaded-from">Fecha de carga desde</Label><Input id="uploaded-from" type="date" value={draft.uploadedFrom ?? (draft.preset ? meta?.uploadedFrom : '') ?? ''} onChange={e => setDraft(prev => ({ ...prev, preset: undefined, uploadedFrom: e.target.value, uploadedTo: prev.uploadedTo ?? meta?.uploadedTo, page: 1 }))} /></div>
      <div className="space-y-2"><Label htmlFor="uploaded-to">Fecha de carga hasta</Label><Input id="uploaded-to" type="date" value={draft.uploadedTo ?? (draft.preset ? meta?.uploadedTo : '') ?? ''} onChange={e => setDraft(prev => ({ ...prev, preset: undefined, uploadedTo: e.target.value, uploadedFrom: prev.uploadedFrom ?? meta?.uploadedFrom, page: 1 }))} /></div>
      <div className="space-y-2"><Label htmlFor="upload-query">Cliente o solicitud</Label><Input id="upload-query" placeholder="Nombre, RUT, correo o ID" maxLength={120} value={draft.q ?? ''} onChange={e => field('q', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} /></div>
      {select('documentKind', 'Tipo de documento', (meta?.availableDocumentKinds ?? []).map(kind => ({ value: kind, label: kind.replace(/[-_]/g, ' ') })))}
    </div>
    <Button variant="ghost" size="sm" aria-expanded={more} onClick={() => setMore(!more)}><ChevronDown className="h-4 w-4 mr-2" />Más filtros</Button>
    {more && <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {select('institutionId', 'Institución', (institutions.data ?? []).map(i => ({ value: i.value, label: i.label })))}
      {select('insuranceToEvaluate', 'Seguro', [{ value: 'CESANTIA', label: 'Cesantía' }, { value: 'DESGRAVAMEN', label: 'Desgravamen' }, { value: 'AMBOS', label: 'Ambos' }])}
      {select('isPartner', 'Origen', [{ value: '0', label: 'Directo' }, { value: '1', label: 'Alianza' }])}
      {draft.isPartner !== '0' && <div className="space-y-2 min-w-0"><Label>Alianza</Label><AllianceCombobox value={draft.partnerId ?? 'all'} partners={partners} onChange={value => setDraft(prev => ({ ...prev, partnerId: value === 'all' ? undefined : value, isPartner: value === 'all' ? prev.isPartner : '1', page: 1 }))} /></div>}
      {institutions.isError && <p role="alert" className="text-sm text-destructive">No se pudo cargar el catálogo de instituciones.</p>}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button onClick={submit} disabled={busy}><Search className="h-4 w-4 mr-2" />Buscar</Button><Button variant="outline" onClick={() => { setDraft(weeklyDocumentFilters); setError(''); onSearch(weeklyDocumentFilters) }}><RotateCw className="h-4 w-4 mr-2" />Restablecer</Button></div>
  </section>
}