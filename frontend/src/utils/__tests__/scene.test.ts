import { describe, it, expect } from 'vitest'
import { detectScene } from '../scene'

describe('detectScene', () => {
  it('detects proposal from 开题', () => {
    expect(detectScene('帮我生成开题报告大纲')).toBe('proposal')
  })
  it('detects review from 文献综述', () => {
    expect(detectScene('整理相关文献综述')).toBe('review')
  })
  it('detects format from 引用格式', () => {
    expect(detectScene('帮我规范引用格式')).toBe('format')
  })
  it('detects paragraph from 润色', () => {
    expect(detectScene('润色这段论文内容')).toBe('paragraph')
  })
  it('returns null for unrecognised input', () => {
    expect(detectScene('你好')).toBeNull()
  })
})
