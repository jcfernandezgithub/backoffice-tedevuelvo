import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, RefreshCw, Search, Square, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/state/AuthContext'
import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { bankEmailEligibility, runBankEmailBatch, type BankEmailResult } from '../services/bankEmailBatchService'

const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value) : 'Sin monto'

export default function BankEmailsWizard({ active, onBusyChange }: { active: boolean; onBusyChange: (busy: boolean) => void }) {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Map<string, RefundRequest>>(new Map())
  const [results, setResults] = useState<BankEmailResult[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [batchSize, setBatchSize] = useState(0)
  const stop = useRef(false)
  const lock = useRef(false)
  const attempted = useRef(new Set<string>())
  const scope = `${user?.id}:${user?.rol}:${JSON.stringify(user?.pages ?? [])}`
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['bank-email-recipients', scope, page, search],
    queryFn: ({ signal }) => refundAdminApi.search({ status: 'payment_scheduled', page, limit: 25, q: search || undefined }, signal),
    enabled: active && !!user && !busy,
    retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false,
  })
  useEffect(() => {
    stop.current = true
    setSelected(new Map())
    setResults([])
    attempted.current.clear()
  }, [scope])
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])
  useEffect(() => () => { stop.current = true }, [])
  const rows = data?.items ?? []
  const selectable = rows.filter(row => !bankEmailEligibility(row))
  const allChecked = selectable.length > 0 && selectable.every(row => selected.has(row.id))
  const toggle = (row: RefundRequest, checked: boolean) => setSelected(prev => {
    const next = new Map(prev)
    if (checked) next.set(row.id, row); else next.delete(row.id)
    return next
  })
  const send = async () => {
    if (lock.current || !user || !selected.size) return
    lock.current = true
    stop.current = false
    const batch = [...selected.values()]
    setBatchSize(batch.length)
    setResults([])
    setBusy(true)
    onBusyChange(true)
    try {
      await runBankEmailBatch(batch, result => {
        if (result.attempted) attempted.current.add(result.id)
        setResults(prev => [...prev, result])
        setSelected(prev => { const next = new Map(prev); next.delete(result.id); return next })
      }, () => stop.current, undefined, attempted.current)
    } finally {
      lock.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  const success = results.filter(result => result.status === 'success').length
  return <div className="space-y-5 min-w-0">
    <div className="flex flex-wrap justify-between items-start gap-3 border-b pb-4">
      <div><h2 className="text-xl font-semibold flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Solicitud de datos bancarios</h2><p className="text-sm text-muted-foreground mt-1">Clientes con devolución en Pago programado</p></div>
      <Button disabled={busy || !selected.size || isFetching} onClick={() => setConfirm(true)}><Mail className="mr-2 h-4 w-4" />Enviar a seleccionados ({selected.size})</Button>
    </div>
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(text.trim()) }}>
      <Input aria-label="Buscar cliente, RUT o solicitud" placeholder="Cliente, RUT o solicitud" value={text} onChange={event => setText(event.target.value)} disabled={busy} className="max-w-sm" />
      <Button type="submit" variant="outline" disabled={busy || isFetching}><Search className="h-4 w-4 mr-2" />Buscar</Button>
      <Button type="button" variant="outline" disabled={busy || isFetching} onClick={() => void refetch()}><RefreshCw className="h-4 w-4 mr-2" />Actualizar</Button>
      {!!selected.size && <Button type="button" variant="ghost" disabled={busy} onClick={() => setSelected(new Map())}>Limpiar selección</Button>}
    </form>
    <p className="text-sm text-muted-foreground">{data?.total ?? 0} solicitudes · {selected.size} seleccionadas entre páginas</p>
    {error && <div role="alert" className="border border-destructive rounded-md p-4 text-destructive">{error.message === 'UNAUTHORIZED' ? 'La sesión venció. Vuelve a ingresar para cargar las solicitudes.' : error.message}</div>}
    <div className="overflow-x-auto border rounded-md">
      <Table><TableHeader><TableRow><TableHead className="w-12"><Checkbox aria-label="Seleccionar página" checked={allChecked} disabled={busy || isFetching || !selectable.length} onCheckedChange={checked => setSelected(prev => { const next = new Map(prev); selectable.forEach(row => { if (checked === true) next.set(row.id, row); else next.delete(row.id) }); return next })} /></TableHead><TableHead>Cliente / Solicitud</TableHead><TableHead>RUT</TableHead><TableHead>Correo destinatario</TableHead><TableHead className="text-right">Monto aprobado</TableHead><TableHead>Disponibilidad</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(row => {
        const reason = bankEmailEligibility(row)
        const sent = attempted.current.has(row.id)
        return <TableRow key={row.id}><TableCell><Checkbox aria-label={`Seleccionar ${row.fullName}`} checked={selected.has(row.id)} disabled={busy || isFetching || !!reason} onCheckedChange={checked => toggle(row, checked === true)} /></TableCell><TableCell><div className="font-medium">{row.fullName}</div><div className="text-xs text-muted-foreground">{row.publicId || row.id}</div></TableCell><TableCell className="whitespace-nowrap">{row.rut}</TableCell><TableCell className="break-all">{row.email || 'Sin correo'}</TableCell><TableCell className="text-right whitespace-nowrap">{money((row as RefundRequest & { realAmount?: number }).realAmount)}</TableCell><TableCell className="text-sm">{sent ? 'Advertencia: envío ya intentado; se omitirá' : reason || 'Pago programado'}</TableCell></TableRow>
      })}{!rows.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">{isFetching ? 'Cargando solicitudes…' : error ? 'No fue posible cargar la lista.' : 'No hay solicitudes para estos filtros.'}</TableCell></TableRow>}</TableBody></Table>
    </div>
    <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={busy || isFetching || page <= 1} onClick={() => setPage(prev => prev - 1)}>Anterior</Button><span className="text-sm">Página {page} de {data?.totalPages ?? 1}</span><Button variant="outline" disabled={busy || isFetching || !data?.hasNext} onClick={() => setPage(prev => prev + 1)}>Siguiente</Button></div>
    {(busy || results.length > 0) && <section className="border-t pt-5 space-y-3" aria-live="polite">
      <div className="flex flex-wrap justify-between gap-3 items-center"><h3 className="font-semibold">{busy ? 'Envío en curso' : results.some(result => result.status === 'error') ? 'Lote detenido por error' : results.length < batchSize ? 'Envío detenido' : 'Proceso finalizado'}</h3>{busy && <Button variant="outline" onClick={() => { stop.current = true }}><Square className="h-4 w-4 mr-2" />Detener después del actual</Button>}</div>
      <Progress value={batchSize ? results.length / batchSize * 100 : 0} />
      <p className="text-sm text-muted-foreground">{results.length} de {batchSize} procesadas · {success} envíos confirmados · {results.filter(result => result.status === 'skipped').length} omitidas</p>
      <div className="divide-y">{results.map(result => <div key={result.id} className="py-3 flex gap-3">{result.status === 'success' ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> : <AlertCircle className={`h-5 w-5 shrink-0 ${result.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />}<div className="min-w-0"><div className="font-medium">{result.name} <span className="font-normal text-muted-foreground break-all">· {result.email}</span></div><p className="text-sm text-muted-foreground">{result.detail}</p></div></div>)}</div>
    </section>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Enviar solicitud de datos bancarios</AlertDialogTitle><AlertDialogDescription>Se enviará un correo por cada una de las {selected.size} solicitudes seleccionadas, para completar la cuenta de transferencia de su devolución. No se cambiará el estado de las solicitudes. Verificaremos nuevamente su estado antes de cada envío. Si un envío falla, el lote se detendrá sin reintentos automáticos.</AlertDialogDescription></AlertDialogHeader><div className="max-h-56 overflow-y-auto divide-y">{[...selected.values()].map(row => <div key={row.id} className="py-2 text-sm"><p className="font-medium">{row.fullName}</p><p className="text-muted-foreground break-all">{row.email} · {money((row as RefundRequest & { realAmount?: number }).realAmount)}</p></div>)}</div><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void send()}>Confirmar envío ({selected.size})</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}