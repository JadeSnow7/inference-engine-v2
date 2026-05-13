import { apiFetch } from './client'

export interface ConfigStatus {
  active_provider: 'bailian_app' | 'standard_llm' | string
  provider_preference: 'bailian_first' | string
  llm: {
    dashscope: 'configured' | 'missing' | string
    model: string
  }
  rag: {
    provider: string
    configured: boolean
    model?: string
  }
  bailian_app: {
    enabled: boolean
    configured: boolean
    purpose: string
  }
  local_rag_enabled: boolean
}

export function fetchConfigStatus(): Promise<ConfigStatus> {
  return apiFetch<ConfigStatus>('/api/config/status')
}
