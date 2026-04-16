// Format date to locale string
export const formatDate = (dateStr: string | Date) => {
  try {
    // For string dates, try to extract date parts directly to avoid timezone shift
    if (typeof dateStr === 'string') {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`;
      }
    }
    
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    
    if (isNaN(date.getTime())) {
      console.error("Invalid date input:", dateStr);
      return "Fecha inválida";
    }
    
    return date.toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Fecha inválida";
  }
};

// Format currency
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { 
    style: 'currency', 
    currency: 'CLP',
    maximumFractionDigits: 0 
  }).format(amount);
};

// Format a number with dot separators, preserving any decimal precision already present.
// This is used because some snapshot values arrive as decimals like 8.988, 4.416 or 219.456,
// and we only want to display them with dots instead of commas — never round them.
export const formatCLPNumber = (amount: number | string): string => {
  if (amount === null || amount === undefined || amount === '') return '0'

  const raw = String(amount).trim().replace(',', '.')
  if (raw === '' || Number.isNaN(Number(raw))) return '0'

  const sign = raw.startsWith('-') ? '-' : ''
  const normalized = sign ? raw.slice(1) : raw
  const [integerPartRaw, decimalPartRaw] = normalized.split('.')

  const integerDigits = (integerPartRaw || '0').replace(/\D/g, '') || '0'
  const groupedInteger = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimalDigits = decimalPartRaw?.replace(/\D/g, '') ?? ''

  return `${sign}${groupedInteger}${decimalDigits ? `.${decimalDigits}` : ''}`
};

// Calculate age from birth date
export const calcularEdad = (fechaNacimiento: Date): number => {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
    edad--;
  }
  return edad;
};
