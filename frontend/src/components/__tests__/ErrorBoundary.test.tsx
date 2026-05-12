import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import ErrorBoundary from '../ErrorBoundary'

function BrokenChild(): ReactElement {
  throw new Error('secret stack details')
}

describe('ErrorBoundary', () => {
  it('shows a generic recovery message without exposing stack details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: '应用暂时无法显示' })).toBeInTheDocument()
    expect(screen.getByText(/错误编号/)).toBeInTheDocument()
    expect(screen.queryByText(/secret stack details/)).not.toBeInTheDocument()
    expect(screen.queryByText(/componentStack/)).not.toBeInTheDocument()
  })
})
