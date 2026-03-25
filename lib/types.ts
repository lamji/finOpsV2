export interface FinancialMetric {
  label: string
  value: string
  change: string
  trend: "up" | "down" | "neutral"
  description: string
}

export interface FinancialSummary {
  period: string
  daysElapsed: number
  daysInMonth: number
  daysRemaining: number
}

export interface CostDriver {
  name: string
  amount: number
  percentage: number
  trend: "up" | "down" | "neutral"
  change: string
}

export interface ChartDataPoint {
  month: string
  expenses: number
  budget?: number
}

export interface Alert {
  id: string
  type: "warning" | "info" | "success"
  title: string
  message: string
}

export interface ChatbotMessage {
  id: string
  role: "assistant" | "user"
  content: string
  blocked?: boolean
}

export interface ChatbotContext {
  statistics: FinancialMetric[]
  charts: ChartDataPoint[]
  byService: CostDriver[]
  byProject: CostDriver[]
  bySku: CostDriver[]
  summary: FinancialSummary
  aiInsights: Alert[]
}

export interface ChatbotRequest {
  message: string
  context: ChatbotContext
}

export interface ChatbotResponse {
  message: string
  blocked: boolean
}

export interface QuickAction {
  id: string
  label: string
  icon: string
}

export interface BigQueryDashboardResponse {
  status: number
  source: "cached" | "db"
  statistics: FinancialMetric[]
  charts: ChartDataPoint[]
  byService: CostDriver[]        // by raw service name
  byProject: CostDriver[]        // by project
  bySku: CostDriver[]            // by SKU (top 20)
  summary: FinancialSummary
  aiInsights: Alert[]
  rawPayload: unknown
}

export interface StatCardProps {
  label: string
  value: string
  change: string
  trend: "up" | "down" | "neutral"
  description?: string
}

export interface AggregatedDashboard {
  statistics: FinancialMetric[]
  charts: ChartDataPoint[]
  byService: CostDriver[]        // by raw service.description
  byProject: CostDriver[]        // by project.id / project.name
  bySku: CostDriver[]            // by sku.description (top 20)
  summary: FinancialSummary
}

/** Aggregated row returned by the GROUP BY SQL query — one row per (service, month) */
export interface ServiceCostRow {
  service_description: string   // service.description
  invoice_month: string         // invoice.month — YYYYMM format
  effective_cost: number        // cost + credits, already summed by SQL
}

// ── BigQuery wire types ─────────────────────────────────────────────────────

export type BigQueryCell = {
  v: BigQueryValue
}

export type BigQueryValue =
  | string
  | number
  | boolean
  | null
  | { f?: BigQueryCell[]; v?: BigQueryValue[] | string | number | boolean | null }

export type BigQueryField = {
  name: string
  type: string
  mode?: string
  fields?: BigQueryField[]
}

export type BigQueryRow = {
  f: BigQueryCell[]
}

export type BigQueryQueryResponse = {
  schema?: { fields?: BigQueryField[] }
  rows?: BigQueryRow[]
  totalRows?: string
  jobComplete?: boolean
  jobReference?: { projectId?: string; jobId?: string; location?: string }
  errors?: Array<{ message?: string; reason?: string }>
  cacheHit?: boolean
  totalBytesProcessed?: string
  totalBytesBilled?: string
}

export interface CachedPayload {
  rows: Record<string, unknown>[]
  totalRows: string
  jobComplete: boolean
  cacheHit: boolean
  totalBytesProcessed: string | null
  totalBytesBilled: string | null
  jobReference: BigQueryQueryResponse["jobReference"] | null
  schema: BigQueryField[]
  aggregated?: AggregatedDashboard
  aiInsights?: Alert[]
}

export interface BillingRow {
  billing_account_id: string
  service: { id: string; description: string }
  sku: { id: string; description: string }
  usage_start_time: string
  usage_end_time: string
  project: {
    id: string
    number: string
    name: string
    labels: Array<{ key: string; value: string }>
    ancestry_numbers: string
    ancestors: Array<{ resource_name: string; display_name: string }>
  }
  labels: Array<{ key: string; value: string }>
  system_labels: Array<{ key: string; value: string }>
  location: { location: string; country: string; region: string; zone: string | null }
  resource: { name: string | null; global_name: string | null }
  tags: unknown[]
  price: {
    effective_price: string
    tier_start_amount: string
    unit: string
    pricing_unit_quantity: string
    list_price: string
    effective_price_default: string
    list_price_consumption_model: string
  }
  subscription: { instance_id: string | null }
  transaction_type: string
  seller_name: string
  export_time: string
  cost: string
  currency: string
  currency_conversion_rate: string
  usage: {
    amount: string
    unit: string
    amount_in_pricing_units: string
    pricing_unit: string
  }
  credits: Array<{
    name: string
    amount: string
    full_name: string
    id: string
    type: string
  }>
  invoice: { month: string; publisher_type: string }
  cost_type: string
  adjustment_info: {
    id: string | null
    description: string | null
    mode: string | null
    type: string | null
  }
  cost_at_list: string
  cost_at_effective_price_default: string
  cost_at_list_consumption_model: string
  consumption_model: { id: string; description: string }
}
