"""Extract last-token residual-stream activations with plain transformers.

Replacement for the geometry-of-truth repo's generate_acts.py (which depends
on an old nnsight API). Saves the exact same layout so the repo's notebooks
and utils keep working:

    {repro_root}/acts/{model_name}/{dataset}/layer_{L}_{batch_start}.pt

each file a (batch, hidden) bfloat16 tensor, rows in CSV order, batches of 25.

Last-token position is taken via the attention mask (right padding), i.e. the
final real token of each statement, matching the paper's protocol.

Example (DGX):
    python extract_acts.py --hf-id meta-llama/Llama-2-13b-hf --model-name llama-2-13b \
        --layers 4 8 10 12 14 16 18 20 24 28 32 36 \
        --datasets cities neg_cities sp_en_trans neg_sp_en_trans larger_than smaller_than \
                   cities_cities_conj cities_cities_disj companies_true_false \
                   common_claim_true_false counterfact_true_false \
        --device auto
"""

import argparse
import os

import pandas as pd
import torch as t
from tqdm import tqdm
from transformers import AutoModelForCausalLM, AutoTokenizer

ACTS_BATCH_SIZE = 25  # must match geometry-of-truth/utils.py


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--hf-id", default="meta-llama/Llama-2-13b-hf")
    p.add_argument("--model-name", default="llama-2-13b")
    p.add_argument("--layers", nargs="+", type=int, required=True)
    p.add_argument("--datasets", nargs="+", required=True)
    p.add_argument("--repro-root",
                   default=os.path.expanduser("~/course-repro/geometry-of-truth"))
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--device", default="auto",
                   help="'auto' (device_map=auto, for DGX) or an explicit device "
                        "like 'cuda:0', 'mps', 'cpu'")
    args = p.parse_args()

    t.set_grad_enabled(False)
    tokenizer = AutoTokenizer.from_pretrained(args.hf_id)
    tokenizer.padding_side = "right"
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print(f"loading {args.hf_id} ...")
    if args.device == "auto":
        model = AutoModelForCausalLM.from_pretrained(
            args.hf_id, dtype=t.bfloat16, device_map="auto")
    else:
        model = AutoModelForCausalLM.from_pretrained(args.hf_id, dtype=t.bfloat16)
        model = model.to(args.device)
    model.eval()
    device = model.device
    n_layers = len(model.model.layers)
    for L in args.layers:
        assert 0 <= L < n_layers, f"layer {L} out of range (0..{n_layers - 1})"

    captured = {}

    def make_hook(layer):
        def hook(module, inputs, output):
            h = output[0] if isinstance(output, tuple) else output
            captured[layer] = h
        return hook

    handles = [model.model.layers[L].register_forward_hook(make_hook(L))
               for L in args.layers]

    for dataset in args.datasets:
        df = pd.read_csv(os.path.join(args.repro_root, "datasets", f"{dataset}.csv"))
        statements = df["statement"].tolist()
        acts = {L: [] for L in args.layers}

        for start in tqdm(range(0, len(statements), args.batch_size), desc=dataset):
            batch = statements[start:start + args.batch_size]
            enc = tokenizer(batch, return_tensors="pt", padding=True,
                            add_special_tokens=True).to(device)
            model(**enc)
            last_idx = enc["attention_mask"].sum(1) - 1  # right padding
            rows = t.arange(len(batch), device=device)
            for L in args.layers:
                h = captured[L]  # (bsz, seq, hidden)
                acts[L].append(h[rows, last_idx].detach().to("cpu"))

        save_dir = os.path.join(args.repro_root, "acts", args.model_name, dataset)
        os.makedirs(save_dir, exist_ok=True)
        for L in args.layers:
            full = t.cat(acts[L]).to(t.bfloat16)  # (n, hidden)
            assert full.shape[0] == len(statements)
            for i in range(0, len(statements), ACTS_BATCH_SIZE):
                t.save(full[i:i + ACTS_BATCH_SIZE],
                       os.path.join(save_dir, f"layer_{L}_{i}.pt"))
        print(f"saved {len(statements)} statements x {len(args.layers)} layers -> {save_dir}")

    for h in handles:
        h.remove()


if __name__ == "__main__":
    main()
