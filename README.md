# 模型知道，但不一定说：课程展示

> CSI-435/535 Artificial Intelligence（Fall 2026）课程项目。三次演讲，每次 10–12 分钟。

## 定位

复现两篇已发表、有公开代码和模型的重要工作，用课上学的方法把它们讲清楚。这里的所有结果都是复现，每一处都注明原论文。

| | 论文 | 复现什么 | 课程内容 |
|---|---|---|---|
| 复现 A（主） | Marks & Tegmark，[The Geometry of Truth](https://arxiv.org/abs/2310.06824)（COLM 2024） | 真假陈述在激活里分成两团；探针跨数据集泛化；沿真理方向干预让模型改口 | PCA、逻辑回归、均值差探针 |
| 复现 B（副） | Cywiński 等，[Eliciting Secret Knowledge from Language Models](https://arxiv.org/abs/2510.01070) | Taboo 模型知道秘密词却不说，用 logit lens 从中间层读出来 | Transformer 的层结构 |

## 文件

| 文件 | 内容 |
|---|---|
| [plan.md](plan.md) | 两个复现的步骤、模型、硬件、成功标准、优先级 |
| [timeline.md](timeline.md) | 到 12 月 7 日的按周计划 |
| [presentations.md](presentations.md) | 三次演讲的逐页大纲（带时长）和问答准备 |
| [scripts/](scripts/) | 自己的复现脚本：激活抽取、DGX 部署、PCA 图、探针+泛化矩阵（复现仓库克隆在本仓库外） |
| [slides/](slides/) | 三次演讲的 Beamer slides（英文）+ 中文讲稿 |
| [paper/](paper/) | NeurIPS 2025 格式的复现报告（英文，随结果补充） |
| [present/](present/) | HTML 演讲界面：中间窗口展示论文 PDF 并随场景自动滚动；双击 `index.html` 即可用，按 S 出中文讲稿 |

## 参与

组员可以直接 push；其他人欢迎提 Issue 或 Pull Request。
