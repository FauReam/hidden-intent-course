"""Label-change intervention along the truth direction (final talk, core result).

Reproduces Figure 7 of Marks & Tegmark, "The Geometry of Truth" (arXiv:2310.06824)
with plain transformers forward hooks (the repo's interventions.py depends on the
old nnsight API / NDIF remote, same situation as generate_acts.py).

Protocol (from the repo's interventions.py, same hyperparameters):
  - direction: LR probe trained on cities+neg_cities at probe_layer (14),
    normalized, then scaled by the class-mean separation along itself
  - intervention sites: layers intervene_layer..probe_layer (8..14), at the two
    tokens around the statement's final period (offset -1 = before, 0 = period)
  - query: few-shot prompt + statement + " This statement is:"
  - readout: P(TRUE) - P(FALSE) at the last position
  - conditions: true statements x {none, subtract}; false statements x {none, add}
    (adding the direction should flip false -> true, subtracting flips true -> false)

Example:
    python intervention_label_flip.py --device cuda:0
"""

import argparse
import json
import os
import sys

import matplotlib.pyplot as plt
import pandas as pd
import torch as t
from transformers import AutoModelForCausalLM, AutoTokenizer

REPRO_ROOT = os.path.expanduser("~/project/course-repro/geometry-of-truth")
sys.path.insert(0, REPRO_ROOT)
from probes import LRProbe  # noqa: E402
from utils import collect_acts  # noqa: E402

PROMPT = """\
The Spanish word 'jirafa' means 'giraffe'. This statement is: TRUE
The Spanish word 'escribir' means 'to write'. This statement is: TRUE
The Spanish word 'gato' means 'cat'. This statement is: TRUE
The Spanish word 'aire' means 'silver'. This statement is: FALSE
"""

INTERVENE_LAYER = 8   # config.ini [llama-2-13b] intervene_layer
PROBE_LAYER = 14      # config.ini [llama-2-13b] probe_layer


def build_direction(model_name, device):
    acts = t.cat([collect_acts(ds, model_name, PROBE_LAYER).to(device)
                  for ds in ("cities", "neg_cities")])
    labels = t.cat([t.Tensor(pd.read_csv(os.path.join(REPRO_ROOT, "datasets", f"{ds}.csv"))["label"].tolist()).to(device)
                    for ds in ("cities", "neg_cities")])
    probe = LRProbe.from_data(acts, labels, device=device)
    direction = probe.direction
    diff = ((acts[labels == 1].mean(0) - acts[labels == 0].mean(0)) @ direction)
    direction = diff * direction / direction.norm()
    return direction.detach()


def run_condition(model, tokenizer, queries, direction, intervention, device, batch_size=32):
    assert intervention in ("none", "add", "subtract")
    true_idx = tokenizer.encode(" TRUE", add_special_tokens=False)[-1]
    false_idx = tokenizer.encode(" FALSE", add_special_tokens=False)[-1]
    len_suffix = len(tokenizer.encode("This statement is:"))  # matches repo quirk (incl. BOS)

    layers = list(range(INTERVENE_LAYER, PROBE_LAYER + 1))
    sign = {"add": 1.0, "subtract": -1.0}.get(intervention, 0.0)
    d = direction.to(device=device, dtype=model.dtype)

    def make_hook():
        def hook(module, inputs, output):
            h = output[0] if isinstance(output, tuple) else output
            if sign == 0.0:
                return
            lens = hook.attention_mask.sum(1)  # right padding
            for b in range(h.shape[0]):
                for offset in (-1, 0):
                    pos = int(lens[b].item()) - len_suffix + offset
                    h[b, pos, :] += sign * d
        return hook

    hooks = []
    p_diffs, tots = [], []
    with t.no_grad():
        for start in range(0, len(queries), batch_size):
            batch = queries[start:start + batch_size]
            enc = tokenizer(batch, return_tensors="pt", padding=True,
                            add_special_tokens=True).to(device)
            hook = make_hook()
            hook.attention_mask = enc["attention_mask"]
            handles = [model.model.layers[L].register_forward_hook(hook) for L in layers]
            logits = model(**enc).logits[:, -1, :]
            for hd in handles:
                hd.remove()
            probs = logits.float().softmax(-1)
            p_diffs.append(probs[:, true_idx] - probs[:, false_idx])
            tots.append(probs[:, true_idx] + probs[:, false_idx])
    return t.cat(p_diffs).mean().item(), t.cat(tots).mean().item()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--hf-id", default="NousResearch/Llama-2-13b-hf")
    p.add_argument("--model", default="llama-2-13b")
    p.add_argument("--val-dataset", default="sp_en_trans")
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--device", default="cuda:0" if t.cuda.is_available() else "cpu")
    p.add_argument("--out-json", default=os.path.expanduser(
        "~/project/hidden-intent-monitor/hidden-intent-monitor-course/results/intervention.json"))
    p.add_argument("--out-fig", default=os.path.expanduser(
        "~/project/hidden-intent-monitor/hidden-intent-monitor-course/figures/intervention_label_flip"))
    args = p.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.hf_id)
    tokenizer.padding_side = "right"
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.hf_id, dtype=t.bfloat16)
    model = model.to(args.device).eval()

    print("building truth direction (LR probe on cities+neg_cities, layer 14) ...")
    direction = build_direction(args.model, args.device)

    df = pd.read_csv(os.path.join(REPRO_ROOT, "datasets", f"{args.val_dataset}.csv"))
    results = {}
    for subset, interventions in (("true", ("none", "subtract")),
                                  ("false", ("none", "add"))):
        statements = df[df["label"] == (1 if subset == "true" else 0)]["statement"].tolist()
        queries = [PROMPT + s + " This statement is:" for s in statements]
        for cond in interventions:
            p_diff, tot = run_condition(model, tokenizer, queries, direction, cond, args.device,
                                        batch_size=args.batch_size)
            results[f"{subset}_{cond}"] = {"p_diff": p_diff, "p_sum": tot, "n": len(queries)}
            print(f"{subset:5s} {cond:8s}: P(TRUE)-P(FALSE) = {p_diff:+.3f}  "
                  f"P(TRUE)+P(FALSE) = {tot:.3f}  (n={len(queries)})")

    os.makedirs(os.path.dirname(args.out_json), exist_ok=True)
    with open(args.out_json, "w") as f:
        json.dump({"model": args.hf_id, "val_dataset": args.val_dataset,
                   "intervene_layers": [INTERVENE_LAYER, PROBE_LAYER],
                   "results": results}, f, indent=2)
    print(f"wrote {args.out_json}")

    fig, ax = plt.subplots(figsize=(5.2, 3.6))
    groups = [("true_none", "true stmts\nno intervention", "#2166ac"),
              ("true_subtract", "true stmts\nsubtract direction", "#b2182b"),
              ("false_none", "false stmts\nno intervention", "#b2182b"),
              ("false_add", "false stmts\nadd direction", "#2166ac")]
    xs = range(len(groups))
    vals = [results[k]["p_diff"] for k, _, _ in groups]
    ax.bar(xs, vals, color=[c for _, _, c in groups], width=0.62)
    ax.axhline(0, color="black", lw=0.8)
    lo, hi = min(vals), max(vals)
    ax.set_ylim(lo - 0.12 * (hi - lo) - 0.01, hi + 0.12 * (hi - lo) + 0.01)
    for x, v in zip(xs, vals):
        ax.text(x, v / 2, f"{v:+.2f}", ha="center", va="center",
                fontsize=10, color="white", fontweight="bold")
    ax.set_xticks(list(xs))
    ax.set_xticklabels([lab for _, lab, _ in groups], fontsize=8.5)
    ax.set_ylabel("P(TRUE) - P(FALSE)")
    ax.set_title(f"Intervening on the truth direction flips the label\n"
                 f"(LLaMA-2-13B, layers {INTERVENE_LAYER}-{PROBE_LAYER}, {args.val_dataset})",
                 fontsize=10)
    fig.tight_layout()
    for ext in ("pdf", "png"):
        fig.savefig(f"{args.out_fig}.{ext}", dpi=300 if ext == "png" else None)
    print(f"wrote {args.out_fig}.pdf/.png")


if __name__ == "__main__":
    main()
