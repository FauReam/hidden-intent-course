"""Midterm analysis figures from results/generalization.json (no new model runs).

1. negation_split: probes trained on affirmative statements collapse on
   negated ones; adding negated pairs to training — or dropping labels
   entirely (CCS) — fixes it. Presentation 2's "interesting finding" page.
2. ccs_vs_supervised: unsupervised CCS (contrast pairs, no labels) tracks the
   supervised LR/MM probes across all 11 datasets — the monitor needs no
   labels. Presentation 2's CCS page.

Example:
    python analysis_figures.py
"""

import json
import os

import matplotlib.pyplot as plt
import numpy as np

COURSE = os.path.expanduser("~/project/hidden-intent-monitor/hidden-intent-monitor-course")

VAL_DATASETS = [
    "cities", "neg_cities", "larger_than", "smaller_than",
    "sp_en_trans", "neg_sp_en_trans",
    "cities_cities_conj", "cities_cities_disj",
    "companies_true_false", "common_claim_true_false", "counterfact_true_false",
]
SHORT = {
    "cities": "cities", "neg_cities": "neg_cities",
    "larger_than": "larger", "smaller_than": "smaller",
    "sp_en_trans": "sp_en", "neg_sp_en_trans": "neg_sp_en",
    "cities_cities_conj": "conj", "cities_cities_disj": "disj",
    "companies_true_false": "companies", "common_claim_true_false": "common",
    "counterfact_true_false": "counterfact",
}


def negation_split(gen, out_prefix):
    datasets = ["cities", "neg_cities", "sp_en_trans", "neg_sp_en_trans"]
    series = [
        ("LR · trained on cities", gen["LR"]["cities"], "#3aa7d9"),
        ("MM · trained on cities", gen["MM"]["cities"], "#7ce3a8"),
        ("LR · trained on cities+neg", gen["LR"]["cities+neg_cities"], "#f5b942"),
        ("CCS · no labels (cities+neg pairs)", gen["CCS"]["cities+neg_cities"], "#c792ff"),
    ]
    fig, ax = plt.subplots(figsize=(9.5, 4.4), constrained_layout=True)
    x = np.arange(len(datasets))
    w = 0.2
    for i, (label, accs, color) in enumerate(series):
        bars = ax.bar(x + (i - 1.5) * w, [accs[d] for d in datasets], w, label=label, color=color)
        for b, d in zip(bars, datasets):
            ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.015, f"{accs[d]:.2f}",
                    ha="center", fontsize=7.5)
    ax.axhline(0.5, color="gray", lw=0.8, ls="--")
    ax.text(3.42, 0.515, "chance", fontsize=8, color="gray")
    ax.set_xticks(x)
    ax.set_xticklabels(datasets, fontsize=10)
    ax.set_ylim(0, 1.12)
    ax.set_ylabel("accuracy")
    ax.set_title("Negation moves statements off the training manifold — adding neg pairs (or dropping labels) fixes it",
                 fontsize=11)
    ax.legend(fontsize=8.5, ncol=2, loc="lower left")
    for ext in ("pdf", "png"):
        fig.savefig(f"{out_prefix}.{ext}", dpi=300 if ext == "png" else None)
    print(f"wrote {out_prefix}.pdf/.png")


def ccs_vs_supervised(gen, out_prefix):
    series = [
        ("LR · supervised", gen["LR"]["cities+neg_cities"], "#3aa7d9"),
        ("MM · supervised", gen["MM"]["cities+neg_cities"], "#7ce3a8"),
        ("CCS · no labels", gen["CCS"]["cities+neg_cities"], "#f5b942"),
    ]
    fig, ax = plt.subplots(figsize=(11.5, 4.2), constrained_layout=True)
    x = np.arange(len(VAL_DATASETS))
    w = 0.27
    for i, (label, accs, color) in enumerate(series):
        ax.bar(x + (i - 1) * w, [accs[d] for d in VAL_DATASETS], w, label=label, color=color)
    ax.axhline(0.5, color="gray", lw=0.8, ls="--")
    ax.set_xticks(x)
    ax.set_xticklabels([SHORT[d] for d in VAL_DATASETS], rotation=35, ha="right", fontsize=9)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("accuracy")
    ax.set_title("All trained on cities + neg_cities — CCS sees no labels, only statement/negation pairs", fontsize=11)
    ax.legend(fontsize=9, loc="lower left")
    for ext in ("pdf", "png"):
        fig.savefig(f"{out_prefix}.{ext}", dpi=300 if ext == "png" else None)
    print(f"wrote {out_prefix}.pdf/.png")


if __name__ == "__main__":
    gen = json.load(open(os.path.join(COURSE, "results/generalization.json")))["results"]
    negation_split(gen, os.path.join(COURSE, "figures/negation_split"))
    ccs_vs_supervised(gen, os.path.join(COURSE, "figures/ccs_vs_supervised"))
