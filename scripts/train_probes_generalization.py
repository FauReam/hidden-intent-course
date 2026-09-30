"""Train truth probes and build the generalization matrix (presentation 2 core figure).

Reproduces Figure 5 of Marks & Tegmark, "The Geometry of Truth" (arXiv:2310.06824):
train LR / MM / CCS probes on one (medley of) dataset(s), evaluate on all others.

Protocol (from the paper and the repo's generalization.ipynb):
  - activations: last token, one layer, per-dataset mean-centered
  - train/test: random 80/20 split (seed 0); when train == test, evaluate on the
    held-out 20% and MM uses its iid (Fisher LDA) variant
  - LR: bias-free logistic regression, AdamW lr=1e-3, weight_decay=0.1, 1000 epochs
  - MM: closed-form difference of class means
  - CCS: unsupervised contrast pairs (only cities+neg_cities, larger_than+smaller_than)

Uses the repo's own probes.py / utils.py via sys.path so the probe definitions
are literally theirs, not reimplementations.

Example:
    python train_probes_generalization.py --layer 14
"""

import argparse
import json
import os
import random
import sys

import matplotlib.pyplot as plt
import numpy as np
import torch as t

REPRO_ROOT = os.path.expanduser("~/project/course-repro/geometry-of-truth")
sys.path.insert(0, REPRO_ROOT)
from probes import CCSProbe, LRProbe, MMProbe  # noqa: E402
from utils import DataManager  # noqa: E402

TRAIN_MEDLIES = [
    ["cities"],
    ["cities", "neg_cities"],
    ["larger_than"],
    ["larger_than", "smaller_than"],
]
VAL_DATASETS = [
    "cities", "neg_cities", "larger_than", "smaller_than",
    "sp_en_trans", "neg_sp_en_trans",
    "cities_cities_conj", "cities_cities_disj",
    "companies_true_false", "common_claim_true_false", "counterfact_true_false",
]
CCS_MEDLIES = [["cities", "neg_cities"], ["larger_than", "smaller_than"]]


def run(model, layer, device):
    results = {}  # probe -> medley_str -> dataset -> acc

    for probe_class in (LRProbe, MMProbe):
        name = probe_class.__name__ if hasattr(probe_class, "__name__") else str(probe_class)
        name = {"LRProbe": "LR", "MMProbe": "MM"}[probe_class.__name__]
        results[name] = {}
        for medley in TRAIN_MEDLIES:
            key = "+".join(medley)
            dm = DataManager()
            for ds in medley:
                dm.add_dataset(ds, model, layer, split=0.8, seed=0, center=True, device=device)
            for ds in VAL_DATASETS:
                if ds not in medley:
                    dm.add_dataset(ds, model, layer, split=None, center=True, device=device)
            train_acts, train_labels = dm.get("train")
            probe = probe_class.from_data(train_acts, train_labels, device=device)
            accs = {}
            for ds in VAL_DATASETS:
                if ds in medley:
                    acts, labels = dm.data["val"][ds]
                    preds = probe(acts, iid=True).round() if probe_class is MMProbe else probe.pred(acts)
                else:
                    acts, labels = dm.data[ds]
                    preds = probe(acts, iid=False).round() if probe_class is MMProbe else probe.pred(acts)
                accs[ds] = (preds == labels).float().mean().item()
            results[name][key] = accs
            print(f"{name} train={key}: " +
                  " ".join(f"{d}={a:.2f}" for d, a in accs.items()))

    results["CCS"] = {}
    for medley in CCS_MEDLIES:
        key = "+".join(medley)
        dm = DataManager()
        for ds in medley:
            dm.add_dataset(ds, model, layer, split=0.8, seed=0, center=True, device=device)
        for ds in VAL_DATASETS:
            if ds not in medley:
                dm.add_dataset(ds, model, layer, split=None, center=True, device=device)
        train_acts, train_labels = dm.data["train"][medley[0]]
        train_neg_acts, _ = dm.data["train"][medley[1]]
        probe = CCSProbe.from_data(train_acts, train_neg_acts, train_labels, device=device)
        accs = {}
        for ds in VAL_DATASETS:
            if ds in medley:
                acts, labels = dm.data["val"][ds]
            else:
                acts, labels = dm.data[ds]
            accs[ds] = (probe.pred(acts) == labels).float().mean().item()
        results["CCS"][key] = accs
        print(f"CCS train={key}: " + " ".join(f"{d}={a:.2f}" for d, a in accs.items()))

    return results


def plot_matrix(results, out_prefix):
    probes = ["LR", "MM", "CCS"]
    medlies = ["+".join(m) for m in TRAIN_MEDLIES]
    fig, axes = plt.subplots(1, 3, figsize=(13.5, 4.2), constrained_layout=True)
    for ax, probe in zip(axes, probes):
        rows = [m for m in medlies if m in results[probe]]
        mat = np.array([[results[probe][m][ds] for ds in VAL_DATASETS] for m in rows])
        im = ax.imshow(mat, vmin=0.5, vmax=1.0, cmap="viridis", aspect="auto")
        ax.set_xticks(range(len(VAL_DATASETS)))
        ax.set_xticklabels(VAL_DATASETS, rotation=45, ha="right", fontsize=8)
        ax.set_yticks(range(len(rows)))
        ax.set_yticklabels(rows, fontsize=8)
        ax.set_title(f"{probe} probe", fontsize=11)
        for i in range(len(rows)):
            for j in range(len(VAL_DATASETS)):
                ax.text(j, i, f"{mat[i, j]:.2f}", ha="center", va="center",
                        fontsize=6.5, color="white" if mat[i, j] < 0.8 else "black")
    fig.colorbar(im, ax=axes, shrink=0.8, label="accuracy")
    fig.suptitle("Train on rows, test on columns (LLaMA-2-13B)", fontsize=12)
    for ext in ("pdf", "png"):
        fig.savefig(f"{out_prefix}.{ext}", dpi=300 if ext == "png" else None)
    print(f"wrote {out_prefix}.pdf/.png")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="llama-2-13b")
    p.add_argument("--layer", type=int, default=14)
    p.add_argument("--device", default="cuda:0" if t.cuda.is_available() else "cpu")
    p.add_argument("--out-json", default=os.path.expanduser(
        "~/project/hidden-intent-monitor/hidden-intent-monitor-course/results/generalization.json"))
    p.add_argument("--out-fig", default=os.path.expanduser(
        "~/project/hidden-intent-monitor/hidden-intent-monitor-course/figures/generalization_matrix"))
    args = p.parse_args()

    random.seed(0)
    t.manual_seed(0)
    os.makedirs(os.path.dirname(args.out_json), exist_ok=True)
    results = run(args.model, args.layer, args.device)
    with open(args.out_json, "w") as f:
        json.dump({"model": args.model, "layer": args.layer,
                   "split": 0.8, "seed": 0, "results": results}, f, indent=2)
    print(f"wrote {args.out_json}")
    plot_matrix(results, args.out_fig)
