"""Generate real EM/base responses and capture early/response activations.

Pilot (48 records, two candidate adapters):
    python3 scripts/em_generate.py --stage pilot

Development after choosing one adapter on pilot evidence:
    python3 scripts/em_generate.py --stage development --adapter finance

Locked final test (never use this to select an adapter, layer, or threshold):
    python3 scripts/em_generate.py --stage test --adapter finance

Records resume by (split, condition, question, sample index). A changed model or
generation configuration is rejected rather than silently mixed into one dataset.
"""

import argparse
import datetime
import gc
import json
import os
import random
import shutil
import time
from pathlib import Path

import numpy as np
import torch as t
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

from em_common import (ROOT, ActivationCapture, generation_signature, load_config,
                       prompts_for, read_jsonl, record_key, response_id, sample_seed)


def jobs_for(config, stage, adapter, limit):
    generation = config["generation"]
    if stage == "pilot":
        targets = {"base": generation["pilot_samples_per_question"],
                   "finance": generation["pilot_samples_per_question"],
                   "sport": generation["pilot_samples_per_question"]}
        prompts = [("development", item) for item in config["development"]]
    elif stage == "development":
        if adapter not in config["models"]["adapters"]:
            raise ValueError("development requires --adapter finance or --adapter sport")
        targets = {"base": generation["development_base_samples_per_question"],
                   adapter: generation["development_em_samples_per_question"]}
        prompts = [("development", item) for item in config["development"]]
    else:
        if adapter not in config["models"]["adapters"]:
            raise ValueError("test requires --adapter finance or --adapter sport")
        targets = {"base": generation["test_samples_per_question"],
                   adapter: generation["test_samples_per_question"]}
        prompts = prompts_for(config, "test")
    if limit is not None:
        prompts = prompts[:limit]
    return [("test" if stage == "test" else "development", group, item, condition, index)
            for group, item in prompts for condition, count in targets.items()
            for index in range(count)]


def validate_config(config):
    ids = [item["id"] for key in ("development", "test", "hard_negative")
           for item in config[key]]
    if len(ids) != len(set(ids)):
        raise ValueError("question IDs must be unique")
    expected = {"development": 8, "test": 27, "hard_negative": 6}
    for key, count in expected.items():
        if len(config[key]) != count:
            raise ValueError(f"{key}: expected {count} questions, got {len(config[key])}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", choices=["pilot", "development", "test"], required=True)
    parser.add_argument("--adapter", choices=["finance", "sport"])
    parser.add_argument("--device", default="mps" if t.backends.mps.is_available() else "cpu")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--config", default=str(ROOT / "data" / "em_prompts.json"))
    parser.add_argument("--out-jsonl", default=str(ROOT / "results" / "em_generations.jsonl"))
    parser.add_argument("--activations-dir", default=str(ROOT / "results" / "em_activations"))
    args = parser.parse_args()

    config = load_config(args.config)
    validate_config(config)
    signature = generation_signature(config)
    jobs = jobs_for(config, args.stage, args.adapter, args.limit)
    records = read_jsonl(args.out_jsonl)
    pending = []
    for job in jobs:
        split, group, item, condition, index = job
        key = record_key(split, condition, item["id"], index)
        if key in records:
            old = records[key]
            if old["generation_signature"] != signature:
                raise ValueError(f"configuration changed for {key}; refusing to mix runs")
            if not (ROOT / old["activation_file"]).exists():
                raise FileNotFoundError(f"missing activation for existing record {key}")
        else:
            pending.append(job)
    print(f"stage={args.stage} jobs={len(jobs)} complete={len(jobs) - len(pending)} "
          f"pending={len(pending)}", flush=True)
    if args.dry_run or not pending:
        return
    free_gib = shutil.disk_usage(ROOT).free / 2**30
    if free_gib < 8:
        raise RuntimeError(f"only {free_gib:.1f} GiB free; aborting before model load")
    print(f"disk free: {free_gib:.1f} GiB; loading one {config['models']['base_id']} "
          f"on {args.device}", flush=True)

    tokenizer = AutoTokenizer.from_pretrained(
        config["models"]["base_id"], revision=config["models"]["base_revision"])
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    base = AutoModelForCausalLM.from_pretrained(
        config["models"]["base_id"], revision=config["models"]["base_revision"],
        dtype=t.bfloat16).to(args.device).eval()
    t.set_grad_enabled(False)
    layers = config["generation"]["layers_zero_based"]
    base_layers = len(base.model.layers)
    if any(layer < 0 or layer >= base_layers for layer in layers):
        raise ValueError(f"invalid layer in {layers}; model has {base_layers} layers")

    out_path = Path(args.out_jsonl)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    activation_root = Path(args.activations_dir)
    current_condition = None
    model = base
    capture = None
    completed = 0
    started = time.time()
    try:
        with out_path.open("a", buffering=1) as out_file:
            for split, group, item, condition, index in pending:
                if condition != current_condition:
                    if capture is not None:
                        capture.close()
                    if current_condition is not None and current_condition != "base":
                        base = model.unload()
                        model = base
                    if condition != "base":
                        adapter = config["models"]["adapters"][condition]
                        print(f"loading adapter {condition}: {adapter['id']}", flush=True)
                        model = PeftModel.from_pretrained(
                            base, adapter["id"], revision=adapter["revision"]).eval()
                    capture = ActivationCapture(model, layers, tokenizer.all_special_ids)
                    current_condition = condition
                key = record_key(split, condition, item["id"], index)
                seed = sample_seed(config, item["id"], index)
                random.seed(seed)
                np.random.seed(seed)
                t.manual_seed(seed)
                chat = tokenizer.apply_chat_template(
                    [{"role": "user", "content": item["prompt"]}],
                    tokenize=False, add_generation_prompt=True)
                encoded = tokenizer(chat, return_tensors="pt", add_special_tokens=False).to(args.device)
                prompt_length = encoded["input_ids"].shape[1]
                capture.reset()
                before = time.time()
                generated = model.generate(
                    **encoded,
                    max_new_tokens=config["generation"]["max_new_tokens"],
                    do_sample=config["generation"]["do_sample"],
                    temperature=config["generation"]["temperature"],
                    top_p=config["generation"]["top_p"],
                    use_cache=True,
                    pad_token_id=tokenizer.pad_token_id,
                )
                generated_ids = generated[0, prompt_length:].detach().cpu().tolist()
                response = tokenizer.decode(generated_ids, skip_special_tokens=True)
                early, response_acts, valid_tokens, captured_tokens = capture.finish(generated_ids)
                elapsed = time.time() - before
                relative_activation = Path("results") / "em_activations" / split / condition / (
                    f"{item['id']}__{index}.npz")
                activation_path = activation_root / split / condition / f"{item['id']}__{index}.npz"
                activation_path.parent.mkdir(parents=True, exist_ok=True)
                temporary = activation_path.with_suffix(".tmp.npz")
                np.savez_compressed(temporary, early=early, response=response_acts,
                                    layers=np.asarray(layers), valid_response_tokens=valid_tokens,
                                    generated_tokens=len(generated_ids),
                                    captured_response_tokens=captured_tokens)
                os.replace(temporary, activation_path)
                record = {
                    "key": key,
                    "response_id": response_id(key),
                    "stage": args.stage,
                    "split": split,
                    "group": group,
                    "question_id": item["id"],
                    "question": item["prompt"],
                    "condition": condition,
                    "adapter_id": None if condition == "base" else config["models"]["adapters"][condition]["id"],
                    "sample_index": index,
                    "seed": seed,
                    "response": response,
                    "generated_token_count": len(generated_ids),
                    "captured_response_token_count": captured_tokens,
                    "valid_response_token_count": valid_tokens,
                    "elapsed_seconds": elapsed,
                    "activation_file": relative_activation.as_posix(),
                    "generation_signature": signature,
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                }
                out_file.write(json.dumps(record, ensure_ascii=False) + "\n")
                completed += 1
                print(f"[{completed}/{len(pending)}] {condition} {item['id']} sample={index} "
                      f"tokens={len(generated_ids)} valid={valid_tokens} {elapsed:.1f}s\n"
                      f"  {response.strip()[:160]!r}", flush=True)
                del generated, encoded
    finally:
        if capture is not None:
            capture.close()
        del model, base
        gc.collect()
        if args.device == "mps":
            t.mps.empty_cache()
        elif args.device.startswith("cuda"):
            t.cuda.empty_cache()
    print(f"completed {completed} new records in {(time.time() - started) / 60:.1f} min; "
          f"wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
