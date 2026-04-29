import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { LayoutDashboard, BookOpen, Sparkles, Network } from 'lucide-react';

function useWindowSize() {
  const setIsMobile = useStore(state => state.setIsMobile);
  const [isMobile, setLocalIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setLocalIsMobile(mobile);
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile]);

  return isMobile;
}

export default function App() {
  const isMobile = useWindowSize();
  const navigate = useNavigate();
  const location = useLocation();
  const isRightPanelOpen = useStore(state => state.isRightPanelOpen);
  const setIsRightPanelOpen = useStore(state => state.setIsRightPanelOpen);

  const currentPath = location.pathname;
  const isDashboard = currentPath === '/';

  // ------------------------------------
  // Desktop Layout (左 中 右 三栏 / 两栏)
  // ------------------------------------
  if (!isMobile) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-scholar-bg-canvas text-scholar-text-primary">
        {/* 左侧全局导航栏 */}
        <nav className="w-56 flex-shrink-0 border-r border-scholar-border bg-scholar-bg-surface flex flex-col">
          <div className="p-5 border-b border-scholar-border mb-4 cursor-pointer" onClick={() => navigate('/')}>
            <h1 className="text-xl font-bold tracking-tight text-scholar-primary flex items-center space-x-2">
              <span className="w-6 h-6 bg-scholar-primary text-white flex items-center justify-center rounded-md text-sm font-black">S</span>
              <span>Scholar<span className="font-light">Script</span></span>
            </h1>
          </div>
          <div className="flex-1 px-3 space-y-1.5">
            <NavItem icon={<LayoutDashboard size={18}/>} label="总览" path="/" currentPath={currentPath} onClick={() => navigate('/')} />
            <NavItem icon={<BookOpen size={18}/>} label="课程" path="/courses" currentPath={currentPath} onClick={() => navigate('/courses')} />
            <NavItem icon={<Sparkles size={18}/>} label="学术工作台" path="/workbench" currentPath={currentPath} onClick={() => navigate('/workbench')} />
            <NavItem icon={<Network size={18}/>} label="知识图谱" path="/discovery" currentPath={currentPath} onClick={() => navigate('/discovery')} />
          </div>
        </nav>

        {/* 中央主操作区 (通过 Router Outlet 动态替换) */}
        <main className="flex-1 min-w-0 bg-scholar-bg-canvas flex flex-col items-center">
          <Outlet />
        </main>

        {/* 右侧证据/辅助面板 (默认仅在需要时展示，比如首页可以隐藏或显示待办) */}
        {!isDashboard && (
          <aside className="w-80 flex-shrink-0 border-l border-scholar-border bg-scholar-bg-surface flex flex-col transition-all">
            <div className="p-4 border-b border-scholar-border flex justify-between items-center bg-gray-50/50">
               <h3 className="font-semibold text-scholar-text-primary text-sm flex items-center">
                  <span className="w-2 h-2 rounded-full bg-scholar-primary mr-2"></span>
                  上下文与证据关联
               </h3>
               {currentPath === '/workbench' && (
                 <button className="text-xs font-medium text-scholar-primary bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors">追踪来源</button>
               )}
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fafbfc]">
              <EvidenceCard title="Generative AI in Academic Contexts" source="Nature Review, 2024" />
              <EvidenceCard title="The Economics of Information Access" source="Journal of Finance, 2023" />
            </div>
          </aside>
        )}
      </div>
    );
  }

  // ------------------------------------
  // Mobile Layout (顶部 上下文 + 单主区 + 底部导航 + 上拉抽屉)
  // ------------------------------------
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-scholar-bg-canvas text-scholar-text-primary relative">
      
      {/* 顶部上下文/辅助呼出条 (首页隐藏) */}
      {!isDashboard && (
        <header className="h-14 border-b border-scholar-border bg-scholar-bg-surface flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
          <span className="font-medium text-scholar-academic flex items-center space-x-1">
             <div className="w-4 h-4 bg-scholar-primary/20 rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-scholar-primary rounded-full"></div></div>
             <span>工作流环境</span>
          </span>
          <button 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="text-xs font-semibold text-scholar-primary bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
          >
            {isRightPanelOpen ? '关闭面板' : '查看上下文证据'}
          </button>
        </header>
      )}

      {/* 单主区 (可滚动承载长文本或图谱) */}
      <main className="flex-1 overflow-y-auto relative z-0">
         <Outlet />
      </main>

      {/* 底部主导航 Tab */}
      <nav className="h-16 border-t border-scholar-border bg-scholar-bg-surface flex items-center justify-around pb-safe shrink-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
        <TabItem icon={<LayoutDashboard size={20}/>} label="主页" path="/" currentPath={currentPath} onClick={() => navigate('/')} />
        <TabItem icon={<BookOpen size={20}/>} label="课程" path="/courses" currentPath={currentPath} onClick={() => navigate('/courses')} />
        <TabItem icon={<Sparkles size={20}/>} label="工作台" path="/workbench" currentPath={currentPath} onClick={() => navigate('/workbench')} />
        <TabItem icon={<Network size={20}/>} label="发现" path="/discovery" currentPath={currentPath} onClick={() => navigate('/discovery')} />
      </nav>

      {/* 移动端上拉抽屉 (证据池) */}
      <div 
        className={`absolute bottom-0 left-0 w-full bg-scholar-bg-surface rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 ${isRightPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '75vh' }}
      >
        <div className="px-4 py-3 flex justify-center cursor-grab" onClick={() => setIsRightPanelOpen(false)}>
           <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>
        <div className="px-5 pb-2 border-b border-scholar-border flex justify-between items-center">
          <h3 className="font-bold text-lg text-scholar-text-primary">关联证据与来源</h3>
        </div>
        <div className="p-5 overflow-y-auto h-full pb-24 space-y-3 bg-[#fafbfc]">
          <EvidenceCard title="Generative AI in Academic Contexts" source="Nature Review, 2024" />
          <EvidenceCard title="The Economics of Information Access" source="Journal of Finance, 2023" />
        </div>
      </div>
      
      {/* 抽屉背面的半透明遮罩 */}
      {isRightPanelOpen && <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] z-40 transition-opacity" onClick={() => setIsRightPanelOpen(false)} />}
    </div>
  );
}

// ------------------------------------
// Sub-components
// ------------------------------------
function NavItem({ icon, label, path, currentPath, onClick }: { icon: React.ReactNode, label: string, path: string, currentPath: string, onClick: () => void }) {
  const active = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
        active ? 'bg-blue-50 text-scholar-primary font-semibold' : 'text-scholar-text-secondary hover:bg-gray-100 hover:text-scholar-text-primary font-medium'
      }`}
    >
      <span className={active ? 'opacity-100' : 'opacity-70'}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TabItem({ icon, label, path, currentPath, onClick }: { icon: React.ReactNode, label: string, path: string, currentPath: string, onClick: () => void }) {
  const active = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center space-y-1 py-1 transition-colors ${
        active ? 'text-scholar-primary' : 'text-scholar-text-weak hover:text-scholar-text-secondary'
      }`}
    >
      <div className={`transition-transform duration-200 ${active ? 'scale-110 mb-0.5' : 'scale-100'}`}>
        {icon}
      </div>
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

function EvidenceCard({ title, source }: { title: string, source: string }) {
  return (
    <div className="p-3 border border-scholar-border rounded-xl bg-scholar-bg-surface hover:border-scholar-primary/50 transition-colors shadow-sm cursor-pointer">
      <h4 className="text-sm font-bold text-scholar-text-primary leading-tight mb-1.5 line-clamp-2">{title}</h4>
      <div className="flex items-center text-[11px] text-scholar-text-weak font-medium">
         <span className="w-1.5 h-1.5 rounded-full bg-blue-300 mr-1.5"></span>
         {source}
      </div>
    </div>
  );
}
