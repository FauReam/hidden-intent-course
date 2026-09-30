# 课程展示计划：复现两篇已发表的研究

> 原则：**只复现已经发表、有公开代码和模型的工作**，结果稳定能出；每次演讲 10–12 分钟，只讲一两个清楚的现象。
> 主线故事：**"模型知道，但不一定说。"**
> - 复现 A：模型"知道"一句话是真是假，这个知识在激活里是一条直线方向（Geometry of Truth）。
> - 复现 B：模型被训练成"知道一个秘密词但绝不说"，我们从激活里把它读出来（Taboo）。

## 总览

| | 复现 A（主） | 复现 B（副） |
|---|---|---|
| 论文 | Marks & Tegmark，[The Geometry of Truth 2310.06824](https://arxiv.org/abs/2310.06824)（COLM 2024） | Cywiński 等，[Eliciting Secret Knowledge from Language Models 2510.01070](https://arxiv.org/abs/2510.01070) |
| 代码 | [saprmarks/geometry-of-truth](https://github.com/saprmarks/geometry-of-truth)（生成激活、探针、干预、画图都有现成脚本） | [cywinski/eliciting-secret-knowledge](https://github.com/cywinski/eliciting-secret-knowledge)（logit lens 等方法都有现成脚本） |
| 数据 / 模型 | 仓库自带的真假陈述数据集（cities、neg_cities 等）；LLaMA-2 | 作者发布的 Taboo 模型（Gemma-2-9B + 适配器，每个模型藏一个秘密词） |
| 要复现的核心图 | ① PCA 投影后真假陈述分成两团；② 探针跨数据集泛化；③ 沿"真理方向"干预，能让模型改口 | 中间层的 logit lens 里，秘密词排名靠前；top-k 命中率 |
| 对应课程内容 | PCA、逻辑回归、均值差探针（和 Fisher 线性判别同一思路）、泛化 | 逻辑回归（可选的"概念方向"加分项）、Transformer 的层结构 |
| 为什么稳定 | 经典结果，后续大量工作都复现过；只需要前向传播，不需要训练大模型 | 模型和脚本都是作者发布的；只需要推理 |

---

## 复现 A：The Geometry of Truth

**步骤**（全部用仓库脚本，只改模型名和设备）
1. 用 `generate_acts.py` 对 cities、neg_cities、sp_en_trans 等数据集抽取激活（每条陈述只取最后一个 token，几层即可）。
2. 用 `dataexplorer.ipynb` 画 PCA：真陈述和假陈述在前两个主成分上分成两团。**这是初始演讲的核心图。**
3. 用 `probes.py` 和 `generalization.ipynb` 训练逻辑回归探针和均值差探针，在 A 数据集上训练、在 B 数据集上测试，画泛化矩阵。**这是中期演讲的核心图。**
4. 用 `interventions.py` 沿真理方向加减一个向量，看模型对"这句话是真的吗"的回答是否跟着翻转。**这是期末演讲的核心结果。**

**模型选择**
- 仓库默认是 LLaMA-2-13B（bf16 约 26GB）。论文还有其他规模，具体用了哪些**待读原文核实**。
- 方案 1（首选）：在 DGX 上用 13B 跑一次，和论文设置完全一致；只做前向传播，几小时内完成。
- 方案 2：在 M1 上用 LLaMA-2-7B（约 14GB，PyTorch MPS）。
- 激活文件很小（几千条陈述 × 几层 × 5120 维），拿回 M1 上训练探针和画图。

**成功标准**：三张图（PCA、泛化矩阵、干预结果）都和论文里的对应图趋势一致。

## 复现 B：Taboo 秘密词

**步骤**
1. 下载作者发布的 3–5 个 Taboo 模型（不同秘密词）。
2. 用仓库里 logit lens 的脚本：让模型给出关于秘密词的提示（它不会说出这个词），在每一层把隐状态投到词表上，看秘密词的排名。
3. 画"层数 × 秘密词排名"的热力图；报告 top-1 / top-5 命中率。
4. 期末现场演示：输入一个问题，屏幕上显示模型的回答和中间层"心里"排前几名的词。

**硬件**：Gemma-2-9B bf16 约 18GB。先在 M1 上用 PyTorch MPS 试（需要把 GPU 可用内存上限调到约 26GB）；不行就在 DGX 上跑，现场演示改成预先录好的结果。

**成功标准**：热力图里秘密词在中间层明显靠前；命中率和论文报告的量级一致。

## 可选加分

- **文字基线**：用 TF-IDF + 逻辑回归（或 11 月 9 日课上的 ModernBERT）只读陈述文本判断真假，和探针比较，说明"探针读的是模型的知识，不是文字表面"。
- **聚类**：在复现 A 的激活上做 K-means / GMM，看不用标签能否自然分出真假。

## 优先级

1. 复现 A 的第 1、2 步（必做，最稳定）；
2. 复现 A 的第 3 步；
3. 复现 B；
4. 复现 A 的第 4 步（干预）；
5. 可选加分。

## 环境

- 两个仓库各建一个独立的 Python 环境，按各自的 requirements 锁定版本。
- LLaMA-2 和 Gemma-2 都要先在 Hugging Face 上接受许可协议。
