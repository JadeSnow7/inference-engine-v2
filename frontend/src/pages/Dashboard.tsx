import { BookOpen, Sparkles, FolderKanban, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-10 w-full max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome Back, Scholar</h1>
        <p className="text-scholar-text-secondary">您有 3 项核心待命任务，随时可进入工作台进行深入剖析。</p>
      </div>

      <h2 className="text-lg font-semibold mb-4 text-scholar-text-primary">核心研究区</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <ActionCard
          icon={<BookOpen size={24} className="text-blue-500" />}
          title="课程资料库"
          desc="查看所有进行中的学业课程"
          onClick={() => navigate('/courses')}
        />
        <ActionCard
          icon={<Sparkles size={24} className="text-scholar-academic" />}
          title="学术生成"
          desc="构建提纲、完成文献综述"
          onClick={() => navigate('/workbench')}
        />
        <ActionCard
          icon={<FolderKanban size={24} className="text-orange-500" />}
          title="飞书云文档协作"
          desc="查看并回流导师审批过的初稿"
          onClick={() => {}}
        />
        <ActionCard
          icon={<Network size={24} className="text-scholar-discovery" />}
          title="知识关系图谱"
          desc="全局俯瞰知识网络连线"
          onClick={() => navigate('/discovery')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 text-scholar-text-primary">最近活跃课程</h2>
          <div className="bg-scholar-bg-surface border border-scholar-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-scholar-border pb-4 mb-4">
              <div>
                <h3 className="font-bold text-lg">Principles of Microeconomics</h3>
                <span className="text-xs text-scholar-text-weak">Prof. John Doe · 周三更新了 3 篇 Reference</span>
              </div>
              <button
                onClick={() => navigate('/courses')}
                className="px-4 py-2 bg-scholar-bg-canvas text-scholar-primary text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors">
                进入课程
              </button>
            </div>
            <p className="text-sm text-scholar-text-secondary">您上一次在本系列课程中提交了一次"文献总结"任务。目前图谱节点有新增更新，建议复习。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, desc, icon, onClick }: { title: string; desc: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group p-5 bg-scholar-bg-surface border border-scholar-border hover:border-scholar-primary/40 rounded-xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between h-36"
    >
      <div className="flex justify-between items-start">
        <div className="p-2 bg-scholar-bg-canvas rounded-lg">{icon}</div>
      </div>
      <div>
        <h3 className="font-semibold text-scholar-text-primary group-hover:text-scholar-primary transition-colors">{title}</h3>
        <p className="text-xs text-scholar-text-weak mt-1">{desc}</p>
      </div>
    </div>
  );
}
