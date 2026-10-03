"""Text-only baseline: TF-IDF + logistic regression on the raw statement strings.

Midterm analysis (presentation 2): can a classifier that only reads the text
surface — never the model's activations — separate true from false as well as
the activation probes? Complements results/generalization.json (LR/MM/CCS on
LLaMA-2-13B layer-14 activations) under the same train/test protocol:
  - same train medleys (cities, cities+neg_cities, larger_than, larger_than+smaller_than)
  - same 80/20 split as utils.DataManager (torch manual_seed(0),
    randperm(n) < int(0.8*n)) so the held-out sets are identical
  - transfer evaluated on the full target dataset; same-dataset on the held-out 20%

Deliberately untuned: default sklearn logistic regression, word 1–2 gram
TF-IDF. This is a baseline, not a competitor.

Example:
    python text_baseline.py
"""

import json
import os

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch as t
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

DATASETS_DIR = os.path.expanduser("~/project/course-repro/geometry-of-truth/datasets")
COURSE = os.path.expanduser("~/project/hidden-intent-monitor/hidden-intent-monitor-course")

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
SHORT = {
    "cities": "cities", "neg_cities": "neg_cities",
    "larger_than": "larger", "smaller_than": "smaller",
    "sp_en_trans": "sp_en", "neg_sp_en_trans": "neg_sp_en",
    "cities_cities_conj": "conj", "cities_cities_disj": "disj",
    "companies_true_false": "companies", "common_claim_true_false": "common",
    "counterfact_true_false": "counterfact",
}


def load(name):
    df = pd.read_csv(os.path.join(DATASETS_DIR, f"{name}.csv"))
    return df["statement"].tolist(), df["label"].values.astype(int)


def split_mask(n, split=0.8, seed=0):
    # identical to utils.DataManager.add_dataset
    t.manual_seed(seed)
    return t.randperm(n) < int(split * n)


def run():
    texts, labels, train_mask = {}, {}, {}
    for ds in VAL_DATASETS:
        texts[ds], labels[ds] = load(ds)
        train_mask[ds] = split_mask(len(texts[ds])).numpy()

    results = {}
    for tag, vec in [("text-LR", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
                     # preempt "did you try harder features": char 3–5-grams can
                     # memorize surface quirks but still cannot pair a subject
                     # with the right predicate — expected to stay at chance
                     ("text-LR-char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5),
                                                    min_df=2, sublinear_tf=True))]:
        results[tag] = {}
        for medley in TRAIN_MEDLIES:
            key = "+".join(medley)
            x_train = [s for ds in medley for s, m in zip(texts[ds], train_mask[ds]) if m]
            y_train = np.concatenate([labels[ds][train_mask[ds]] for ds in medley])

            v = vec.__class__(**vec.get_params())
            clf = LogisticRegression(max_iter=5000)
            clf.fit(v.fit_transform(x_train), y_train)

            accs = {}
            for ds in VAL_DATASETS:
                if ds in medley:
                    idx = ~train_mask[ds]  # held-out 20%
                else:
                    idx = np.ones(len(texts[ds]), dtype=bool)  # full dataset
                pred = clf.predict(v.transform([s for s, m in zip(texts[ds], idx) if m]))
                accs[ds] = float((pred == labels[ds][idx]).mean())
            results[tag][key] = accs
            print(f"{tag} train={key}: " + " ".join(f"{SHORT[d]}={a:.2f}" for d, a in accs.items()))
    return results


def plot(text_results, out_prefix):
    gen = json.load(open(os.path.join(COURSE, "results/generalization.json")))["results"]
    panels = [("cities", "trained on cities"), ("cities+neg_cities", "trained on cities + neg_cities")]
    fig, axes = plt.subplots(1, 2, figsize=(12.5, 4.3), constrained_layout=True)
    for ax, (medley, subtitle) in zip(axes, panels):
        act = gen["LR"][medley]
        txt = text_results["text-LR"][medley]
        x = np.arange(len(VAL_DATASETS))
        w = 0.38
        ax.bar(x - w / 2, [act[d] for d in VAL_DATASETS], w,
               label="activation probe (LR, layer 14)", color="#3aa7d9")
        ax.bar(x + w / 2, [txt[d] for d in VAL_DATASETS], w,
               label="text baseline (TF-IDF + LR)", color="#f5b942")
        ax.axhline(0.5, color="gray", lw=0.8, ls="--")
        ax.set_xticks(x)
        ax.set_xticklabels([SHORT[d] for d in VAL_DATASETS], rotation=40, ha="right", fontsize=8.5)
        ax.set_ylim(0, 1.05)
        ax.set_title(subtitle, fontsize=11)
        ax.set_ylabel("accuracy")
        ax.legend(fontsize=8.5, loc="lower left")
    fig.suptitle("Reading the model's mind vs reading the text — same split, same datasets", fontsize=12)
    for ext in ("pdf", "png"):
        fig.savefig(f"{out_prefix}.{ext}", dpi=300 if ext == "png" else None)
    print(f"wrote {out_prefix}.pdf/.png")


if __name__ == "__main__":
    text_results = run()
    out_json = os.path.join(COURSE, "results/text_baseline.json")
    with open(out_json, "w") as f:
        json.dump({"features": {"text-LR": "tfidf word (1,2) min_df=2 sublinear",
                                "text-LR-char": "tfidf char_wb (3,5) min_df=2 sublinear"},
                   "classifier": "sklearn LogisticRegression(max_iter=5000, C=1.0)",
                   "split": 0.8, "seed": 0, "results": text_results}, f, indent=2)
    print(f"wrote {out_json}")
    plot(text_results, os.path.join(COURSE, "figures/text_baseline"))
