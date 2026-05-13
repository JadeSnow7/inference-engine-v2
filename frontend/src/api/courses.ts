import { apiFetch } from './client'
import type { WorkbenchContext } from '../store/layout'

export type CourseMaterialType = 'outline' | 'review' | 'gap' | 'polish' | 'blank'
export type CourseSourceType = 'course' | 'paper' | 'lecture' | 'manual'

export interface ResearchSpace {
  id: string
  title: string
  teacher: string
  topic: string
  literatureCount: number
  graphUpdates: number
  status: string
  material: {
    title: string
    type: CourseMaterialType
    sourceType: CourseSourceType
  }
}

export interface ResearchSpacesResponse {
  items: ResearchSpace[]
}

export interface OpenResearchSpaceResponse {
  context: WorkbenchContext
  space: ResearchSpace
}

export function fetchResearchSpaces(): Promise<ResearchSpacesResponse> {
  return apiFetch<ResearchSpacesResponse>('/api/courses')
}

export function openResearchSpace(spaceId: string): Promise<OpenResearchSpaceResponse> {
  return apiFetch<OpenResearchSpaceResponse>(`/api/courses/${spaceId}/open`, {
    method: 'POST',
  })
}
