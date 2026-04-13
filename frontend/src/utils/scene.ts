export type Scene = 'proposal' | 'review' | 'paragraph' | 'format' | null

const SCENE_MAP: Array<[Scene, RegExp]> = [
  ['proposal', /开题|组会|中期|research\s*proposal/i],
  ['review', /综述|文献梳理|related\s*work/i],
  ['format', /引用格式|字数压缩|摘要翻译/i],
  ['paragraph', /段落|润色|改写|撰写|章节/i],
]

export function detectScene(text: string): Scene {
  for (const [scene, re] of SCENE_MAP) {
    if (re.test(text)) return scene
  }
  return null
}

export const SCENE_LABELS: Record<NonNullable<Scene>, string> = {
  proposal: '开题报告',
  review: '文献综述',
  paragraph: '段落写作',
  format: '格式化',
}

export const SCENE_COLORS: Record<NonNullable<Scene>, string> = {
  proposal: 'bg-blue-100 text-blue-700',
  review: 'bg-green-100 text-green-700',
  paragraph: 'bg-purple-100 text-purple-700',
  format: 'bg-gray-100 text-gray-600',
}
