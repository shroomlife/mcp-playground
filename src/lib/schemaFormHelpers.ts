export type FieldKind =
  | 'string'
  | 'string-enum'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'string-array'
  | 'json'

export interface FieldMeta {
  name: string
  kind: FieldKind
  required: boolean
  description?: string
  title?: string
  default?: unknown
  enum?: string[]
  format?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  // For json fallback, carry the original schema subtree for hinting
  raw?: unknown
}

export interface SchemaAnalysis {
  fields: FieldMeta[]
  hasProperties: boolean
  usable: boolean
}

interface RawSchema {
  type?: string | string[]
  properties?: Record<string, RawSchema>
  required?: string[]
  enum?: unknown[]
  default?: unknown
  description?: string
  title?: string
  format?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  items?: RawSchema
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function asRawSchema(val: unknown): RawSchema | null {
  return isObject(val) ? (val as RawSchema) : null
}

function pickPrimitiveType(type: string | string[] | undefined): string | undefined {
  if (!type) return undefined
  if (typeof type === 'string') return type
  return type.find((t) => t !== 'null')
}

function classifyField(name: string, schema: RawSchema, required: boolean): FieldMeta {
  const base: FieldMeta = {
    name,
    kind: 'json',
    required,
    description: schema.description,
    title: schema.title,
    default: schema.default,
    raw: schema,
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0 && schema.enum.every((v) => typeof v === 'string')) {
    return {
      ...base,
      kind: 'string-enum',
      enum: schema.enum as string[],
    }
  }

  const type = pickPrimitiveType(schema.type)

  if (type === 'string') {
    return {
      ...base,
      kind: 'string',
      format: schema.format,
      minLength: schema.minLength,
      maxLength: schema.maxLength,
    }
  }
  if (type === 'number') {
    return {
      ...base,
      kind: 'number',
      minimum: schema.minimum,
      maximum: schema.maximum,
    }
  }
  if (type === 'integer') {
    return {
      ...base,
      kind: 'integer',
      minimum: schema.minimum,
      maximum: schema.maximum,
    }
  }
  if (type === 'boolean') {
    return { ...base, kind: 'boolean' }
  }
  if (type === 'array' && schema.items) {
    const itemsType = pickPrimitiveType(schema.items.type)
    if (itemsType === 'string') {
      return { ...base, kind: 'string-array' }
    }
  }
  return base
}

export function analyzeSchema(schema: unknown): SchemaAnalysis {
  const raw = asRawSchema(schema)
  if (!raw || !raw.properties) {
    return { fields: [], hasProperties: false, usable: true }
  }
  const required = new Set(Array.isArray(raw.required) ? raw.required : [])
  const fields: FieldMeta[] = []
  for (const [name, propSchema] of Object.entries(raw.properties)) {
    const sub = asRawSchema(propSchema)
    if (!sub) continue
    fields.push(classifyField(name, sub, required.has(name)))
  }
  return { fields, hasProperties: true, usable: true }
}

export function getDefaultArgs(schema: unknown): Record<string, unknown> {
  const analysis = analyzeSchema(schema)
  const args: Record<string, unknown> = {}
  for (const field of analysis.fields) {
    if (field.default !== undefined) {
      args[field.name] = field.default
      continue
    }
    if (!field.required) continue
    switch (field.kind) {
      case 'string':
      case 'string-enum':
        args[field.name] = field.enum?.[0] ?? ''
        break
      case 'number':
      case 'integer':
        args[field.name] = 0
        break
      case 'boolean':
        args[field.name] = false
        break
      case 'string-array':
        args[field.name] = []
        break
      case 'json':
        // leave unset — user must provide
        break
    }
  }
  return args
}

export interface ValidationError {
  field: string
  message: string
}

export function validateArgs(
  analysis: SchemaAnalysis,
  args: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = []
  for (const field of analysis.fields) {
    const value = args[field.name]
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0 && field.kind === 'string-array')

    if (field.required && isEmpty) {
      errors.push({ field: field.name, message: 'Pflichtfeld' })
      continue
    }

    if (isEmpty) continue

    switch (field.kind) {
      case 'string':
      case 'string-enum':
        if (typeof value !== 'string') {
          errors.push({ field: field.name, message: 'muss Text sein' })
        } else if (field.enum && !field.enum.includes(value)) {
          errors.push({ field: field.name, message: 'nicht in erlaubten Werten' })
        } else if (field.minLength !== undefined && value.length < field.minLength) {
          errors.push({ field: field.name, message: `mindestens ${field.minLength} Zeichen` })
        } else if (field.maxLength !== undefined && value.length > field.maxLength) {
          errors.push({ field: field.name, message: `höchstens ${field.maxLength} Zeichen` })
        }
        break
      case 'number':
      case 'integer': {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push({ field: field.name, message: 'muss Zahl sein' })
        } else {
          if (field.kind === 'integer' && !Number.isInteger(value)) {
            errors.push({ field: field.name, message: 'muss Ganzzahl sein' })
          }
          if (field.minimum !== undefined && value < field.minimum) {
            errors.push({ field: field.name, message: `mindestens ${field.minimum}` })
          }
          if (field.maximum !== undefined && value > field.maximum) {
            errors.push({ field: field.name, message: `höchstens ${field.maximum}` })
          }
        }
        break
      }
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({ field: field.name, message: 'muss true/false sein' })
        }
        break
      case 'string-array':
        if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
          errors.push({ field: field.name, message: 'muss Liste von Strings sein' })
        }
        break
      case 'json':
        // validated via raw JSON.parse before value arrives here
        break
    }
  }
  return errors
}

export function stripEmpty(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue
    if (typeof v === 'string' && v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}
