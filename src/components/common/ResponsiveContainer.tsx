import { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

interface ResponsiveContainerProps {
  desktop: ReactNode
  mobile: ReactNode
}

export function ResponsiveContainer({ desktop, mobile }: ResponsiveContainerProps) {
  const isMobile = useIsMobile()
  
  return (
    <>
      {isMobile ? (
        <div className="md:hidden">{mobile}</div>
      ) : (
        <div className="hidden md:block">{desktop}</div>
      )}
    </>
  )
}
