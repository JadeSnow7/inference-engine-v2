import { ArrowRight, BookOpen, ChevronRight, FileText, Network, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchResearchSpaces, openResearchSpace, type ResearchSpace } from '../api/courses'
import { Badge, Button, Card } from '../components/ui'
import { useLayoutStore } from '../store/layout'

export default function Courses() {
  const navigate = useNavigate()
  const setWorkbenchContext = useLayoutStore(state => state.setWorkbenchContext)
  const [spaces, setSpaces] = useState<ResearchSpace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [openingSpaceId, setOpeningSpaceId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setErrorMessage('')

    fetchResearchSpaces()
      .then(response => {
        if (!active) return
        setSpaces(response.items)
        setIsLoading(false)
      })
      .catch(error => {
        if (!active) return
        setErrorMessage(error instanceof Error ? error.message : '研究空间服务暂时不可用')
        setSpaces([])
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleTakeToWorkbench = async (space: ResearchSpace) => {
    setOpeningSpaceId(space.id)
    try {
      const response = await openResearchSpace(space.id)
      setWorkbenchContext(response.context)
      navigate('/workbench')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '载入工作台失败')
    } finally {
      setOpeningSpaceId(null)
    }
  }

  const handleOpenBlank = () => {
    setWorkbenchContext({
      sourceTitle: '未命名研究文档',
      actionType: 'blank',
      courseTitle: '空白工作台',
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
            打开空白工作台
            <ArrowRight size={16} />
          </Button>
        </header>

        {isLoading && (
          <section className="rounded-2xl border border-dashed border-scholar-border bg-white/70 px-5 py-10 text-center text-sm font-semibold text-scholar-text-secondary">
            正在加载研究空间...
          </section>
        )}

        {!isLoading && errorMessage && (
          <section className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-8 text-center">
            <h2 className="text-base font-bold text-rose-700">研究空间加载失败</h2>
            <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && spaces.length === 0 && (
          <section className="rounded-2xl border border-dashed border-scholar-border bg-white/70 px-5 py-10 text-center">
            <h2 className="text-base font-bold text-scholar-text-primary">暂无研究空间</h2>
            <p className="mt-2 text-sm text-scholar-text-secondary">课程研究空间将在后端同步课程或创建研究任务后显示。</p>
          </section>
        )}

        {!isLoading && !errorMessage && spaces.length > 0 && (
          <section className="grid gap-5 xl:grid-cols-3">
            {spaces.map(space => (
            <Card key={space.id} className="flex min-h-[320px] flex-col justify-between">
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
                  {openingSpaceId === space.id ? '正在载入' : '打开工作台'}
                  <ChevronRight size={16} />
                </Button>
                <Button variant="secondary" onClick={() => navigate('/library')} className="w-full">
                  查看课程证据
                </Button>
              </div>
            </Card>
            ))}
          </section>
        )}
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
