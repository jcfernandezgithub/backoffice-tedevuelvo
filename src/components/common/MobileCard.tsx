import { Card, CardContent } from '@/components/ui/card'
import { ReactNode } from 'react'

interface MobileCardField {
  label: string
  value: ReactNode
  fullWidth?: boolean
}

interface MobileCardProps {
  fields: MobileCardField[]
  onClick?: () => void
  actions?: ReactNode
  header?: ReactNode
}

export function MobileCard({ fields, onClick, actions, header }: MobileCardProps) {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {header && <div className="mb-3">{header}</div>}
        
        <div className="grid grid-cols-2 gap-3">
          {fields.map((field, idx) => (
            <div 
              key={idx} 
              className={`${field.fullWidth ? 'col-span-2' : 'col-span-1'} space-y-1`}
            >
              <div className="text-xs text-muted-foreground font-medium">
                {field.label}
              </div>
              <div className="text-sm font-medium">
                {field.value}
              </div>
            </div>
          ))}
        </div>
        
        {actions && (
          <div className="pt-3 border-t flex gap-2 justify-end">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
