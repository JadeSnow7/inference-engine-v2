import { ArrowRight, BookOpen, ChevronRight, FileText, Network, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card } from '../components/ui'
import { useLayoutStore } from '../store/layout'

interface ResearchSpace {
  title: string
  teacher: string
  topic: string
  literatureCount: number
  graphUpdates: number
  status: string
  materialTitle: string
  materialType: 'outline' | 'review' | 'gap'
}

const spaces: ResearchSpace[] = [
  {
    title: 'Principles of Microeconomics',
    teacher: 'Prof. John Doe',
    topic: '大语言模型在教育领域的应用综述',
    literatureCount: 24,
    graphUpdates: 5,
    status: '正在撰写文献综述',
    materialTitle: 'Theory of the Firm',
    materialType: 'outline',
  },
  {
    title: 'Research Methods in Education',
    teacher: 'Dr. Lin Chen',
    topic: 'AI 学习反馈工具的课堂成效研究',
    literatureCount: 18,
    graphUpdates: 3,
    status: '等待规范校验',
    materialTitle: 'A Survey on AI-Powered Educational Tools',
    materialType: 'review',
  },
  {
    title: 'Academic Writing',
    teacher: 'Writing Center',
    topic: '本科论文结构与引用规范',
    literatureCount: 9,
    graphUpdates: 2,
    status: '需要补充引用证据',
    materialTitle: 'HUST Undergraduate Thesis Norms',
    materialType: 'gap',
  },
]

export default function Courses() {
  const navigate = useNavigate()
  const setWorkbenchContext = useLayoutStore(state => state.setWorkbenchContext)

  const handleTakeToWorkbench = (space: ResearchSpace) => {
    setWorkbenchContext({
      sourceTitle: space.materialTitle,
      actionType: space.materialType,
      courseTitle: space.title,
      sourceType: space.materialType === 'review' ? 'paper' : 'lecture',
      createdAt: new Date().toISOString(),
    })
    navigate('/workbench')
  }

  const handleOpenBlank = () => {
    setWorkbenchContext({
      sourceTitle: '大语言模型在教育领域的应用综述',
      actionType: 'blank',
      courseTitle: 'Research Workspace',
      sourceType: 'manual',
      createdAt: new Date().toISOString(),
    })
    navigate('/workbench')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 border-b border-scholar-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-scholar-primary">
              <BookOpen size={18} />
              课程研究入口
            </div>
            <h1 className="text-2xl font-bold text-scholar-text-primary">研究空间</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-scholar-text-secondary">
              每门课程都作为一个可进入工作台的研究空间，保留主题、文献、图谱更新和写作状态。
            </p>
          </div>
          <Button onClick={handleOpenBlank}>
            进入研究工作台
            <ArrowRight size={16} />
          </Button>
        </header>

        <section className="grid gap-5 xl:grid-cols-3">
          {spaces.map(space => (
            <Card key={space.title} className="flex min-h-[320px] flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-scholar-text-primary">{space.title}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-scholar-text-secondary">
                      <Users size={13} />
                      {space.teacher}
                    </p>
                  </div>
                  <Badge tone="primary">{space.status}</Badge>
                </div>

                <div className="mt-5 rounded-2xl border border-scholar-border bg-scholar-bg-canvas p-4">
                  <p className="text-xs font-semibold text-scholar-text-weak">当前研究主题</p>
                  <h3 className="mt-2 text-base font-bold leading-6 text-scholar-text-primary">{space.topic}</h3>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Stat label="文献" value={`${space.literatureCount} 篇`} icon={<FileText size={15} />} />
                  <Stat label="图谱更新" value={`${space.graphUpdates} 个`} icon={<Network size={15} />} />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Button onClick={() => handleTakeToWorkbench(space)} className="w-full">
                  载入工作台剖析
                  <ChevronRight size={16} />
                </Button>
                <Button variant="secondary" onClick={() => navigate('/library')} className="w-full">
                  查看课程证据
                </Button>
              </div>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-scholar-border bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-scholar-text-weak">{icon}{label}</div>
      <div className="mt-1 text-sm font-bold text-scholar-text-primary">{value}</div>
    </div>
  )
}
