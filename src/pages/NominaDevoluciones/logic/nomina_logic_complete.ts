export interface NominaHeaderInput {
  nombreEmpresa: string;
  rutEmpresa: string;
  convenio: string;
  /** YYYY-MM-DD. Si no viene, usa la fecha actual del sistema. */
  fechaProceso?: string;
}

export interface NominaRowInput {
  rutProveedor: string;
  nombreProveedor: string;
  bancoProveedor: string;
  cuentaProveedor: string;
  tipoDocumento: string;
  numeroDocumento: string;
  monto: number;
  formaPago: string;
  codigoSucursal?: string;
  emailAviso?: string;
  mensajeAviso?: string;
}

export interface BancoCatalogItem {
  name: string;
  sbifCode: string;
}

export interface FormaPagoCatalogItem {
  name: string;
  code: string;
}

export interface TipoDocumentoCatalogItem {
  name: string;
  code: string;
}

export interface NominaCatalogs {
  bancos: BancoCatalogItem[];
  formasPago: FormaPagoCatalogItem[];
  tiposDocumento: TipoDocumentoCatalogItem[];
}

export interface NominaGenerationInput {
  header: NominaHeaderInput;
  rows: NominaRowInput[];
  catalogs: NominaCatalogs;
  /** false = normal, true = agrupado */
  grouped?: boolean;
}

export interface ValidationError {
  scope: 'header' | 'row' | 'system';
  field: string;
  message: string;
  rowIndex?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface NormalizedNominaHeader {
  nombreEmpresa: string;
  rutEmpresa: string;
  convenio: string;
  fechaProceso: string; // YYYY-MM-DD
}

export interface NormalizedNominaRow {
  rutProveedor: string;
  nombreProveedor: string;
  bancoProveedor: string;
  bancoSbifCode: string;
  cuentaProveedor: string;
  tipoDocumento: string;
  tipoDocumentoCode: string;
  numeroDocumento: string;
  monto: number;
  formaPago: string;
  formaPagoCode: string;
  codigoSucursal: string;
  emailAviso: string;
  mensajeAviso: string;
}

export interface GroupedNominaRow {
  key: string;
  headerRow: NormalizedNominaRow;
  detailRows: NormalizedNominaRow[];
  totalMontoLinea10: number;
  mensajeLinea10: string;
}

export interface GeneratedTxtResult {
  fileName: string;
  content: string;
  lineCount: number;
  totalAmount: number;
  mode: 'normal' | 'grouped';
  normalizedHeader: NormalizedNominaHeader;
  normalizedRows: NormalizedNominaRow[];
  groupedRows?: GroupedNominaRow[];
}

const SCOTIA_BANK = 'SCOTIABANK CHILE';
const FORMA_OTRO_BANCO = 'CUENTA OTRO BANCO';
const VALE_VISTA_FISICO = 'VALE VISTA FISICO';
const VALE_VISTA_VIRTUAL = 'VALE VISTA VIRTUAL';
const TIPO_NOTA_CREDITO = 'NOTA DE CREDITO';
const TXT_LINE_LENGTH = 263;
const HEADER_LITERAL = '2500N';

export const DEFAULT_NOMINA_CATALOGS: NominaCatalogs = {
  bancos: [
    { name: 'SCOTIABANK CHILE', sbifCode: '014' },
    { name: 'BANCO DE CHILE', sbifCode: '001' },
    { name: 'BANCO ESTADO', sbifCode: '012' },
    { name: 'BCI', sbifCode: '016' },
    { name: 'BANCO SANTANDER', sbifCode: '037' },
    { name: 'BANCO ITAU', sbifCode: '039' },
    { name: 'BANCO SECURITY', sbifCode: '049' },
    { name: 'BANCO BICE', sbifCode: '028' },
    { name: 'BANCO FALABELLA', sbifCode: '051' },
    { name: 'BANCO RIPLEY', sbifCode: '053' },
    { name: 'BANCO CONSORCIO', sbifCode: '055' },
    { name: 'BANCO INTERNACIONAL', sbifCode: '009' },
    { name: 'COOPEUCH', sbifCode: '672' },
  ],
  formasPago: [
    { name: 'CUENTA OTRO BANCO', code: 'OB' },
    { name: 'CTACTE SCOTIABANK', code: 'CC' },
    { name: 'CTA RENTA SCOTIABANK', code: 'CA' },
    { name: 'CTA VISTA SCOTIABANK', code: 'VI' },
    { name: 'CTA AHORRO SCOTIABANK', code: 'AH' },
    { name: 'VALE VISTA FISICO', code: 'VV' },
    { name: 'VALE VISTA VIRTUAL', code: 'VX' },
  ],
  tiposDocumento: [
    { name: 'FACTURA', code: 'FA' },
    { name: 'NOTA DE CREDITO', code: 'NC' },
    { name: 'HONORARIO', code: 'HO' },
    { name: 'VARIOS', code: 'VA' },
  ],
};

interface CatalogLookup {
  bancosByName: Map<string, BancoCatalogItem>;
  bancosByCode: Map<string, BancoCatalogItem>;
  formasPagoByName: Map<string, FormaPagoCatalogItem>;
  formasPagoByCode: Map<string, FormaPagoCatalogItem>;
  tiposDocumentoByName: Map<string, TipoDocumentoCatalogItem>;
  tiposDocumentoByCode: Map<string, TipoDocumentoCatalogItem>;
}

export function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function normalizeFreeText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEmail(value: string | null | undefined): string {
  return normalizeFreeText(value).toLowerCase();
}

export function normalizeRut(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();
}

export function formatRutWithHyphen(value: string | number | null | undefined): string {
  const clean = normalizeRut(value);
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

/**
 * Formato del TXT: 9 dígitos de cuerpo + DV = 10 caracteres.
 */
export function formatRut10(value: string | number | null | undefined): string {
  const clean = normalizeRut(value);
  if (clean.length < 2) {
    throw new Error(`RUT inválido: ${value ?? ''}`);
  }

  const body = clean.slice(0, -1).replace(/\D/g, '');
  const dv = clean.slice(-1).toUpperCase();
  return `${body.padStart(9, '0').slice(-9)}${dv}`;
}

export function validateChileanRut(value: string | number | null | undefined): boolean {
  const clean = normalizeRut(value);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();

  if (!/^\d+$/.test(body)) return false;
  if (!/^([0-9]|K)$/.test(dv)) return false;

  let factor = 2;
  let sum = 0;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  return dv === expectedDv;
}

export function padRight(value: string, length: number, char = ' '): string {
  const clean = String(value ?? '');
  if (clean.length >= length) return clean.slice(0, length);
  return clean + char.repeat(length - clean.length);
}

export function padLeft(value: string, length: number, char = '0'): string {
  const clean = String(value ?? '');
  if (clean.length >= length) return clean.slice(-length);
  return char.repeat(length - clean.length) + clean;
}

export function digitsOnly(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function formatNumericField(value: string | number | null | undefined, length: number): string {
  return padLeft(digitsOnly(value), length, '0');
}

export function formatAmount12(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Monto inválido: ${value}`);
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    throw new Error(`Monto negativo no permitido en exportación: ${value}`);
  }

  return padLeft(String(rounded), 12, '0');
}

export function toYyyyMmDd(dateInput?: string): string {
  if (!dateInput) {
    return new Date().toISOString().slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    throw new Error(`Fecha inválida, se esperaba YYYY-MM-DD: ${dateInput}`);
  }

  return dateInput;
}

export function toYyyyMmDdCompact(dateInput?: string): string {
  return toYyyyMmDd(dateInput).replace(/-/g, '');
}

function buildCatalogLookup(catalogs: NominaCatalogs): CatalogLookup {
  const bancosByName = new Map<string, BancoCatalogItem>();
  const bancosByCode = new Map<string, BancoCatalogItem>();
  const formasPagoByName = new Map<string, FormaPagoCatalogItem>();
  const formasPagoByCode = new Map<string, FormaPagoCatalogItem>();
  const tiposDocumentoByName = new Map<string, TipoDocumentoCatalogItem>();
  const tiposDocumentoByCode = new Map<string, TipoDocumentoCatalogItem>();

  for (const item of catalogs.bancos) {
    const name = normalizeText(item.name);
    const code = formatNumericField(item.sbifCode, 3);
    bancosByName.set(name, { ...item, name, sbifCode: code });
    bancosByCode.set(code, { ...item, name, sbifCode: code });
  }

  for (const item of catalogs.formasPago) {
    const name = normalizeText(item.name);
    const code = normalizeText(item.code).slice(0, 2);
    formasPagoByName.set(name, { ...item, name, code });
    formasPagoByCode.set(code, { ...item, name, code });
  }

  for (const item of catalogs.tiposDocumento) {
    const name = normalizeText(item.name);
    const code = normalizeText(item.code).slice(0, 2);
    tiposDocumentoByName.set(name, { ...item, name, code });
    tiposDocumentoByCode.set(code, { ...item, name, code });
  }

  return {
    bancosByName,
    bancosByCode,
    formasPagoByName,
    formasPagoByCode,
    tiposDocumentoByName,
    tiposDocumentoByCode,
  };
}

function resolveBanco(input: string, lookup: CatalogLookup): BancoCatalogItem | null {
  const normalized = normalizeText(input);
  return lookup.bancosByName.get(normalized) ?? lookup.bancosByCode.get(formatNumericField(normalized, 3)) ?? null;
}

function resolveFormaPago(input: string, lookup: CatalogLookup): FormaPagoCatalogItem | null {
  const normalized = normalizeText(input);
  return lookup.formasPagoByName.get(normalized) ?? lookup.formasPagoByCode.get(normalized.slice(0, 2)) ?? null;
}

function resolveTipoDocumento(input: string, lookup: CatalogLookup): TipoDocumentoCatalogItem | null {
  const normalized = normalizeText(input);
  return lookup.tiposDocumentoByName.get(normalized) ?? lookup.tiposDocumentoByCode.get(normalized.slice(0, 2)) ?? null;
}

export function validateNominaHeader(header: NominaHeaderInput): ValidationResult {
  const errors: ValidationError[] = [];

  if (!normalizeFreeText(header.nombreEmpresa)) {
    errors.push({ scope: 'header', field: 'nombreEmpresa', message: 'El nombre de empresa es obligatorio.' });
  }

  if (!normalizeFreeText(header.rutEmpresa)) {
    errors.push({ scope: 'header', field: 'rutEmpresa', message: 'El RUT de empresa es obligatorio.' });
  } else if (!validateChileanRut(header.rutEmpresa)) {
    errors.push({ scope: 'header', field: 'rutEmpresa', message: 'El RUT de empresa no es válido.' });
  }

  if (!normalizeFreeText(header.convenio)) {
    errors.push({ scope: 'header', field: 'convenio', message: 'El número de convenio es obligatorio.' });
  }

  if (header.fechaProceso && !/^\d{4}-\d{2}-\d{2}$/.test(header.fechaProceso)) {
    errors.push({
      scope: 'header',
      field: 'fechaProceso',
      message: 'La fecha debe estar en formato YYYY-MM-DD.',
    });
  }

  return { valid: errors.length === 0, errors };
}

export function validateNominaRows(rows: NominaRowInput[], catalogs: NominaCatalogs): ValidationResult {
  const errors: ValidationError[] = [];
  const lookup = buildCatalogLookup(catalogs);

  if (!rows.length) {
    errors.push({ scope: 'system', field: 'rows', message: 'Debes ingresar al menos una fila para generar la nómina.' });
    return { valid: false, errors };
  }

  rows.forEach((row, index) => {
    const rowIndex = index;

    if (!normalizeFreeText(row.rutProveedor)) {
      errors.push({ scope: 'row', rowIndex, field: 'rutProveedor', message: 'El RUT proveedor es obligatorio.' });
    } else if (!validateChileanRut(row.rutProveedor)) {
      errors.push({ scope: 'row', rowIndex, field: 'rutProveedor', message: 'El RUT proveedor no es válido.' });
    }

    if (!normalizeFreeText(row.nombreProveedor)) {
      errors.push({ scope: 'row', rowIndex, field: 'nombreProveedor', message: 'El nombre proveedor es obligatorio.' });
    }

    if (!normalizeFreeText(row.bancoProveedor)) {
      errors.push({ scope: 'row', rowIndex, field: 'bancoProveedor', message: 'El banco proveedor es obligatorio.' });
    } else if (!resolveBanco(row.bancoProveedor, lookup)) {
      errors.push({ scope: 'row', rowIndex, field: 'bancoProveedor', message: 'El banco proveedor no existe en el catálogo.' });
    }

    if (!normalizeFreeText(row.cuentaProveedor)) {
      errors.push({ scope: 'row', rowIndex, field: 'cuentaProveedor', message: 'La cuenta proveedor es obligatoria.' });
    }

    if (!normalizeFreeText(row.tipoDocumento)) {
      errors.push({ scope: 'row', rowIndex, field: 'tipoDocumento', message: 'El tipo de documento es obligatorio.' });
    } else if (!resolveTipoDocumento(row.tipoDocumento, lookup)) {
      errors.push({ scope: 'row', rowIndex, field: 'tipoDocumento', message: 'El tipo de documento no existe en el catálogo.' });
    }

    if (!normalizeFreeText(row.numeroDocumento)) {
      errors.push({ scope: 'row', rowIndex, field: 'numeroDocumento', message: 'El número de documento es obligatorio.' });
    }

    if (row.monto === null || row.monto === undefined || Number.isNaN(Number(row.monto))) {
      errors.push({ scope: 'row', rowIndex, field: 'monto', message: 'El monto es obligatorio.' });
    } else if (Number(row.monto) < 0) {
      errors.push({ scope: 'row', rowIndex, field: 'monto', message: 'El monto no puede ser negativo.' });
    }

    if (!normalizeFreeText(row.formaPago)) {
      errors.push({ scope: 'row', rowIndex, field: 'formaPago', message: 'La forma de pago es obligatoria.' });
    } else if (!resolveFormaPago(row.formaPago, lookup)) {
      errors.push({ scope: 'row', rowIndex, field: 'formaPago', message: 'La forma de pago no existe en el catálogo.' });
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateNominaInput(input: NominaGenerationInput): ValidationResult {
  const headerValidation = validateNominaHeader(input.header);
  const rowValidation = validateNominaRows(input.rows, input.catalogs);
  const errors = [...headerValidation.errors, ...rowValidation.errors];
  return { valid: errors.length === 0, errors };
}

export function normalizeNominaHeader(header: NominaHeaderInput): NormalizedNominaHeader {
  return {
    nombreEmpresa: normalizeText(header.nombreEmpresa),
    rutEmpresa: normalizeRut(header.rutEmpresa),
    convenio: formatNumericField(header.convenio, 3),
    fechaProceso: toYyyyMmDd(header.fechaProceso),
  };
}

export function applyBusinessRules(
  row: Omit<NormalizedNominaRow, 'bancoSbifCode' | 'formaPagoCode' | 'tipoDocumentoCode'>,
  catalogs: NominaCatalogs,
): NormalizedNominaRow {
  const lookup = buildCatalogLookup(catalogs);

  let bancoProveedor = normalizeText(row.bancoProveedor);
  let formaPago = normalizeText(row.formaPago);
  let cuentaProveedor = normalizeFreeText(row.cuentaProveedor);
  const tipoDocumento = normalizeText(row.tipoDocumento);

  if (formaPago === VALE_VISTA_FISICO || formaPago === VALE_VISTA_VIRTUAL) {
    bancoProveedor = SCOTIA_BANK;
    cuentaProveedor = '0';
  }

  if (bancoProveedor !== SCOTIA_BANK && formaPago !== FORMA_OTRO_BANCO) {
    formaPago = FORMA_OTRO_BANCO;
  }

  const banco = resolveBanco(bancoProveedor, lookup);
  const formaPagoResolved = resolveFormaPago(formaPago, lookup);
  const tipoDocumentoResolved = resolveTipoDocumento(tipoDocumento, lookup);

  if (!banco) throw new Error(`Banco no válido: ${bancoProveedor}`);
  if (!formaPagoResolved) throw new Error(`Forma de pago no válida: ${formaPago}`);
  if (!tipoDocumentoResolved) throw new Error(`Tipo de documento no válido: ${tipoDocumento}`);

  return {
    rutProveedor: normalizeRut(row.rutProveedor),
    nombreProveedor: normalizeText(row.nombreProveedor),
    bancoProveedor: banco.name,
    bancoSbifCode: banco.sbifCode,
    cuentaProveedor,
    tipoDocumento: tipoDocumentoResolved.name,
    tipoDocumentoCode: tipoDocumentoResolved.code,
    numeroDocumento: normalizeFreeText(row.numeroDocumento),
    monto: Math.round(Number(row.monto)),
    formaPago: formaPagoResolved.name,
    formaPagoCode: formaPagoResolved.code,
    codigoSucursal: formatNumericField(row.codigoSucursal || '000', 3),
    emailAviso: normalizeEmail(row.emailAviso),
    mensajeAviso: normalizeFreeText(row.mensajeAviso),
  };
}

export function normalizeNominaRows(rows: NominaRowInput[], catalogs: NominaCatalogs): NormalizedNominaRow[] {
  return rows.map((row) =>
    applyBusinessRules(
      {
        rutProveedor: row.rutProveedor,
        nombreProveedor: row.nombreProveedor,
        bancoProveedor: row.bancoProveedor,
        cuentaProveedor: row.cuentaProveedor,
        tipoDocumento: row.tipoDocumento,
        numeroDocumento: row.numeroDocumento,
        monto: Number(row.monto),
        formaPago: row.formaPago,
        codigoSucursal: row.codigoSucursal,
        emailAviso: row.emailAviso,
        mensajeAviso: row.mensajeAviso,
      },
      catalogs,
    ),
  );
}

/**
 * El Excel ordena por cuenta + tipo documento + número documento y luego agrupa para exportar.
 * Para replicar el comportamiento práctico del TXT, se genera una línea 10 por cuenta
 * y una línea 20 por cada documento asociado a esa cuenta.
 */
export function groupNominaRows(rows: NormalizedNominaRow[]): GroupedNominaRow[] {
  const sortedRows = [...rows].sort((a, b) => {
    const byCuenta = a.cuentaProveedor.localeCompare(b.cuentaProveedor);
    if (byCuenta !== 0) return byCuenta;

    const byTipo = a.tipoDocumento.localeCompare(b.tipoDocumento);
    if (byTipo !== 0) return byTipo;

    return a.numeroDocumento.localeCompare(b.numeroDocumento);
  });

  const groups = new Map<string, NormalizedNominaRow[]>();

  for (const row of sortedRows) {
    const key = row.cuentaProveedor;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(row);
  }

  return Array.from(groups.entries()).map(([key, detailRows]) => {
    const headerRow = detailRows[0];

    const totalMontoLinea10 = detailRows.reduce((acc, item) => {
      const sign = item.tipoDocumento === TIPO_NOTA_CREDITO ? -1 : 1;
      return acc + sign * item.monto;
    }, 0);

    if (totalMontoLinea10 < 0) {
      throw new Error(
        `La suma agrupada de la cuenta ${key} quedó negativa. Revisa las notas de crédito asociadas.`,
      );
    }

    const mensajeLinea10 = buildGroupedMessage(detailRows);

    return {
      key,
      headerRow,
      detailRows,
      totalMontoLinea10,
      mensajeLinea10,
    };
  });
}

function buildGroupedMessage(rows: NormalizedNominaRow[]): string {
  if (!rows.length) return '';

  const first = rows[0];
  const suffix = rows.slice(1).map((item) => `-${digitsOnly(item.numeroDocumento) || item.numeroDocumento}`).join('');
  return normalizeFreeText(`Pago ${first.tipoDocumento} ${first.numeroDocumento}${suffix}`);
}

function assertLineLength(line: string, lineType: string): string {
  if (line.length !== TXT_LINE_LENGTH) {
    throw new Error(`La línea ${lineType} no cumple largo ${TXT_LINE_LENGTH}. Largo real: ${line.length}`);
  }
  return line;
}

export function buildHeader00(header: NormalizedNominaHeader, totalAmount: number, lineCount: number): string {
  const fixed = [
    '00',
    formatRut10(header.rutEmpresa),
    formatNumericField(header.convenio, 3),
    toYyyyMmDdCompact(header.fechaProceso),
    formatNumericField(lineCount, 5),
    formatAmount12(totalAmount),
    HEADER_LITERAL,
  ].join('');

  return assertLineLength(padRight(fixed, TXT_LINE_LENGTH), '00');
}

export function buildLine10(row: NormalizedNominaRow, montoOverride?: number, mensajeOverride?: string): string {
  const fixed = [
    '10',
    formatRut10(row.rutProveedor),
    padRight(normalizeText(row.nombreProveedor), 40),
    ' '.repeat(94),
    padRight(normalizeEmail(row.emailAviso), 40),
    padRight(row.formaPagoCode, 2),
    formatNumericField(row.cuentaProveedor, 16),
    formatNumericField(row.bancoSbifCode, 3),
    formatNumericField(row.codigoSucursal || '000', 3),
    formatAmount12(montoOverride ?? row.monto),
    padRight(normalizeFreeText(mensajeOverride ?? row.mensajeAviso), 40),
    'S',
  ].join('');

  return assertLineLength(fixed, '10');
}

export function buildLine20(row: NormalizedNominaRow, montoOverride?: number, mensajeOverride?: string): string {
  const fixed = [
    '20',
    padRight(row.tipoDocumentoCode, 2),
    formatNumericField(row.numeroDocumento, 12),
    formatRut10(row.rutProveedor),
    padRight(normalizeText(row.nombreProveedor), 40),
    padRight(normalizeFreeText(mensajeOverride ?? row.mensajeAviso), 40),
    formatAmount12(montoOverride ?? row.monto),
    ' '.repeat(145),
  ].join('');

  return assertLineLength(fixed, '20');
}

export function generateNominaTxt(input: NominaGenerationInput): GeneratedTxtResult {
  const validation = validateNominaInput(input);
  if (!validation.valid) {
    const firstError = validation.errors[0];
    throw new Error(firstError?.message || 'La nómina contiene errores de validación.');
  }

  const normalizedHeader = normalizeNominaHeader(input.header);
  const normalizedRows = normalizeNominaRows(input.rows, input.catalogs);

  if (input.grouped) {
    const groupedRows = groupNominaRows(normalizedRows);
    const totalAmount = groupedRows.reduce((acc, group) => acc + group.totalMontoLinea10, 0);
    const lineCount = 1 + groupedRows.length + normalizedRows.length;

    const lines = [buildHeader00(normalizedHeader, totalAmount, lineCount)];

    for (const group of groupedRows) {
      lines.push(buildLine10(group.headerRow, group.totalMontoLinea10, group.mensajeLinea10));
      for (const row of group.detailRows) {
        lines.push(buildLine20(row, row.monto, row.mensajeAviso));
      }
    }

    const content = lines.join('\r\n');
    return {
      fileName: buildFileName(normalizedHeader, 'grouped'),
      content,
      lineCount: lines.length,
      totalAmount,
      mode: 'grouped',
      normalizedHeader,
      normalizedRows,
      groupedRows,
    };
  }

  const totalAmount = normalizedRows.reduce((acc, row) => acc + row.monto, 0);
  const lineCount = 1 + normalizedRows.length * 2;
  const lines = [buildHeader00(normalizedHeader, totalAmount, lineCount)];

  for (const row of normalizedRows) {
    lines.push(buildLine10(row));
    lines.push(buildLine20(row));
  }

  const content = lines.join('\r\n');
  return {
    fileName: buildFileName(normalizedHeader, 'normal'),
    content,
    lineCount: lines.length,
    totalAmount,
    mode: 'normal',
    normalizedHeader,
    normalizedRows,
  };
}

export function buildFileName(header: NormalizedNominaHeader, mode: 'normal' | 'grouped'): string {
  const date = header.fechaProceso.replace(/-/g, '');
  const suffix = mode === 'grouped' ? 'agrupada' : 'normal';
  return `nomina_${header.convenio}_${date}_${suffix}.txt`;
}

export function downloadTxtFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export function generateAndDownloadNominaTxt(input: NominaGenerationInput): GeneratedTxtResult {
  const result = generateNominaTxt(input);
  downloadTxtFile(result.fileName, result.content);
  return result;
}

export const MOCK_NOMINA_INPUT: NominaGenerationInput = {
  header: {
    nombreEmpresa: 'TDV SERVICIOS SPA',
    rutEmpresa: '78168126-1',
    convenio: '123',
    fechaProceso: '2026-02-27',
  },
  rows: [
    {
      rutProveedor: '11111111-1',
      nombreProveedor: 'Proveedor Scotia',
      bancoProveedor: 'SCOTIABANK CHILE',
      cuentaProveedor: '123456789',
      tipoDocumento: 'FACTURA',
      numeroDocumento: '1001',
      monto: 150000,
      formaPago: 'CTACTE SCOTIABANK',
      codigoSucursal: '000',
      emailAviso: 'proveedor1@correo.cl',
      mensajeAviso: 'PAGO DEVOLUCION',
    },
    {
      rutProveedor: '22222222-2',
      nombreProveedor: 'Proveedor Otro Banco',
      bancoProveedor: 'BANCO DE CHILE',
      cuentaProveedor: '99887766',
      tipoDocumento: 'FACTURA',
      numeroDocumento: '1002',
      monto: 200000,
      formaPago: 'CUENTA OTRO BANCO',
      codigoSucursal: '000',
      emailAviso: 'proveedor2@correo.cl',
      mensajeAviso: 'PAGO DEVOLUCION',
    },
    {
      rutProveedor: '33333333-3',
      nombreProveedor: 'Proveedor Vale Vista',
      bancoProveedor: 'SCOTIABANK CHILE',
      cuentaProveedor: '0',
      tipoDocumento: 'FACTURA',
      numeroDocumento: '1003',
      monto: 50000,
      formaPago: 'VALE VISTA FISICO',
      codigoSucursal: '000',
      emailAviso: 'proveedor3@correo.cl',
      mensajeAviso: 'PAGO DEVOLUCION',
    },
    {
      rutProveedor: '22222222-2',
      nombreProveedor: 'Proveedor Otro Banco',
      bancoProveedor: 'BANCO DE CHILE',
      cuentaProveedor: '99887766',
      tipoDocumento: 'NOTA DE CREDITO',
      numeroDocumento: '2001',
      monto: 10000,
      formaPago: 'CUENTA OTRO BANCO',
      codigoSucursal: '000',
      emailAviso: 'proveedor2@correo.cl',
      mensajeAviso: 'AJUSTE DEVOLUCION',
    },
  ],
  catalogs: DEFAULT_NOMINA_CATALOGS,
  grouped: false,
};
