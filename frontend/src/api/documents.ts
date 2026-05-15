import { apiFetch } from './client'
import type { DocumentBlock } from '../types/workspace'

export interface PersistedDocument {
  id: string
  title: string
  courseId?: string | null
  blocks: DocumentBlock[]
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface DocumentVersionMetadata {
  reviewItemIds?: string[]
  acceptedChangeCount?: number
  source?: 'manual' | 'review_accept' | 'restore'
  [key: string]: unknown
}

export interface PersistedDocumentVersion {
  id: string
  documentId: string
  label?: string | null
  title: string
  blocks: DocumentBlock[]
  metadata?: DocumentVersionMetadata
  createdAt: string
}

export function fetchDocument(documentId: string): Promise<PersistedDocument> {
  return apiFetch<PersistedDocument>(`/api/documents/${documentId}`)
}

export function createDocument(input: {
  title: string
  courseId?: string | null
  blocks: DocumentBlock[]
  metadata?: Record<string, unknown>
}): Promise<PersistedDocument> {
  return apiFetch<PersistedDocument>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateDocument(
  documentId: string,
  input: {
    title?: string
    courseId?: string | null
    blocks?: DocumentBlock[]
    metadata?: Record<string, unknown>
  },
): Promise<PersistedDocument> {
  return apiFetch<PersistedDocument>(`/api/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function fetchDocumentVersions(documentId: string): Promise<PersistedDocumentVersion[]> {
  return apiFetch<PersistedDocumentVersion[]>(`/api/documents/${documentId}/versions`)
}

export function createDocumentVersion(
  documentId: string,
  label?: string,
  metadata: DocumentVersionMetadata = {},
): Promise<PersistedDocumentVersion> {
  return apiFetch<PersistedDocumentVersion>(`/api/documents/${documentId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ label, metadata }),
  })
}

export function restoreDocumentVersion(
  documentId: string,
  versionId: string,
): Promise<PersistedDocument> {
  return apiFetch<PersistedDocument>(`/api/documents/${documentId}/versions/${versionId}/restore`, {
    method: 'POST',
  })
}
