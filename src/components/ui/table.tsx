import * as React from "react"

import { cn } from "@/lib/utils"
import { Slider } from '@/components/ui/slider'

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { horizontalScroll?: boolean }
>(({ className, horizontalScroll = false, ...props }, ref) => {
  const viewport = React.useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = React.useState(false)
  const [offset, setOffset] = React.useState(0)
  const [maxOffset, setMaxOffset] = React.useState(0)
  React.useEffect(() => {
    if (!horizontalScroll) return
    const element = viewport.current
    const table = element?.querySelector('table')
    if (!element || !table) return
    const measure = () => {
      setOverflow(element.scrollWidth > element.clientWidth + 1)
      setMaxOffset(Math.max(0, element.scrollWidth - element.clientWidth))
      setOffset(element.scrollLeft)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observer.observe(table)
    measure()
    return () => observer.disconnect()
  }, [horizontalScroll])
  return <div className="min-w-0 max-w-full">
    {horizontalScroll && overflow && <div
      role="region"
      aria-label="Desplazamiento horizontal de columnas"
      tabIndex={0}
      className="mb-2 w-full rounded border bg-muted px-3 py-2"
    ><Slider aria-label="Desplazar columnas" value={[offset]} max={maxOffset} step={1} onValueChange={values => {
      const value = values[0] ?? 0
      setOffset(value)
      if (viewport.current) viewport.current.scrollLeft = value
    }} /></div>}
  <div ref={viewport} className={cn("relative w-full min-w-0 max-w-full overflow-auto", horizontalScroll && "table-horizontal-scroll focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    tabIndex={horizontalScroll ? 0 : undefined}
    role={horizontalScroll ? 'region' : undefined}
    aria-label={horizontalScroll ? 'Tabla de solicitudes, todas las columnas' : undefined}
    onScroll={horizontalScroll ? event => setOffset(event.currentTarget.scrollLeft) : undefined}>
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", horizontalScroll && "min-w-max [&_th]:whitespace-nowrap", className)}
      {...props}
    />
  </div>
  </div>
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
