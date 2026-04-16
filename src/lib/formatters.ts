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

// Format a number with Chilean thousands separator (dot), without currency symbol.
// Uses manual formatting to guarantee dot-separator regardless of the runtime
// ICU locale data (some environments don't apply grouping for 'es-CL').
export const formatCLPNumber = (amount: number): string => {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const rounded = Math.round(safe);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  // Insert a dot every 3 digits from the right
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${withDots}`;
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
