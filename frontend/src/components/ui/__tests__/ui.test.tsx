import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Search } from 'lucide-react'
import { Badge, Button, Card, IconButton, Input, StateBlock } from '../index'

describe('ui primitives', () => {
  it('Button disables interaction while loading and exposes loading text', () => {
    const onClick = vi.fn()

    render(<Button loading onClick={onClick}>生成</Button>)

    const button = screen.getByRole('button', { name: /处理中/ })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('IconButton requires an accessible label and renders an icon-only control', () => {
    render(<IconButton aria-label="搜索"><Search size={16} /></IconButton>)

    expect(screen.getByRole('button', { name: '搜索' })).toBeInTheDocument()
  })

  it('Card renders title and keeps content in a semantic region', () => {
    render(<Card title="最近文献">Large Language Models in Education</Card>)

    expect(screen.getByRole('region', { name: '最近文献' })).toHaveTextContent('Large Language Models in Education')
  })

  it('Input wires label value and change events', () => {
    const onChange = vi.fn()

    render(<Input label="研究主题" value="AI 教育" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('研究主题'), { target: { value: 'AI 写作' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('Badge and StateBlock provide consistent status surfaces', () => {
    render(
      <>
        <Badge tone="success">已恢复</Badge>
        <StateBlock title="暂无历史记录" description="开始一次研究后会显示在这里。" />
      </>,
    )

    expect(screen.getByText('已恢复')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '暂无历史记录' })).toHaveTextContent('开始一次研究后会显示在这里。')
  })
})
