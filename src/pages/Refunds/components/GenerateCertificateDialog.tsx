import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Download, Search, User, MapPin, CreditCard, ArrowLeft, Eye, Shield, AlertCircle, Loader2, Hash, RefreshCw, Upload, CheckCircle2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RefundRequest } from '@/types/refund'
import { authService } from '@/services/authService'
import { refundAdminApi } from '@/services/refundAdminApi'
import { derivePremiumsFromSnapshot } from '@/lib/snapshotPremiums'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import jsPDF from 'jspdf'
import firmaAugustarImg from '@/assets/firma-augustar.jpeg'
import firmaTdvImg from '@/assets/firma-tdv.png'
import firmaCngImg from '@/assets/firma-cng.jpeg'
import { 
  isBancoChile, 
  usesBancoChileTemplate,
  generateBancoChilePol353PDF,
  generateGenericPol353PDF,
  generateChevroletSfPol353PDF,
  getBancoChileTasaBrutaMensual,
  BANCO_CHILE_CONFIG
} from './pdfGenerators/bancoChilePdfGenerator'
import { getPlanByAmount, POL347_CONFIG } from './pdfGenerators/pol347Config'
import { getBankRateMatrix } from '@/services/ratesService'

// Mapeo de instituciones (igual que en calculadoraUtils)
const MAPEO_INSTITUCIONES: { [key: string]: string } = {
  Santander: "BANCO SANTANDER",
  BCI: "BANCO BCI",
  "Lider BCI": "LIDER-BCI",
  Scotiabank: "SCOTIABANK",
  Chile: "BANCO CHILE",
  chile: "BANCO CHILE",
  Security: "BANCO SECURITY",
  "Itaú - Corpbanca": "BANCO ITAU-CORPBANCA",
  BICE: "BANCO BICE",
  Estado: "BANCO ESTADO",
  "Banco Ripley": "BANCO RIPLEY",
  Falabella: "BANCO FALABELLA",
  Consorcio: "BANCO CONSORCIO",
  Condell: "BANCO CONSORCIO",
  Internacional: "BANCO CONSORCIO",
  Cencosud: "BANCO CENCOSUD",
  Coopeuch: "COOPEUCH",
  Cooperativas: "COOPERATIVAS",
  Forum: "FORUM",
  Tanner: "TANNER",
}

// Función para obtener tasa del banco desde el JSON (igual que en calculadoraUtils)
const obtenerTasaBancoFromJSON = (
  banco: string,
  edad: number,
  monto: number,
  cuotas: number,
): { tasa: number; cuotasUtilizadas: number; montoRedondeado: number } | null => {
  try {
    // Primero intentar mapeo directo, luego buscar por nombre normalizado
    let bancoMapeado = MAPEO_INSTITUCIONES[banco]
    
    // Si no está en el mapeo, intentar con el banco en mayúsculas o buscar variantes
    if (!bancoMapeado) {
      const bancoUpper = banco.toUpperCase()
      // Buscar en el mapeo por valor (case insensitive)
      for (const [key, value] of Object.entries(MAPEO_INSTITUCIONES)) {
        if (key.toLowerCase() === banco.toLowerCase()) {
          bancoMapeado = value
          break
        }
      }
      // Si aún no encontrado, intentar agregando "BANCO " al principio
      if (!bancoMapeado) {
        bancoMapeado = bancoUpper.startsWith('BANCO ') ? bancoUpper : `BANCO ${bancoUpper}`
      }
    }
    
    console.log('obtenerTasaBancoFromJSON:', { bancoOriginal: banco, bancoMapeado, edad, monto, cuotas })
    
    const tramo = edad <= 55 ? "hasta_55" : "desde_56"
    const montoRedondeado = Math.round(monto / 1000000) * 1000000
    const montoFinal = Math.min(Math.max(montoRedondeado, 2000000), 60000000)

    const tasasSeguro = getBankRateMatrix() as any
    if (!tasasSeguro[bancoMapeado as keyof typeof tasasSeguro]) {
      console.warn(`Banco no encontrado en JSON: ${bancoMapeado} (original: ${banco})`)
      return null
    }

    const datosBanco = tasasSeguro[bancoMapeado as keyof typeof tasasSeguro] as Record<string, Record<string, Record<string, number>>>
    const datosTramo = datosBanco[tramo]
    const datosMonto = datosTramo?.[montoFinal.toString()]

    if (!datosMonto || typeof datosMonto !== "object") {
      console.warn(`No hay datos para monto ${montoFinal} en banco ${bancoMapeado}`)
      return null
    }

    let tasa = datosMonto[cuotas.toString()]
    let cuotasUtilizadas = cuotas

    if (typeof tasa !== "number" || isNaN(tasa)) {
      const cuotasDisponibles = Object.keys(datosMonto)
        .map(Number)
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b)

      if (cuotasDisponibles.length === 0) {
        return null
      }

      let cuotaCercana = cuotasDisponibles[0]
      let menorDiferencia = Math.abs(cuotas - cuotaCercana)

      for (const cuotaDisponible of cuotasDisponibles) {
        const diferencia = Math.abs(cuotas - cuotaDisponible)
        if (diferencia < menorDiferencia) {
          menorDiferencia = diferencia
          cuotaCercana = cuotaDisponible
        } else if (diferencia === menorDiferencia && cuotaDisponible > cuotaCercana) {
          cuotaCercana = cuotaDisponible
        }
      }

      tasa = datosMonto[cuotaCercana.toString()]
      cuotasUtilizadas = cuotaCercana
    }

    if (typeof tasa !== "number" || isNaN(tasa)) {
      return null
    }

    console.log('Tasa obtenida del JSON:', { banco: bancoMapeado, tramo, montoFinal, cuotasUtilizadas, tasa })
    return { tasa, cuotasUtilizadas, montoRedondeado: montoFinal }
  } catch (error) {
    console.error("Error obteniendo tasa del banco desde JSON:", error)
    return null
  }
}

// RUT validation regex - accepts formats: 12345678-9, 12.345.678-9, or with 7-8 digit numbers
const rutRegex = /^(\d{7,8}-[\dkK]|\d{1,2}\.\d{3}\.\d{3}-[\dkK])$/i

// Function to validate Chilean RUT check digit
function validateRutDigit(rut: string): boolean {
  // Clean the RUT (remove dots and hyphen)
  const cleanRut = rut.replace(/\./g, '').replace(/-/g, '')
  
  if (cleanRut.length < 2) return false
  
  const rutNumber = cleanRut.slice(0, -1)
  const digit = cleanRut.slice(-1).toUpperCase()
  
  // Validate that the numeric part only contains digits
  if (!/^\d+$/.test(rutNumber)) return false
  
  // Calculate check digit
  let sum = 0
  let multiplier = 2
  
  for (let i = rutNumber.length - 1; i >= 0; i--) {
    sum += parseInt(rutNumber[i]) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }
  
  const remainder = sum % 11
  const calculatedDigit = remainder === 0 ? '0' : remainder === 1 ? 'K' : String(11 - remainder)
  
  return digit === calculatedDigit
}

// Validate RUT format and check digit
function validateRut(rut: string): { isValid: boolean; error?: string } {
  if (!rut || rut.trim() === '') {
    return { isValid: true } // Empty is valid (optional field)
  }
  
  if (!rutRegex.test(rut)) {
    return { isValid: false, error: 'Formato inválido. Use: 12345678-9 o 12.345.678-9' }
  }
  
  if (!validateRutDigit(rut)) {
    return { isValid: false, error: 'Dígito verificador inválido' }
  }
  
  return { isValid: true }
}

interface GenerateCertificateDialogProps {
  refund: RefundRequest
  isMandateSigned?: boolean
  certificateType?: 'desgravamen' | 'cesantia'
}

interface CertificateData {
  folio: string
  direccion: string
  numero: string
  depto: string
  ciudad: string
  comuna: string
  celular: string
  sexo: 'M' | 'F' | ''
  autorizaEmail: 'SI' | 'NO'
  nroOperacion: string
  fechaInicioCredito: string
  fechaFinCredito: string
  saldoInsoluto: string
  // Campos para Banco de Chile - Beneficiario Irrevocable
  beneficiarioNombre: string
  beneficiarioRut: string
}

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  try {
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      return `${day}/${month}/${year}`
    }
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateString || ''
  }
}

const getTodayFormatted = () => {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  return `${day}/${month}/${year}`
}

// Compute coverage dates from the moment refund transitioned to 'submitted' (Ingresada).
// Returns empty strings if the refund never went through 'submitted'.
const getCoverageDatesFromSubmitted = (refund: RefundRequest): { fechaInicio: string; fechaFin: string } => {
  const history = refund.statusHistory || []
  const submittedEntry = [...history].reverse().find((h) => h.to === 'submitted')
  if (!submittedEntry?.at) return { fechaInicio: '', fechaFin: '' }

  const start = new Date(submittedEntry.at)
  if (isNaN(start.getTime())) return { fechaInicio: '', fechaFin: '' }

  const remaining =
    refund.calculationSnapshot?.confirmedRemainingInstallments ||
    refund.calculationSnapshot?.remainingInstallments ||
    0

  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = d.getFullYear()
    return `${dd}/${mm}/${yy}`
  }

  const fechaInicio = fmt(start)
  let fechaFin = ''
  if (typeof remaining === 'number' && remaining > 0) {
    const end = new Date(start)
    end.setMonth(end.getMonth() + remaining)
    fechaFin = fmt(end)
  }
  return { fechaInicio, fechaFin }
}

// Fallback rates if not available in calculationSnapshot
const getTasaBrutaMensualFallback = (age?: number, isPrime: boolean = false): number => {
  if (isPrime) {
    // Prime (Póliza 344) rates
    if (!age) return 0.3440
    if (age >= 18 && age <= 55) return 0.3440
    if (age >= 56 && age <= 65) return 0.3430
    return 0.3440
  }
  // Standard (Póliza 342) rates
  if (!age) return 0.3000
  if (age >= 18 && age <= 55) return 0.3000
  if (age >= 56 && age <= 65) return 0.3900
  return 0.3000
}

// Calcular Prima Única del Seguro desde el calculationSnapshot
// Fórmula: Nueva Prima Mensual × Cuotas Pendientes
const getPrimaUnicaFromSnapshot = (refund: RefundRequest): number | null => {
  const snapshot = refund.calculationSnapshot

  // Capa defensiva: derivar la nueva prima en runtime con datos confirmados
  // actuales en lugar de confiar en el valor persistido (que puede estar stale).
  const derived = derivePremiumsFromSnapshot(snapshot, refund.institutionId)
  const newMonthlyPremium = derived.newMonthlyPremium || snapshot?.newMonthlyPremium
  const remainingInstallments = snapshot?.confirmedRemainingInstallments || snapshot?.remainingInstallments
  
  if (typeof newMonthlyPremium === 'number' && typeof remainingInstallments === 'number' && newMonthlyPremium > 0 && remainingInstallments > 0) {
    const primaUnica = newMonthlyPremium * remainingInstallments
    console.log('Prima Única calculada desde snapshot:', { newMonthlyPremium, remainingInstallments, primaUnica, source: derived.source })
    return primaUnica
  }
  
  console.warn('No se pudo calcular Prima Única desde snapshot - datos faltantes:', { newMonthlyPremium, remainingInstallments })
  return null
}

// Derivar TBM desde la Prima Única calculada
// Fórmula inversa: TBM = (Prima Única / (Saldo Insoluto × Nper)) × 1000
const getTasaFromPrimaUnica = (refund: RefundRequest, saldoInsoluto: number): number | null => {
  const snapshot = refund.calculationSnapshot
  const primaUnica = getPrimaUnicaFromSnapshot(refund)
  const remainingInstallments = snapshot?.confirmedRemainingInstallments || snapshot?.remainingInstallments
  
  if (primaUnica && saldoInsoluto > 0 && remainingInstallments && remainingInstallments > 0) {
    // TBM = (Prima Única / (Saldo Insoluto × Nper)) × 1000
    const tbm = (primaUnica / (saldoInsoluto * remainingInstallments)) * 1000
    console.log('TBM derivada desde Prima Única:', { primaUnica, saldoInsoluto, remainingInstallments, tbm })
    return tbm
  }
  
  return null
}

// Get TBM - always use the official policy rates based on age and policy type
const getTasaFromSnapshot = (refund: RefundRequest, isPrime: boolean, _saldoInsoluto?: number): number => {
  const age = refund.calculationSnapshot?.age
  return getTasaBrutaMensualFallback(age, isPrime)
}

// Helper to load image as base64
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg'))
    }
    img.onerror = reject
    img.src = src
  })
}

const CERT_API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

export function GenerateCertificateDialog({ refund, isMandateSigned = false, certificateType = 'desgravamen' }: GenerateCertificateDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'preview'>('form')
  const [isAssigningFolio, setIsAssigningFolio] = useState(false)
  const [folioError, setFolioError] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingRut, setIsLoadingRut] = useState(false)
  const [firmaBase64, setFirmaBase64] = useState<string>('')
  const [firmaTdvBase64, setFirmaTdvBase64] = useState<string>('')
  const [firmaCngBase64, setFirmaCngBase64] = useState<string>('')
  const [formData, setFormData] = useState<CertificateData>({
    folio: '',
    direccion: '',
    numero: '',
    depto: '',
    ciudad: '',
    comuna: '',
    celular: refund.phone || '',
    sexo: '',
    autorizaEmail: 'SI',
    nroOperacion: refund.calculationSnapshot?.nroCredito ? String(refund.calculationSnapshot.nroCredito) : '',
    fechaInicioCredito: getCoverageDatesFromSubmitted(refund).fechaInicio,
    fechaFinCredito: getCoverageDatesFromSubmitted(refund).fechaFin,
    saldoInsoluto: (refund.calculationSnapshot?.confirmedAverageInsuredBalance || refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || refund.estimatedAmountCLP || 0).toString(),
    beneficiarioNombre: refund.fullName || '',
    beneficiarioRut: refund.rut || '',
  })

  // Check if this refund is for Banco de Chile
  const isBancoChileRefund = isBancoChile(refund.institutionId)
  const usesChileTemplate = usesBancoChileTemplate(refund.institutionId)
  const isChevroletSf = usesChileTemplate && !isBancoChileRefund

  // State for RUT validation error
  const [rutError, setRutError] = useState<string | undefined>(undefined)

  // Load firma images on mount
  useEffect(() => {
    loadImageAsBase64(firmaAugustarImg).then(setFirmaBase64).catch(console.error)
    loadImageAsBase64(firmaTdvImg).then(setFirmaTdvBase64).catch(console.error)
    loadImageAsBase64(firmaCngImg).then(setFirmaCngBase64).catch(console.error)
  }, [])

  // Sync saldoInsoluto from refund data each time the dialog opens
  useEffect(() => {
    if (open) {
      const freshSaldo = (refund.calculationSnapshot?.confirmedAverageInsuredBalance || refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || refund.estimatedAmountCLP || 0).toString()
      const snapNroCredito = refund.calculationSnapshot?.nroCredito ? String(refund.calculationSnapshot.nroCredito) : ''
      const coverageDates = getCoverageDatesFromSubmitted(refund)
      setFormData(prev => ({
        ...prev,
        saldoInsoluto: freshSaldo,
        celular: refund.phone || prev.celular,
        nroOperacion: prev.nroOperacion || snapNroCredito,
        beneficiarioNombre: prev.beneficiarioNombre || refund.fullName || '',
        beneficiarioRut: prev.beneficiarioRut || refund.rut || '',
        fechaInicioCredito: coverageDates.fechaInicio,
        fechaFinCredito: coverageDates.fechaFin,
      }))
      // Auto-assign folio when dialog opens if not already set
      if (!formData.folio) {
        assignFolio()
      }
    }
  }, [open, refund])

  const assignFolio = useCallback(async (reassign = false) => {
    if (!refund.publicId) return
    setIsAssigningFolio(true)
    setFolioError(undefined)
    try {
      const result = await refundAdminApi.assignFolio(refund.publicId, reassign)
      if (result.ok && result.nroFolio) {
        setFormData(prev => ({ ...prev, folio: result.nroFolio }))
        if (result.alreadyAssigned) {
          toast({ title: 'Folio existente', description: `Folio ${result.nroFolio} ya estaba asignado` })
        } else {
          toast({ title: 'Folio asignado', description: `Folio ${result.nroFolio} asignado correctamente` })
        }
      }
    } catch (error: any) {
      console.error('Error asignando folio:', error)
      setFolioError(error.message || 'Error al asignar folio')
      toast({ title: 'Error al asignar folio', description: error.message, variant: 'destructive' })
    } finally {
      setIsAssigningFolio(false)
    }
  }, [refund.publicId])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setStep('form')
    }
  }

  const handlePreview = () => {
    if (!formData.folio) {
      toast({
        title: 'Folio requerido',
        description: 'Debe asignarse un folio antes de previsualizar el certificado',
        variant: 'destructive',
      })
      return
    }
    
    const saldoInsolutoValue = parseFloat(formData.saldoInsoluto.replace(/\./g, '').replace(',', '.')) || 0
    if (saldoInsolutoValue === 0) {
      toast({
        title: 'Error de validación',
        description: 'El Saldo Insoluto no puede ser cero',
        variant: 'destructive',
      })
      return
    }
    
    // Validate beneficiary (Banco de Chile y Chevrolet SF lo requieren obligatoriamente)
    if (usesChileTemplate) {
      if (!formData.beneficiarioNombre.trim() || !formData.beneficiarioRut.trim()) {
        toast({
          title: 'Error de validación',
          description: 'Debe ingresar el nombre y RUT del beneficiario irrevocable.',
          variant: 'destructive',
        })
        return
      }
      const rutValidation = validateRut(formData.beneficiarioRut)
      if (!rutValidation.isValid) {
        setRutError(rutValidation.error)
        toast({
          title: 'Error de validación',
          description: `RUT del beneficiario: ${rutValidation.error}`,
          variant: 'destructive',
        })
        return
      }
    }
    
    setStep('preview')
  }

  const handleBackToEdit = () => {
    setStep('form')
  }

  const handleChange = (field: keyof CertificateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Validate RUT on change for beneficiarioRut field
    if (field === 'beneficiarioRut') {
      if (value.trim() === '') {
        setRutError(undefined)
      } else {
        const validation = validateRut(value)
        setRutError(validation.error)
      }
    }
  }

  const fetchRutInfo = async () => {
    setIsLoadingRut(true)
    
    try {
      const rut = refund.rut || ''
      const rutParts = rut.split('-')
      const rutNumber = rutParts[0].replace(/\./g, '')
      const rutDV = rutParts[1] || ''
      const cleanRut = `${rutNumber}${rutDV}`
      
      const token = authService.getAccessToken()
      
      const response = await fetch(`https://rut-data-extractor-production.up.railway.app/rut/${cleanRut}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      })
      
      if (!response.ok) {
        throw new Error('Error al consultar el servicio')
      }

      const data = await response.json()
      
      const genero = data.data?.genero || ''
      const sexo = genero === 'MUJ' ? 'F' : genero === 'VAR' ? 'M' : ''
      const direccion = data.data?.direccion || ''
      const comuna = data.data?.comuna || ''
      
      setFormData(prev => ({
        ...prev,
        sexo: sexo as 'M' | 'F' | '',
        direccion,
        comuna,
      }))
      
      toast({
        title: 'Información encontrada',
        description: 'Se han actualizado los datos del cliente',
      })
    } catch (error) {
      toast({
        title: 'Datos no encontrados',
        description: 'No se pudo obtener la información. Puede ingresar los datos manualmente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingRut(false)
    }
  }

  const calculatePrimaUnica = () => {
    // Prima Única = Nueva Prima Mensual TDV × Cuotas Pendientes (desde snapshot)
    // Esto refleja la prima realmente cobrada por TDV según el snapshot editado.
    const primaFromSnapshot = getPrimaUnicaFromSnapshot(refund)
    if (primaFromSnapshot && primaFromSnapshot > 0) {
      return Math.round(primaFromSnapshot)
    }
    // Fallback: fórmula legal Saldo × TBM × Nper si no hay datos en snapshot
    const saldoInsoluto = parseFloat(formData.saldoInsoluto.replace(/\./g, '').replace(',', '.')) || 0
    const nper = refund.calculationSnapshot?.confirmedRemainingInstallments || refund.calculationSnapshot?.remainingInstallments || 0
    const tbm = getTasaFromSnapshot(refund, isPrimeFormat, saldoInsoluto) / 1000
    return Math.round(saldoInsoluto * tbm * nper)
  }
  
  // Get the TBM value for display - derived from Prima Única of snapshot to keep coherence
  const getTbmForDisplay = (): number => {
    const saldoInsoluto = getSaldoInsolutoValue()
    // Si hay datos en snapshot, derivar TBM inversa para que coincida con la Prima Única mostrada
    const tbmDerivada = getTasaFromPrimaUnica(refund, saldoInsoluto)
    if (tbmDerivada && tbmDerivada > 0) return tbmDerivada
    // Fallback a TBM legal
    return getTasaFromSnapshot(refund, isPrimeFormat, saldoInsoluto)
  }

  const getSaldoInsolutoValue = () => {
    return parseFloat(formData.saldoInsoluto.replace(/\./g, '').replace(',', '.')) || 0
  }

  // Check if Prime format should be used (saldo insoluto > 20 million)
  const isPrimeFormat = getSaldoInsolutoValue() > 20000000

  // Tasa Bruta Mensual para Póliza 344 (Prime)
  const getTasaBrutaMensualPrime = (age?: number): number => {
    if (!age) return 0.3440
    if (age >= 18 && age <= 55) return 0.3440
    if (age >= 56 && age <= 65) return 0.3430
    return 0.3440
  }


  const uploadCertificateToClient = async (pdfBlob: Blob) => {
    const docsPublicId = (refund as any).cloned && (refund as any).siblingId
      ? (refund as any).siblingId
      : refund.publicId
    const token = authService.getAccessToken()
    const uploadFormData = new FormData()
    const folioSuffix = formData.folio ? `-folio-${formData.folio}` : ''
    const timestamp = Date.now()
    uploadFormData.append('file', pdfBlob, `certificado-cobertura-${refund.publicId}${folioSuffix}-${timestamp}.pdf`)
    uploadFormData.append('kind', 'certificado-de-cobertura-desgravamen')

    const response = await fetch(`${CERT_API_BASE_URL}/refund-requests/${docsPublicId}/upload-file`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: uploadFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Error al subir certificado')
    }

    // Forzar refetch inmediato de documentos para ver el nuevo archivo
    await queryClient.refetchQueries({ queryKey: ['refund-documents', docsPublicId] })
    await queryClient.refetchQueries({ queryKey: ['refund-documents', refund.publicId] })
  }

  const generatePDF = async () => {
    setIsGenerating(true)
    try {
      let pdfBlob: Blob | undefined


      // Generador unificado Pol347 (Banco de Chile / Chevrolet SF / genérico)
      if (isBancoChileRefund) {
        pdfBlob = await generateBancoChilePol353PDF(refund, formData, firmaBase64, firmaTdvBase64, firmaCngBase64)
      } else if (isChevroletSf) {
        pdfBlob = await generateChevroletSfPol353PDF(refund, formData, firmaBase64, firmaTdvBase64, firmaCngBase64)
      } else {
        pdfBlob = await generateGenericPol353PDF(refund, formData, firmaBase64, firmaTdvBase64, firmaCngBase64)
      }

      // Descarga local
      if (pdfBlob) {
        const fileName = `Cert_Cobertura_Desgravamen_Pol353_${refund.rut.replace(/\./g, '').replace('-', '_')}_${formData.folio || new Date().toISOString().split('T')[0]}.pdf`
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      // Upload to client folder
      if (pdfBlob) {
        setIsUploading(true)
        try {
          await uploadCertificateToClient(pdfBlob)
          toast({
            title: 'Certificado confirmado',
            description: 'El certificado se descargó y subió a la carpeta del cliente',
          })
        } catch (uploadError: any) {
          console.error('Error uploading certificate:', uploadError)
          toast({
            title: 'Certificado descargado',
            description: 'Se descargó correctamente pero no se pudo subir a la carpeta del cliente',
            variant: 'destructive',
          })
        } finally {
          setIsUploading(false)
        }
      }

      setOpen(false)
    } catch (error) {
      console.error('Error generating certificate:', error)
      toast({
        title: 'Error',
        description: 'No se pudo generar el certificado',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!isMandateSigned} className="gap-1.5">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Cert.</span> Desgravamen
                </Button>
              </DialogTrigger>
            </span>
          </TooltipTrigger>
          {!isMandateSigned && (
            <TooltipContent>
              <p>El mandato debe estar firmado</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {step === 'form' ? 'Certificado de Cobertura' : 'Previsualización del Certificado'}
            {isBancoChileRefund && (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                Banco de Chile
              </Badge>
            )}
            {isChevroletSf && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                Chevrolet SF
              </Badge>
            )}
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
              Póliza 347
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 overflow-auto pr-4">
          {step === 'form' ? (
            // ========== FORMULARIO ==========
            <div className="space-y-4 py-2">
              {/* Sección: Datos del Asegurado */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-primary" />
                  Datos del Asegurado (desde solicitud)
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Nombre</span>
                      <p className="font-medium truncate">{refund.fullName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">RUT</span>
                      <p className="font-medium">{refund.rut}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Email</span>
                      <p className="font-medium truncate">{refund.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Teléfono</span>
                      <p className="font-medium">{refund.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Fecha Nacimiento</span>
                      <p className="font-medium">{formatDate(refund.calculationSnapshot?.birthDate)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Edad</span>
                      <p className="font-medium">{refund.calculationSnapshot?.age || 'N/A'} años</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Monto Crédito</span>
                      <p className="font-medium">${(refund.calculationSnapshot?.confirmedAverageInsuredBalance || refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || 0).toLocaleString('es-CL')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Cuotas Pendientes</span>
                      <p className="font-medium">{refund.calculationSnapshot?.confirmedRemainingInstallments || refund.calculationSnapshot?.remainingInstallments || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección: Datos del Certificado */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Datos del Certificado
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Folio <span className="text-destructive">*</span></Label>
                    {isAssigningFolio ? (
                      <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Asignando...</span>
                      </div>
                    ) : formData.folio ? (
                      <div className="flex items-center gap-1.5 h-9 px-3 border rounded-md bg-muted">
                        <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium flex-1">{formData.folio}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => {
                                  if (window.confirm(`¿Reasignar un nuevo folio?\n\nEl folio actual (${formData.folio}) será reemplazado por uno nuevo. Esta acción no se puede deshacer.`)) {
                                    setFormData(prev => ({ ...prev, folio: '' }))
                                    assignFolio(true)
                                  }
                                }}
                              >
                                <RefreshCw className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Reasignar nuevo folio</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-9 gap-1.5 text-xs border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => assignFolio()}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Reintentar asignar folio
                        </Button>
                        {folioError && (
                          <p className="text-[10px] text-destructive">{folioError}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nro. Operación</Label>
                    <Input
                      value={formData.nroOperacion}
                      onChange={(e) => handleChange('nroOperacion', e.target.value)}
                      placeholder="N° operación"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Saldo Insoluto</Label>
                    <Input
                      value={formData.saldoInsoluto ? Number(formData.saldoInsoluto).toLocaleString('es-CL') : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                        handleChange('saldoInsoluto', value)
                      }}
                      placeholder="Monto"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha Inicio</Label>
                    <Input
                      value={formData.fechaInicioCredito}
                      onChange={(e) => handleChange('fechaInicioCredito', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha Fin</Label>
                    <Input
                      value={formData.fechaFinCredito}
                      onChange={(e) => handleChange('fechaFinCredito', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Beneficiario Irrevocable (Banco de Chile / Chevrolet SF) */}
              {usesChileTemplate && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-primary" />
                    Beneficiario Irrevocable ({isBancoChileRefund ? 'Banco de Chile' : 'Chevrolet SF'})
                  </div>
                  <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/30 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nombre del Beneficiario</Label>
                        <Input
                          value={formData.beneficiarioNombre}
                          onChange={(e) => handleChange('beneficiarioNombre', e.target.value)}
                          placeholder="Nombre completo del beneficiario"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">RUT del Beneficiario</Label>
                        <Input
                          value={formData.beneficiarioRut}
                          onChange={(e) => handleChange('beneficiarioRut', e.target.value)}
                          placeholder="12.345.678-9"
                          className={`h-9 ${rutError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        {rutError && (
                          <div className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            <span>{rutError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este beneficiario aparecerá como beneficiario irrevocable en el certificado de cobertura.
                    </p>
                  </div>
                </div>
              )}

              {/* Sección: Datos Personales (con búsqueda RUT) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    Datos Personales del Cliente
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchRutInfo}
                    disabled={isLoadingRut}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {isLoadingRut ? 'Buscando...' : 'Buscar Información'}
                  </Button>
                </div>
                
                <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-2">
                  {/* Fila 1: Dirección completa */}
                  <div className="grid grid-cols-12 gap-2">
                    <div className="space-y-1.5 col-span-7">
                      <Label className="text-xs">Dirección</Label>
                      <Input
                        value={formData.direccion}
                        onChange={(e) => handleChange('direccion', e.target.value)}
                        placeholder="Calle o avenida"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Número</Label>
                      <Input
                        value={formData.numero}
                        onChange={(e) => handleChange('numero', e.target.value)}
                        placeholder="N°"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-3">
                      <Label className="text-xs">Depto/Block</Label>
                      <Input
                        value={formData.depto}
                        onChange={(e) => handleChange('depto', e.target.value)}
                        placeholder="Depto"
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Fila 2: Ciudad, Comuna, Celular, Sexo, Autoriza email */}
                  <div className="grid grid-cols-5 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ciudad</Label>
                      <Input
                        value={formData.ciudad}
                        onChange={(e) => handleChange('ciudad', e.target.value)}
                        placeholder="Ciudad"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Comuna</Label>
                      <Input
                        value={formData.comuna}
                        onChange={(e) => handleChange('comuna', e.target.value)}
                        placeholder="Comuna"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Celular</Label>
                      <Input
                        value={formData.celular}
                        onChange={(e) => handleChange('celular', e.target.value)}
                        placeholder="+56 9..."
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sexo</Label>
                      <Select value={formData.sexo} onValueChange={(v) => handleChange('sexo', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Autoriza email</Label>
                      <Select value={formData.autorizaEmail} onValueChange={(v) => handleChange('autorizaEmail', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SI">Sí</SelectItem>
                          <SelectItem value="NO">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prima calculada */}
              <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Única del Seguro (calculada):</span>
                  <span className="text-lg font-bold text-primary">${calculatePrimaUnica().toLocaleString('es-CL')} CLP</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Fórmula: Saldo insoluto × TBM × Nper
                </p>
                <p className="text-xs text-muted-foreground">
                  ${getSaldoInsolutoValue().toLocaleString('es-CL')} × {getTbmForDisplay().toFixed(4)} por mil × {refund.calculationSnapshot?.confirmedRemainingInstallments || refund.calculationSnapshot?.remainingInstallments || 0} cuotas
                </p>
              </div>
            </div>
          ) : (
            // ========== PREVISUALIZACIÓN ==========
            <div className="space-y-4 py-2">
              {/* Resumen del Asegurado */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <User className="h-4 w-4" />
                  Datos del Asegurado
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nombre:</span>
                      <span className="font-medium">{refund.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RUT:</span>
                      <span className="font-medium">{refund.rut}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{refund.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha Nacimiento:</span>
                      <span className="font-medium">{formatDate(refund.calculationSnapshot?.birthDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Edad:</span>
                      <span className="font-medium">{refund.calculationSnapshot?.age} años</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sexo:</span>
                      <span className="font-medium">{formData.sexo === 'M' ? 'Masculino' : formData.sexo === 'F' ? 'Femenino' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen Dirección */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">Dirección completa:</span>
                      <span className="font-medium">
                        {formData.direccion || 'N/A'} {formData.numero && `N° ${formData.numero}`} {formData.depto && `Depto ${formData.depto}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ciudad:</span>
                      <span className="font-medium">{formData.ciudad || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comuna:</span>
                      <span className="font-medium">{formData.comuna || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Celular:</span>
                      <span className="font-medium">{formData.celular || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Autoriza email:</span>
                      <span className="font-medium">{formData.autorizaEmail === 'SI' ? 'Sí' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen del Certificado */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <CreditCard className="h-4 w-4" />
                  Datos del Certificado
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Folio:</span>
                      <span className="font-medium">{formData.folio || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nro. Operación:</span>
                      <span className="font-medium">{formData.nroOperacion || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha Inicio Crédito:</span>
                      <span className="font-medium">{formData.fechaInicioCredito || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha Fin Crédito:</span>
                      <span className="font-medium">{formData.fechaFinCredito || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo Insoluto:</span>
                      <span className="font-medium">${getSaldoInsolutoValue().toLocaleString('es-CL')} CLP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto Crédito:</span>
                      <span className="font-medium">${(refund.calculationSnapshot?.confirmedAverageInsuredBalance || refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || 0).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plazo (meses):</span>
                      <span className="font-medium">{refund.calculationSnapshot?.confirmedOriginalInstallments || refund.calculationSnapshot?.originalInstallments || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen del Beneficiario Irrevocable (Banco de Chile / Chevrolet SF) */}
              {usesChileTemplate && (formData.beneficiarioNombre || formData.beneficiarioRut) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                    <User className="h-4 w-4" />
                    Beneficiario Irrevocable
                  </div>
                  <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nombre:</span>
                        <span className="font-medium">{formData.beneficiarioNombre || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">RUT:</span>
                        <span className="font-medium">{formData.beneficiarioRut || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Prima calculada destacada */}
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Única del Seguro:</span>
                  <span className="text-xl font-bold text-primary">${calculatePrimaUnica().toLocaleString('es-CL')} CLP</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Fórmula: Saldo insoluto × TBM × Nper
                </p>
                <p className="text-xs text-muted-foreground">
                  ${(refund.calculationSnapshot?.confirmedAverageInsuredBalance || refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || 0).toLocaleString('es-CL')} × {getTbmForDisplay().toFixed(4)} por mil × {refund.calculationSnapshot?.confirmedRemainingInstallments || refund.calculationSnapshot?.remainingInstallments || 0} cuotas
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-3 border-t mt-2">
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        onClick={handlePreview} 
                        className="gap-2" 
                        disabled={!formData.folio || isAssigningFolio}
                      >
                        <Eye className="h-4 w-4" />
                        Previsualizar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {(!formData.folio || isAssigningFolio) && (
                    <TooltipContent>
                      {isAssigningFolio ? 'Asignando folio...' : 'Se requiere un folio asignado para previsualizar'}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBackToEdit} disabled={isGenerating || isUploading} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a Editar
              </Button>
              <Button onClick={generatePDF} disabled={isGenerating || isUploading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar y Descargar
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
