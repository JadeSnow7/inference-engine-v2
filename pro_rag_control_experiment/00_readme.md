# DeepSeek-V4-Pro RAG Control Experiment Evidence Package

## 1. 实验目的
比较同一声明模型配置下，不同知识增强方式对学术规范反馈、规范节点引用、来源回传、错误边界和工程稳定性的影响。

## 2. 实验边界
- 本实验是附录级补充对照，不替代第 5.6.1 节基于 deepseek-v4-flash 的 RQ2 主评测。
- 本实验不构成真实课堂教学效果证明。
- 默认离线 runner 不确认 provider 真实底层模型；模型声明等级为 declared_only。
- 未确认 jxfz 命中时，不写 jxfz 验证通过。

## 3. 样本来源
Using existing 20 RQ2 traceability samples; no local 60-sample source was found or claimed.

## 4. 四组配置
- G1: deepseek-v4-pro + 无 RAG / 无 KG。
- G2: deepseek-v4-pro + 本地 norm-node GraphRAG。
- G3: deepseek-v4-pro + NormNodeRetriever citation_check。
- G4: deepseek-v4-pro + 百炼应用文档来源边界记录。

## 5. 执行时间
2026-05-17T03:33:01.242891+00:00

## 6. 平台 commit hash
8ad1def

## 7. DashScope App ID
b3102617f35a4ffbab5befabebdcacc4

## 8. 是否确认 jxfz 命中
否。仅记录百炼应用文档来源回传边界，未确认 jxfz 命中。

## 9. 关键指标摘要
{
  "G1": {
    "sample_count": 20,
    "expected_reference_recall": 0.0,
    "grounded_reference_precision": 0.0,
    "hallucinated_reference_rate": 0.0,
    "reference_event_rate": 0.0,
    "source_display_rate": 0.0,
    "irrelevant_node_rate": 0.0,
    "ttfe_ms": 0.0,
    "total_latency_ms": 0.0,
    "retry_count": 0.0,
    "error_events": 0.0,
    "false_positive_rate": 0.0,
    "parse_success_rate": 1.0,
    "http_200_rate": 1.0,
    "done_true_rate": 1.0
  },
  "G2": {
    "sample_count": 20,
    "expected_reference_recall": 0.75,
    "grounded_reference_precision": 0.3,
    "hallucinated_reference_rate": 0.7,
    "reference_event_rate": 1.0,
    "source_display_rate": 1.0,
    "irrelevant_node_rate": 0.0,
    "ttfe_ms": 0.0,
    "total_latency_ms": 0.0,
    "retry_count": 0.0,
    "error_events": 0.0,
    "false_positive_rate": 0.25,
    "parse_success_rate": 1.0,
    "http_200_rate": 1.0,
    "done_true_rate": 1.0
  },
  "G3": {
    "sample_count": 20,
    "expected_reference_recall": 0.65,
    "grounded_reference_precision": 0.4333,
    "hallucinated_reference_rate": 0.5667,
    "reference_event_rate": 1.0,
    "source_display_rate": 1.0,
    "irrelevant_node_rate": 0.0,
    "ttfe_ms": 0.05,
    "total_latency_ms": 0.05,
    "retry_count": 0.0,
    "error_events": 0.0,
    "false_positive_rate": 0.25,
    "parse_success_rate": 1.0,
    "http_200_rate": 1.0,
    "done_true_rate": 1.0
  },
  "G4": {
    "sample_count": 20,
    "expected_reference_recall": 0.0,
    "grounded_reference_precision": 0.0,
    "hallucinated_reference_rate": 0.0,
    "reference_event_rate": 0.0,
    "source_display_rate": 0.0,
    "irrelevant_node_rate": 0.0,
    "ttfe_ms": 0.0,
    "total_latency_ms": 0.0,
    "retry_count": 0.0,
    "error_events": 0.0,
    "false_positive_rate": 0.0,
    "parse_success_rate": 1.0,
    "http_200_rate": 1.0,
    "done_true_rate": 1.0
  }
}

## 10. 不能用于主结论的限制说明
- Pro 与 Flash 指标不同，不能直接写 Pro 更优。
- 默认 pipeline 若混入 Flash，不能写全程 Pro。
- G3 若无结构化 references，不能写 references 稳定回传。
- 控制样本触发反馈需写入过度反馈错误分析。
