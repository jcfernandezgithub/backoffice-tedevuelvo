export function Timeline({ items }: { items: { fecha: string; evento: string; detalle?: string }[] }) {
  return (
    <ol className="relative border-s pl-4 space-y-4">
      {items.map((it, i) => (
        <li key={i} className="ms-4">
          <div className="absolute w-2 h-2 bg-primary rounded-full -start-1.5 mt-2" />
          <time className="block text-xs text-muted-foreground">{new Date(it.fecha).toLocaleString('es-CL')}</time>
          <p className="text-sm font-medium">{it.evento}</p>
          {it.detalle && <p className="text-sm text-muted-foreground">{it.detalle}</p>}
        </li>
      ))}
    </ol>
  )
}
