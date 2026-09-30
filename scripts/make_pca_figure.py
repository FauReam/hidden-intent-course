"""Make the PCA "two clusters" figure (presentation 1 core figure).

Reproduces the style of Figure 1 from Marks & Tegmark, "The Geometry of Truth"
(arXiv:2310.06824): statements' last-token activations at one layer, projected
onto their top-2 principal components, colored by ground-truth label.

Reads activations produced by the geometry-of-truth repo's generate_acts.py
(layout: acts/{model}/{dataset}/layer_{L}_{batch}.pt) and writes a static
PDF+PNG for the Beamer slides (the repo's own plots are interactive plotly).

Example:
    python make_pca_figure.py \
        --acts-root ~/project/course-repro/geometry-of-truth/acts \
        --model llama-2-13b --layer 14 \
        --panels "cities+neg_cities" "sp_en_trans+neg_sp_en_trans" \
        --out ../figures/pca_two_clusters

    python make_pca_figure.py --self-test   # smoke test with random acts
"""

import argparse
import glob
import os
import tempfile

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch as t

ACTS_BATCH_SIZE = 25  # must match geometry-of-truth/utils.py


def load_acts(acts_root, model, dataset, layer, center=True):
    """Load and stack saved activations for one dataset at one layer."""
    directory = os.path.join(acts_root, model, dataset)
    files = glob.glob(os.path.join(directory, f"layer_{layer}_*.pt"))
    if not files:
        raise FileNotFoundError(f"no activations in {directory} for layer {layer}")
    n_batches = len(files)
    acts = [
        t.load(os.path.join(directory, f"layer_{layer}_{i}.pt"), map_location="cpu")
        for i in range(0, ACTS_BATCH_SIZE * n_batches, ACTS_BATCH_SIZE)
    ]
    acts = t.cat(acts, dim=0).float()
    if center:  # per-dataset centering, as in the paper's notebooks
        acts = acts - t.mean(acts, dim=0)
    return acts


def load_labels(repro_root, dataset):
    df = pd.read_csv(os.path.join(repro_root, "datasets", f"{dataset}.csv"))
    return df["label"].values, df["statement"].tolist()


def top_pcs(X, k=2, offset=0):
    """Top-k principal components of X (columns), matching utils.get_pcs."""
    X = X - t.mean(X, dim=0)
    cov = X.t() @ X / (X.shape[0] - 1)
    evals, evecs = t.linalg.eigh(cov)
    idx = t.argsort(evals, descending=True)
    return evecs[:, idx][:, offset : offset + k]


def plot_panels(panels, acts_root, repro_root, model, layer, out_prefix):
    n = len(panels)
    fig, axes = plt.subplots(1, n, figsize=(4.6 * n, 4.0), squeeze=False)
    for ax, panel in zip(axes[0], panels):
        datasets = panel.split("+")
        all_acts, all_labels = [], []
        for ds in datasets:
            acts = load_acts(acts_root, model, ds, layer, center=True)
            labels, _ = load_labels(repro_root, ds)
            all_acts.append(acts)
            all_labels.append(labels)
        acts = t.cat(all_acts)
        labels = np.concatenate(all_labels)
        pcs = top_pcs(acts, k=2)
        proj = (acts @ pcs).numpy()

        for val, name, color in [(1, "true", "#2166ac"), (0, "false", "#b2182b")]:
            mask = labels == val
            ax.scatter(proj[mask, 0], proj[mask, 1], s=6, alpha=0.45,
                       c=color, label=name, edgecolors="none")
        ax.set_xlabel("PC1")
        ax.set_ylabel("PC2")
        ax.set_title(" + ".join(datasets), fontsize=11)
        ax.set_aspect("equal", adjustable="datalim")
        ax.legend(loc="best", frameon=False, markerscale=2.5)
    fig.suptitle(f"LLaMA-2-13B layer {layer}: last-token activations, top 2 PCs", fontsize=12)
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    for ext in ("pdf", "png"):
        fig.savefig(f"{out_prefix}.{ext}", dpi=300 if ext == "png" else None)
    print(f"wrote {out_prefix}.pdf and {out_prefix}.png")


def self_test():
    """Fabricate random two-cluster activations and exercise the plot path."""
    rng = t.Generator().manual_seed(0)
    with tempfile.TemporaryDirectory() as tmp:
        acts_root = os.path.join(tmp, "acts")
        repro_root = os.path.join(tmp, "repro")
        os.makedirs(os.path.join(repro_root, "datasets"))
        direction = t.randn(64, generator=rng)
        for ds in ("cities", "neg_cities"):
            out_dir = os.path.join(acts_root, "test-model", ds)
            os.makedirs(out_dir)
            n = 50
            labels = np.array([i % 2 for i in range(n)])
            means = direction * t.tensor(labels).float().unsqueeze(1) * 3
            acts = means + 0.5 * t.randn(n, 64, generator=rng)
            t.save(acts, os.path.join(out_dir, "layer_2_0.pt"))
            pd.DataFrame({"statement": [f"s{i}." for i in range(n)],
                          "label": labels}).to_csv(
                os.path.join(repro_root, "datasets", f"{ds}.csv"), index=False)
        plot_panels(["cities+neg_cities"], acts_root, repro_root,
                    "test-model", 2, os.path.join(tmp, "selftest"))
    print("self-test OK")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--acts-root", default=os.path.expanduser(
        "~/project/course-repro/geometry-of-truth/acts"))
    p.add_argument("--repro-root", default=os.path.expanduser(
        "~/project/course-repro/geometry-of-truth"))
    p.add_argument("--model", default="llama-2-13b")
    p.add_argument("--layer", type=int, default=14,
                   help="probe_layer for llama-2-13b per the repo's config.ini")
    p.add_argument("--panels", nargs="+",
                   default=["cities+neg_cities", "sp_en_trans+neg_sp_en_trans"])
    p.add_argument("--out", default=os.path.expanduser(
        "~/project/hidden-intent-monitor/hidden-intent-monitor-course/figures/pca_two_clusters"))
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()

    if args.self_test:
        self_test()
    else:
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        plot_panels(args.panels, args.acts_root, args.repro_root,
                    args.model, args.layer, args.out)
