# 模型知道，但不一定说：课程展示

> CSI-435/535 Artificial Intelligence（Fall 2026）课程项目。三次演讲，每次 10–12 分钟。

## 定位

前期复现两篇已发表、有公开代码和模型的重要工作，用课上学的方法把它们讲清楚；后续增加自研的 Emergent Misalignment（EM）行为监控实验。复现结果与自研结果分别标注，不把所有内容都称为复现。

| | 论文 / 来源 | 做什么 | 课程内容 |
|---|---|---|---|
| 复现 A（主） | Marks & Tegmark，[The Geometry of Truth](https://arxiv.org/abs/2310.06824)（COLM 2024） | 真假陈述在激活里分成两团；探针跨数据集泛化；沿真理方向干预让模型改口 | PCA、逻辑回归、均值差探针 |
| 复现 B（副） | Cywiński 等，[Eliciting Secret Knowledge from Language Models](https://arxiv.org/abs/2510.01070) | Taboo 模型知道秘密词却不说，用 logit lens 从中间层读出来 | Transformer 的层结构 |
| 自研 C（EM 行为监控） | Turner 等，[Model Organisms for Emergent Misalignment](https://arxiv.org/abs/2506.11613)；Soligo 等，[Convergent Linear Representations of EM](https://arxiv.org/abs/2506.11618) | 在普通问题下真实生成恶意/失配回答；在同一个 EM 模型内训练 early/response 线性探针；基座误报、文本对照和新问题泛化 | 逻辑回归、激活监测、泛化、阈值校准 |

EM 检测目标是 **misaligned behaviour**，不是未经信念验证就声称模型“知道自己在撒谎”。

## 文件

| 文件 | 内容 |
|---|---|
| [plan.md](plan.md) | 复现与自研实验的步骤、模型、硬件、成功标准和修正记录 |
| [timeline.md](timeline.md) | 到 12 月 7 日的按周计划与执行记录 |
| [presentations.md](presentations.md) | 三次演讲的逐页大纲（带时长）和问答准备 |
| [scripts/](scripts/) | 复现脚本，以及 `em_generate.py`（真实生成+激活）、`em_probe.py`（盲审/探针/评估）、`em_reextract.py`（采集修正）、`em_monitor.py`（单条真机监控） |
| [data/em_prompts.json](data/em_prompts.json) | EM 开发/测试问题、模型版本、生成与盲审协议 |
| [figures/](figures/) | 复现与自研实验的静态图（PDF+PNG），slides 直接引用 |
| [results/](results/) | 数值结果、真实生成记录、盲审标签、探针和冻结元数据 |
| [slides/](slides/) | 三次演讲的 Beamer slides（英文）+ 中文讲稿 |
| [paper/](paper/) | NeurIPS 2025 格式的复现报告（英文，随结果补充） |
| [present/](present/) | 初始演讲 HTML 界面：中间窗口展示论文 PDF 并随场景自动滚动；双击 `index.html` 即可用，按 S 出中文讲稿 |
| [present2/](present2/) | 中期演讲 HTML 界面（11 场景，含真实生成/检测演示）+ 全英文 `script.html` 讲稿 |
| [present3/](present3/) | 期末演讲 HTML 界面（10 场景：因果干预、Taboo 藏词、监控器演示）+ `script.html` 讲稿 + `monitor.html` Hidden-Intent Monitor 现场演示页 |

## 参与

组员可以直接 push；其他人欢迎提 Issue 或 Pull Request。
