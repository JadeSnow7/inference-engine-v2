import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const connectSSE = vi.fn()

vi.mock('../../api/sse', () => ({
  connectSSE: (...args: unknown[]) => connectSSE(...args),
}))

import Workbench from '../Workbench'
import { useLayoutStore } from '../../store/layout'

describe('Workbench session reuse', () => {
  beforeEach(() => {
    connectSSE.mockReset()
    useLayoutStore.setState({
      isMobile: false,
      workbenchContext: null,
      isRightPanelOpen: false,
    })
  })

  it('reuses the latest session id for the next message', async () => {
    connectSSE
      .mockImplementationOnce((_message, handlers) => {
        handlers.onSessionId?.('sess-1')
        handlers.onDone()
        return { abort: vi.fn() }
      })
      .mockImplementationOnce((_message, handlers) => {
        handlers.onDone()
        return { abort: vi.fn() }
      })

    const user = userEvent.setup()
    render(<Workbench />)

    const input = screen.getByPlaceholderText(/Enter 发送/)
    await user.type(input, '第一条消息{enter}')

    await waitFor(() => {
      expect(connectSSE).toHaveBeenCalledTimes(1)
    })
    expect(connectSSE.mock.calls[0][2]).toBeUndefined()

    await user.clear(input)
    await user.type(input, '第二条消息{enter}')

    await waitFor(() => {
      expect(connectSSE).toHaveBeenCalledTimes(2)
    })
    expect(connectSSE.mock.calls[1][2]).toBe('sess-1')
  })
})
