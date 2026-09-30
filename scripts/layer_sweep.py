"""Layer-wise probe accuracy (midterm talk: "which layer encodes truth most clearly?").

For every extracted layer, train LR / MM probes on cities+neg_cities (80/20,
seed 0, per-dataset centered) and evaluate on the held-out split plus three
unseen datasets (sp_en_trans, larger_than, counterfact_true_false).

Example:
    python layer_sweep.py --layers 4 8 10 12 14 16 18 20 24 28 32 36
"""

import argparse
import json
import os
import random
import sys

import matplotlib.pyplot as plt
import torch as t

REPRO_ROOT = os.path.expanduser("~/project/course-repro/geometry-of-truth")
sys.path.insert(0, REPRO_ROOT)
from probes import LRProbe, MMProbe  # noqa: E402
from utils import DataManager  # noqa: E402

TRAIN_MEDLEY = ["cities", "neg_cities"]
EVAL_EXTRA = ["sp_en_trans", "larger_than", "counterfact_true_false"]


def run(model, layers, device):
    results = {"LR": {}, "MM": {}}  # probe -> layer -> dataset -> acc
    for layer in layers:
        dm = DataManager()
        for ds in TRAIN_MEDLEY:
            dm.add_dataset(ds, model, layer, split=0.8, seed=0, center=True, device=device)
        for ds in EVAL_EXTRA:
            dm.add_dataset(ds, model, layer, split=None, center=True, device=device)
        train_acts, train_labels = dm.get("train")
        for probe_class, name in ((LRProbe, "LR"), (MMProbe, "MM")):
            probe = probe_class.from_data(train_acts, train_labels, device=device)
            accs = {}
            for ds in TRAIN_MEDLEY + EVAL_EXTRA:
                if ds in TRAIN_MEDLEY:
                    acts, labels = dm.data["val"][ds]
                    preds = probe(acts, iid=True).round() if name == "MM" else probe.pred(acts)
                else:
                    acts, labels = dm.data[ds]
                    preds = probe(acts, iid=False).round() if name == "MM" else probe.pred(acts)
                accs[ds] = (preds == labels).float().mean().item()
            results[name][str(layer)] = accs
        print(f"layer {layer}: " +
              " ".join(f"{n} val(cities+neg)={results[n][str(layer)]['cities']:.2f}/"
                       f"{results[n][str(layer)]['neg_cities']:.2f}" for n in ("LR", "MM")))
    return results


def plot(results, layers, out_prefix):
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8), constrained_layout=True)
    series = [("cities", "cities (held-out)", "o"),
              ("neg_cities", "neg_cities (held-out)", "s"),
              ("sp_en_trans", "sp_en_trans (transfer)", "^"),
              ("larger_than", "larger_than (transfer)", "d"),
              ("counterfact_true_false", "counterfact (transfer)", "v")]
    for ax, probe in zip(axes, ("LR", "MM")):
        for ds, label, marker in series:
            ys = [results[probe][str(L)][ds] for L in layers]
            ax.plot(layers, ys, marker=marker, ms=4, lw=1.2, label=label)
        ax.axvline(14, color="gray", ls=":", lw=1)
        ax.text(14.2, 0.52, "probe_layer=14", fontsize=8, color="gray")
        ax.set_xlabel("layer")
        ax.set_ylabel("accuracy")
        ax.set_ylim(0.45, 1.02)
        ax.set_title(f"{probe} probe, trained on cities+neg_cities", fontsize=10)
        ax.grid(alpha=0.3)
    axes[1].legend(loc="lower right", fontsize=8, frameon=False)
    fig.suptitle("LLaMA-2-13B: truth is most linearly accessible in middle layers", fontsize=11)
    for ext in ("pdf", "png"):
        fig.savefig(f"{out_prefix}.{ext}", dpi=300 if ext == "png" else None)
    print(f"wrote {out_prefix}.pdf/.png")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="llama-2-13b")
    p.add_argument("--layers", nargs="+", type=int,
                   default=[4, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36])
    p.add_argument("--device", default="cuda:0" if t.cuda.is_available() else "cpu")
    p.add_argument("--out-json", default=os.path.expanduser(
        "~/project/hidden-intent-monitor/hidden-intent-monitor-course/results/layer_sweep.json"))
    p.add_argument("--out-fig", default=os.path.expanduser(
        "~/project/hidden-intent-monitor/hidden-intent-monitor-course/figures/layer_sweep"))
    args = p.parse_args()

    random.seed(0)
    t.manual_seed(0)
    os.makedirs(os.path.dirname(args.out_json), exist_ok=True)
    results = run(args.model, args.layers, args.device)
    with open(args.out_json, "w") as f:
        json.dump({"model": args.model, "train_medley": TRAIN_MEDLEY,
                   "split": 0.8, "seed": 0, "results": results}, f, indent=2)
    print(f"wrote {args.out_json}")
    plot(results, args.layers, args.out_fig)
