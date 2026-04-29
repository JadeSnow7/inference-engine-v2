import { useNavigate } from 'react-router-dom';
import { useLayoutStore } from '../store/layout';
import { FileText, ChevronRight, BrainCircuit } from 'lucide-react';

export default function Courses() {
  const navigate = useNavigate();
  const setWorkbenchContext = useLayoutStore(state => state.setWorkbenchContext);

  const handleTakeToWorkbench = (title: string, type: string) => {
    setWorkbenchContext({ sourceTitle: title, actionType: type });
    navigate('/workbench');
  };

  return (
    <div className="p-6 md:p-10 w-full max-w-5xl mx-auto h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6 border-b border-scholar-border pb-4">Principles of Microeconomics</h1>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-scholar-text-primary mb-3">课程提纲与关键文献</h2>

          <ResourceCard
            title="The Theory of the Firm - Market Equilibrium"
            type="PDF Document"
            onExtract={() => handleTakeToWorkbench('Theory of the Firm', 'outline')}
          />
          <ResourceCard
            title="Consumer Surplus in Digital Economies"
            type="Academic Paper"
            onExtract={() => handleTakeToWorkbench('Consumer Surplus in Digital Economies', 'review')}
          />
          <ResourceCard
            title="Behavioral Economics Foundations"
            type="Lecture Notes"
            onExtract={() => handleTakeToWorkbench('Behavioral Economics Foundations', 'gap')}
          />
        </div>

        <div className="bg-scholar-bg-surface border border-scholar-border rounded-xl p-5 shadow-sm h-fit">
          <div className="flex items-center space-x-2 text-scholar-academic mb-4">
            <BrainCircuit size={20} />
            <h3 className="font-bold">Course AI Assistant</h3>
          </div>
          <p className="text-sm text-scholar-text-secondary leading-relaxed mb-4">
            针对于微观经济学的学习材料，您可以随时向我提问，或者选择具体的文献导入到学术工作台中生成你的专属文献综述。
          </p>
          <button
            onClick={() => navigate('/workbench')}
            className="w-full py-2.5 bg-scholar-primary text-white rounded-lg text-sm font-medium hover:bg-scholar-primary-hover transition-colors shadow-sm">
            进入空白工作台
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({ title, type, onExtract }: { title: string; type: string; onExtract: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-scholar-bg-surface border border-scholar-border rounded-xl hover:shadow-sm transition-shadow">
      <div className="flex items-start space-x-3 mb-3 sm:mb-0">
        <div className="mt-1 p-2 bg-blue-50 text-blue-500 rounded-md"><FileText size={18} /></div>
        <div>
          <h4 className="font-semibold text-scholar-text-primary text-[15px]">{title}</h4>
          <span className="text-xs text-scholar-text-weak uppercase tracking-wider font-semibold">{type}</span>
        </div>
      </div>
      <button
        onClick={onExtract}
        className="flex items-center justify-center space-x-1 text-sm font-medium text-scholar-academic bg-blue-50/50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-transparent hover:border-blue-200 transition-colors shrink-0"
      >
        <span>载入工作台剖析</span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
