# 读出模型没说出口的想法：课程展示

> CSI-435/535 Artificial Intelligence（Fall 2026）课程项目。

## 一句话主题

**"模型心里想的，和它写出来的，不一定一样。我们用课上学的方法，把它心里想的读出来。"**

## 定位

用小模型、小数据，在一台 M1 Max 上**小规模复现几个已有的代表性发现**，每一项都对应课上学的方法。这里的复现是教学演示，每一处都注明原论文。

| 编号 | 复现什么 | 课程内容 |
|---|---|---|
| K1 | Ouro 循环轮数的影响；逐轮读出"用了提示却不说" | 逻辑回归、SVM、PCA |
| K2 | Taboo 模型的秘密词，从中间层读出来 | logit lens |
| K3 | 监控器阶梯：TF-IDF → ModernBERT；LSTM / CNN 序列探针 | 朴素贝叶斯、RNN、CNN、微调 |
| K4 | 反面教材：微调指纹 | PCA、K-means、GMM |

## 文件

| 文件 | 内容 |
|---|---|
| [plan.md](plan.md) | 四个小复现：复现什么、怎么做、对应哪节课、成功标准、硬件 |
| [timeline.md](timeline.md) | 到 12 月 7 日的按周计划 |
| [presentations.md](presentations.md) | 三次演讲的大纲和问答准备 |

## 参与

组员可以直接 push；其他人欢迎提 Issue 或 Pull Request。
