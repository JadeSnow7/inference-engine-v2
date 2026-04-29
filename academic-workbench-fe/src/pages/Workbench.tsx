import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Sparkles, ArrowRight, Play, Loader2, Link as LinkIcon, Send } from 'lucide-react';

export default function Workbench() {
  const workbenchContext = useStore(state => state.workbenchContext);
  const setWorkbenchContext = useStore(state => state.setWorkbenchContext);
  const setIsRightPanelOpen = useStore(state => state.setIsRightPanelOpen);
  
  const [inputText, setInputText] = useState('');
  const [streamState, setStreamState] = useState<'idle' | 'generating' | 'done'>('idle');
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初始化带有上下文的视图
  useEffect(() => {
    if (workbenchContext && streamState === 'idle') {
      const actionMap: Record<string, string> = {
        outline: '生成开题报告大纲',
        review: '整理文献综述',
        gap: '提炼研究空白',
        polish: '润色论文段落'
      };
      const verb = workbenchContext.actionType ? actionMap[workbenchContext.actionType] : '分析';
      setInputText(`请针对相关资料《${workbenchContext.sourceTitle}》进行深度${verb}。`);
      // Consume context
      setWorkbenchContext(null);
    }
  }, [workbenchContext, streamState, setWorkbenchContext]);

  // 模拟流式生成
  const handleGenerate = () => {
    if (!inputText.trim() || streamState === 'generating') return;
    
    setStreamState('generating');
    setOutputLines([]);
    // 打开右侧证据面板
    setIsRightPanelOpen(true);

    const mockStreamData = [
      `[阶段] 正在解析意图：针对核心输入进行语义分析...`,
      `[阶段] 启动高并发学术检索，检索知识库中...`,
      `[阶段] 提取出 4 篇相关高分 Reference，整理相关证据链路。`,
      `====================`,
      `### 研究空白分析与大纲构建`,
      `基于对现有《${inputText.slice(8, 20)}...》及其相关领域的文献分析，我们发现：`,
      `1. 虽然宏观模型已经极其丰富，但微观层面的消费者剩余数字化衡量标准仍然匮乏。`,
      `2. 大部分模型基于静态数据，缺乏对高频交易环境下的动态补偿机制分析。`,
      ` `,
      `**建议的研究切入点：**`,
      `利用强化学习技术构建动态的微观经济预测模型，引入实时的决策延迟因子。该方案不仅可以填补当前理论的执行层空白，也可以在实践中指导更好的资源分配效率。`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < mockStreamData.length) {
        setOutputLines(prev => [...prev, mockStreamData[currentStep]]);
        currentStep++;
      } else {
        setStreamState('done');
        clearInterval(interval);
      }
    }, 600); // 间隔模拟打字机
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputLines]);

  return (
    <div className="flex flex-col h-full bg-scholar-bg-canvas relative overflow-hidden">
      
      {/* 顶部工具栏 */}
      <header className="h-14 border-b border-scholar-border bg-scholar-bg-surface flex items-center justify-between px-6 shrink-0 z-10 w-full">
         <div className="flex space-x-6 text-sm font-medium">
            <button className="text-scholar-academic relative after:absolute after:bottom-[-16px] after:left-0 after:w-full after:h-0.5 after:bg-scholar-academic">学术工作台</button>
            <button className="text-scholar-text-secondary hover:text-scholar-text-primary">代码引擎</button>
         </div>
      </header>

      {/* 中心内容区 */}
      <div className="flex-1 overflow-hidden w-full flex flex-col p-4 md:p-8 items-center relative">
         <div className="w-full max-w-4xl h-full flex flex-col bg-scholar-bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.02)] rounded-xl border border-scholar-border overflow-hidden relative">
            
            {streamState === 'idle' ? (
              <EmptyState onClickChip={(text) => setInputText(text)} />
            ) : (
              <div className="flex-1 overflow-y-auto p-6 md:p-10" ref={scrollRef}>
                <div className="prose prose-sm md:prose-base prose-slate max-w-none prose-headings:text-scholar-text-primary prose-p:text-scholar-text-primary/90">
                  {outputLines.map((line, idx) => (
                    <div key={idx} className={`mb-2 ${line.startsWith('[阶段]') ? 'text-sm text-scholar-academic bg-blue-50/50 p-2 rounded-md font-mono' : ''}`}>
                      {line === ' ' ? <br/> : line}
                    </div>
                  ))}
                  {streamState === 'generating' && (
                    <div className="flex items-center space-x-2 text-scholar-academic mt-4">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm font-medium">正在深度推演生成中...</span>
                    </div>
                  )}
                </div>
                
                {streamState === 'done' && (
                  <div className="mt-10 pt-6 border-t border-scholar-border/60 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <ActionButton icon={<ArrowRight size={14}/>} text="继续提炼核心矛盾" />
                    <ActionButton icon={<Sparkles size={14}/>} text="改写为学术摘要语气" />
                    <ActionButton 
                       icon={<LinkIcon size={14}/>} 
                       text="一键导出为飞书云文档" 
                       highlight 
                       onClick={() => alert("模拟通过飞书 API 导出...")} 
                    />
                  </div>
                )}
              </div>
            )}

            {/* 底部输入框 */}
            <div className="p-4 border-t border-scholar-border bg-white mt-auto shrink-0">
               <div className="flex items-end bg-scholar-bg-canvas border border-scholar-border focus-within:border-scholar-primary/50 rounded-xl overflow-hidden shadow-sm transition-colors">
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="输入要探索的课题，或载入指定的文献上下文..."
                    className="flex-1 max-h-40 min-h-[60px] bg-transparent outline-none p-4 text-sm resize-none text-scholar-text-primary"
                  />
                  <div className="p-3 shrink-0">
                    <button 
                      onClick={handleGenerate}
                      disabled={!inputText.trim() || streamState === 'generating'}
                      className="p-2.5 bg-scholar-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-scholar-primary-hover transition-colors">
                      <Send size={18} />
                    </button>
                  </div>
               </div>
            </div>

         </div>
      </div>
    </div>
  );
}

function EmptyState({ onClickChip }: { onClickChip: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="w-16 h-16 bg-blue-50/50 text-scholar-primary rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
        <Sparkles size={32} />
      </div>
      <h2 className="text-2xl font-bold text-scholar-text-primary mb-3">开始严谨高效的学术创作</h2>
      <p className="text-scholar-text-secondary text-sm md:text-base text-center max-w-md mb-10">
        将数百篇文献的智慧与你的灵感交织。工作台强制伴随证据输出，杜绝AI幻觉。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
        <Chip text="整理指定课题文献综述" onClick={() => onClickChip("请帮我整理基于多模态大模型的最新文献综述，重点关注架构演进。")} />
        <Chip text="生成开题报告大纲" onClick={() => onClickChip("我准备写一篇关于行为经济学沉没成本的开题报告，请帮我生成结构化大纲。")} />
        <Chip text="润色为学术段落" onClick={() => onClickChip("请将我复制到输入框的口语化文字，逐句润色为严谨的学术论文论述调性。")} />
        <Chip text="提炼交叉领域研究空白" onClick={() => onClickChip("分析人工智能生成内容（AIGC）与传统版权保护法案之间的冲突核心与研究空白。")} />
      </div>
    </div>
  )
}

function Chip({ text, onClick }: { text: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="py-3 px-4 bg-scholar-bg-canvas border border-scholar-border text-sm text-scholar-text-secondary hover:text-scholar-primary hover:border-scholar-primary/30 rounded-xl text-left transition-all flex items-center space-x-2 group">
      <Play size={14} className="opacity-40 group-hover:opacity-100" />
      <span>{text}</span>
    </button>
  )
}

function ActionButton({ icon, text, highlight, onClick }: { icon: React.ReactNode, text: string, highlight?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
        highlight 
          ? 'bg-blue-50 text-scholar-primary border-blue-100 hover:bg-blue-100' 
          : 'bg-scholar-bg-surface text-scholar-text-secondary border-scholar-border hover:bg-scholar-bg-canvas hover:text-scholar-text-primary'
      }`}>
      {icon}
      <span>{text}</span>
    </button>
  )
}
