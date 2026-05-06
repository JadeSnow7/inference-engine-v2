import type {
  ConversationItem,
  DocumentBlock,
  DocumentSuggestion,
  DocumentVersion,
  ReferenceItem,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceSnapshot,
} from '../types/workspace'

export const conversations: ConversationItem[] = [
  {
    id: 'conv-image-classification',
    title: '基于深度学习的图像分类方法综述',
    preview: '当前对话',
    timeLabel: '10:30',
    status: 'active',
  },
  {
    id: 'conv-transfer-learning',
    title: '计算机视觉中的迁移学习综述',
    preview: '补充 ImageNet 预训练模型脉络',
    timeLabel: '昨天',
    status: 'active',
  },
  {
    id: 'conv-attention-nlp',
    title: '注意力机制在 NLP 中的应用',
    preview: '整理 Transformer 之前的注意力模型',
    timeLabel: '昨天',
    status: 'active',
  },
  {
    id: 'conv-rl-game-ai',
    title: '强化学习在游戏 AI 中的应用',
    preview: '分析 DQN 与 AlphaGo 的技术路线',
    timeLabel: '05-20',
    status: 'active',
  },
  {
    id: 'conv-recommendation',
    title: '推荐系统中的协同过滤算法',
    preview: '补充矩阵分解与深度召回方法',
    timeLabel: '05-18',
    status: 'active',
  },
]

export const documentVersions: DocumentVersion[] = [
  {
    id: 'v3-2',
    label: 'v3.2（当前）',
    summary: 'AI 修改并优化了方法分类部分',
    updatedAt: '10:30',
    isCurrent: true,
  },
  {
    id: 'v3-1',
    label: 'v3.1',
    summary: '增加了实验结果分析',
    updatedAt: '昨天',
    isCurrent: false,
  },
  {
    id: 'v3-0',
    label: 'v3.0',
    summary: '重构了文献综述结构',
    updatedAt: '05-20',
    isCurrent: false,
  },
]

export const references: ReferenceItem[] = [
  {
    id: 'ref-alexnet',
    title: 'AlexNet: Image Classification with Deep Convolutional Neural Networks',
    authors: 'Krizhevsky, A., Sutskever, I., & Hinton, G.',
    year: 2012,
    venue: 'NeurIPS',
  },
  {
    id: 'ref-resnet',
    title: 'Deep Residual Learning for Image Recognition',
    authors: 'He, K., Zhang, X., Ren, S., & Sun, J.',
    year: 2015,
    venue: 'CVPR',
  },
  {
    id: 'ref-densenet',
    title: 'Densely Connected Convolutional Networks',
    authors: 'Huang, G., Liu, Z., Van Der Maaten, L., & Weinberger, K.',
    year: 2017,
    venue: 'CVPR',
  },
  {
    id: 'ref-vit',
    title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale',
    authors: 'Dosovitskiy, A., Beyer, L., Kolesnikov, A., et al.',
    year: 2020,
    venue: 'ICLR',
  },
  {
    id: 'ref-augment',
    title: 'AutoAugment: Learning Augmentation Policies from Data',
    authors: 'Cubuk, E. D., Zoph, B., Mane, D., et al.',
    year: 2019,
    venue: 'CVPR',
  },
]

export const documentBlocks: DocumentBlock[] = [
  {
    id: 'block-intro-heading',
    type: 'heading',
    headingLevel: 1,
    title: '1. 引言',
    content: '1. 引言',
  },
  {
    id: 'block-intro-1',
    type: 'paragraph',
    content:
      '图像分类是计算机视觉领域的核心任务之一，旨在将图像分配到预定义的类别中。近年来，随着深度学习技术的快速发展，图像分类方法取得了显著进展，特别是卷积神经网络（CNN）在该领域的成功应用。',
    citations: [{ id: 'cite-alexnet', label: '[1]', referenceId: 'ref-alexnet' }],
    keywords: ['深度学习', '卷积神经网络（CNN）'],
  },
  {
    id: 'block-intro-2',
    type: 'paragraph',
    content:
      '本文旨在综述近年来基于深度学习的图像分类方法，分析其发展脉络、关键技术和未来趋势，并讨论模型性能提升背后的数据、结构与训练策略因素。',
    keywords: ['图像分类', '深度学习'],
  },
  {
    id: 'block-related-heading',
    type: 'heading',
    headingLevel: 1,
    title: '2. 相关工作',
    content: '2. 相关工作',
  },
  {
    id: 'block-related-work',
    type: 'paragraph',
    title: '2.1 传统图像分类方法',
    content:
      '传统的图像分类方法主要基于手工设计的特征提取器和机器学习算法。局部二值模式（LBP）、尺度不变特征变换（SIFT）等特征描述子在早期图像分类任务中取得了一定的效果。',
    citations: [{ id: 'cite-sift', label: '[2]', referenceId: 'ref-resnet' }],
    keywords: ['LBP', 'SIFT', '机器学习算法'],
  },
  {
    id: 'block-cnn',
    type: 'paragraph',
    title: '2.2 深度学习方法',
    content:
      '以 AlexNet 为代表的深度卷积网络显著推动了图像分类性能提升。随后，残差连接、密集连接和注意力机制进一步缓解了深层网络训练困难，提高了特征表达能力。',
    citations: [
      { id: 'cite-alexnet-2', label: '[1]', referenceId: 'ref-alexnet' },
      { id: 'cite-resnet', label: '[3]', referenceId: 'ref-resnet' },
    ],
    keywords: ['AlexNet', '残差连接', '注意力机制'],
  },
]

export const aiSuggestion: DocumentSuggestion = {
  id: 'suggestion-v3-2-methods',
  title: '传统方法段落优化',
  summary: '我已经分析了您的文档，并对相关内容进行了优化和扩展。',
  targetBlockIds: ['block-related-work', 'block-intro-2', 'block-cnn'],
  operation: 'replace_blocks',
  beforeBlocks: documentBlocks.filter(block => ['block-related-work', 'block-intro-2', 'block-cnn'].includes(block.id)),
  afterBlocks: documentBlocks
    .filter(block => ['block-related-work', 'block-intro-2', 'block-cnn'].includes(block.id))
    .map(block => {
      if (block.id === 'block-related-work') {
        return {
          ...block,
          content:
            '传统的图像分类方法主要依赖于手工设计的特征提取器结合传统机器学习算法进行特征表示和分类。例如，局部二值模式（LBP）、尺度不变特征变换（SIFT）、方向梯度直方图（HOG）等特征描述子在早期图像分类任务中取得了一定效果，但在复杂场景下的泛化能力有限。',
        }
      }
      if (block.id === 'block-intro-2') {
        return {
          ...block,
          content:
            '本文旨在综述近年来基于深度学习的图像分类方法，分析其发展脉络、关键技术和未来趋势，并从网络结构演进、训练数据规模、迁移学习策略与模型可解释性等维度讨论性能提升的主要原因。',
        }
      }
      return {
        ...block,
        content:
          '以 AlexNet 为代表的深度卷积网络首次在大规模图像识别任务中展现出端到端特征学习优势。随后，ResNet 的残差连接、DenseNet 的密集连接以及注意力机制进一步缓解了深层网络训练困难，提高了特征表达能力。',
      }
    }),
  reason: '补充方法示例、局限性和技术贡献，使综述结构更清晰。',
  confidence: 0.82,
  createdAt: '2026-04-30T10:30:00+08:00',
  changes: [
    {
      id: 'change-related-work',
      blockId: 'block-related-work',
      type: 'modify',
      originalText:
        '传统的图像分类方法主要基于手工设计的特征提取器和机器学习算法。局部二值模式（LBP）、尺度不变特征变换（SIFT）等特征描述子在早期图像分类任务中取得了一定的效果。',
      revisedText:
        '传统的图像分类方法主要依赖于手工设计的特征提取器结合传统机器学习算法进行特征表示和分类。例如，局部二值模式（LBP）、尺度不变特征变换（SIFT）、方向梯度直方图（HOG）等特征描述子在早期图像分类任务中取得了一定效果，但在复杂场景下的泛化能力有限。',
      reason: '补充 HOG 示例，并明确传统方法在复杂场景中的局限性。',
    },
    {
      id: 'change-intro-focus',
      blockId: 'block-intro-2',
      type: 'insert',
      originalText:
        '本文旨在综述近年来基于深度学习的图像分类方法，分析其发展脉络、关键技术和未来趋势，并讨论模型性能提升背后的数据、结构与训练策略因素。',
      revisedText:
        '本文旨在综述近年来基于深度学习的图像分类方法，分析其发展脉络、关键技术和未来趋势，并从网络结构演进、训练数据规模、迁移学习策略与模型可解释性等维度讨论性能提升的主要原因。',
      reason: '将综述范围从泛泛的因素收束为可展开的分析维度。',
    },
    {
      id: 'change-cnn-citation',
      blockId: 'block-cnn',
      type: 'modify',
      originalText:
        '以 AlexNet 为代表的深度卷积网络显著推动了图像分类性能提升。随后，残差连接、密集连接和注意力机制进一步缓解了深层网络训练困难，提高了特征表达能力。',
      revisedText:
        '以 AlexNet 为代表的深度卷积网络首次在大规模图像识别任务中展现出端到端特征学习优势。随后，ResNet 的残差连接、DenseNet 的密集连接以及注意力机制进一步缓解了深层网络训练困难，提高了特征表达能力。',
      reason: '强化模型名称与技术贡献之间的对应关系。',
    },
  ],
  reasons: [
    '原段落对传统方法的优缺点描述较短，不利于与深度学习方法形成对照。',
    '新增 HOG 和泛化能力局限，可以自然引出 CNN 的端到端特征学习优势。',
    '将后续章节的展开维度提前点明，有助于增强论文结构预期。',
  ],
  reasoningSteps: [
    '定位文档中与“传统图像分类方法”相关的段落。',
    '检查该段是否同时覆盖方法示例、技术逻辑和局限性。',
    '补充可被答辩听众快速识别的典型特征描述子。',
    '避免直接覆盖正文，将结果作为可接受或拒绝的修改建议。',
  ],
}

export const graphNodes: WorkspaceGraphNode[] = [
  {
    id: 'image-classification',
    label: '图像分类',
    type: 'core',
    description: '图像分类是计算机视觉中的基础任务，用于判断输入图像所属类别。',
    referenceIds: ['ref-alexnet', 'ref-resnet', 'ref-vit'],
    position: { x: 270, y: 210 },
  },
  {
    id: 'cnn',
    label: '卷积神经网络（CNN）',
    type: 'concept',
    description: '卷积神经网络是深度学习中最成功的模型之一，特别适用于图像分类任务。',
    referenceIds: ['ref-alexnet', 'ref-resnet', 'ref-densenet'],
    position: { x: 95, y: 70 },
  },
  {
    id: 'attention',
    label: '注意力机制',
    type: 'method',
    description: '注意力机制通过动态分配特征权重，帮助模型关注更具判别力的图像区域。',
    referenceIds: ['ref-vit'],
    position: { x: 420, y: 70 },
  },
  {
    id: 'transformer',
    label: 'Transformer',
    type: 'technology',
    description: 'Transformer 使用自注意力机制建模长距离依赖，在视觉任务中推动了 ViT 等架构的发展。',
    referenceIds: ['ref-vit'],
    position: { x: 470, y: 245 },
  },
  {
    id: 'deep-learning',
    label: '深度学习',
    type: 'concept',
    description: '深度学习通过多层神经网络自动学习层级特征，是现代图像分类方法的核心基础。',
    referenceIds: ['ref-alexnet', 'ref-resnet'],
    position: { x: 325, y: 390 },
  },
  {
    id: 'augmentation',
    label: '数据增强',
    type: 'method',
    description: '数据增强通过构造多样化训练样本提升模型鲁棒性，缓解过拟合问题。',
    referenceIds: ['ref-augment'],
    position: { x: 105, y: 390 },
  },
  {
    id: 'transfer-learning',
    label: '迁移学习',
    type: 'method',
    description: '迁移学习利用预训练模型参数加速下游任务收敛，降低标注数据需求。',
    referenceIds: ['ref-resnet'],
    position: { x: 40, y: 240 },
  },
]

export const graphEdges: WorkspaceGraphEdge[] = [
  { id: 'edge-cnn-core', source: 'cnn', target: 'image-classification', label: '提升性能' },
  { id: 'edge-attention-core', source: 'attention', target: 'image-classification', label: '应用于' },
  { id: 'edge-transformer-core', source: 'transformer', target: 'image-classification', label: '被用来' },
  { id: 'edge-deep-core', source: 'deep-learning', target: 'image-classification', label: '常用技术' },
  { id: 'edge-augment-core', source: 'augmentation', target: 'image-classification', label: '常用技术' },
  { id: 'edge-transfer-core', source: 'transfer-learning', target: 'image-classification', label: '增强' },
  { id: 'edge-attention-transformer', source: 'attention', target: 'transformer', label: '改进' },
  { id: 'edge-transfer-augment', source: 'transfer-learning', target: 'augmentation', label: '相关技术' },
]

export const workspaceMock: WorkspaceSnapshot = {
  conversations,
  documentVersions,
  documentBlocks,
  aiSuggestion,
  graphNodes,
  graphEdges,
  references,
}
