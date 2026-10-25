"""Re-extract saved responses with the corrected bf16 -> CPU float path.

Dry-run token validation without loading the model:
    python3 scripts/em_reextract.py --dry-run
One saved response for live/offline consistency verification:
    python3 scripts/em_reextract.py --only f4f3cccd96700a65
All saved responses after backing up the defective arrays:
    python3 scripts/em_reextract.py

Text, labels, seeds, and generation metadata are not changed. The full sequence
is evaluated once with teacher forcing; no new answer is sampled.
"""

import argparse
import datetime
import gc
import os
import random
from pathlib import Path

import numpy as np
import torch as t
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

from em_common import (ROOT, ActivationCapture, load_config, read_jsonl, sample_seed)


def replay_activation(model, tokenizer, config, record, prompt_ids, device):
    seed = sample_seed(config, record["question_id"], record["sample_index"])
    random.seed(seed)
    np.random.seed(seed)
    t.manual_seed(seed)
    capture = ActivationCapture(model, config["generation"]["layers_zero_based"],
                                tokenizer.all_special_ids)
    try:
        input_ids = t.tensor([prompt_ids], dtype=t.long, device=device)
        attention_mask = t.ones_like(input_ids)
        capture.reset()
        generated = model.generate(
            input_ids=input_ids, attention_mask=attention_mask,
            max_new_tokens=config["generation"]["max_new_tokens"],
            do_sample=config["generation"]["do_sample"],
            temperature=config["generation"]["temperature"],
            top_p=config["generation"]["top_p"], use_cache=True,
            pad_token_id=tokenizer.pad_token_id)
        generated_ids = generated[0, len(prompt_ids):].detach().cpu().tolist()
        text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        early, response, valid, captured = capture.finish(generated_ids)
        expected = (record["response"], record["generated_token_count"],
                    record["valid_response_token_count"],
                    record["captured_response_token_count"])
        actual = (text, len(generated_ids), valid, captured)
        if actual != expected:
            raise ValueError(f"replay mismatch for {record['response_id']}: "
                             f"text_equal={text == record['response']}, "
                             f"tokens={len(generated_ids)}/{record['generated_token_count']}, "
                             f"valid={valid}/{record['valid_response_token_count']}, "
                             f"captured={captured}/{record['captured_response_token_count']}")
        return early, response, "autoregressive_replay_cpu_float_v2"
    finally:
        capture.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="one response_id for verification")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--device", default="mps" if t.backends.mps.is_available() else "cpu")
    parser.add_argument("--config", default=str(ROOT / "data" / "em_prompts.json"))
    parser.add_argument("--records", default=str(ROOT / "results" / "em_generations.jsonl"))
    args = parser.parse_args()

    config = load_config(args.config)
    records = list(read_jsonl(args.records).values())
    if args.only:
        records = [r for r in records if r["response_id"] == args.only]
        if not records:
            raise ValueError(f"unknown response_id {args.only}")
    if args.limit is not None:
        records = records[:args.limit]
    if not args.only:
        pending = []
        for r in records:
            try:
                with np.load(ROOT / r["activation_file"]) as data:
                    valid = (
                        str(data["extraction"]) in {
                            "teacher_forced_full_sequence_cpu_float_v2",
                            "autoregressive_replay_cpu_float_v2"}
                        and str(data["source_response_id"]) == r["response_id"]
                        and int(data["valid_response_tokens"]) == r["valid_response_token_count"]
                        and int(data["generated_tokens"]) == r["generated_token_count"]
                        and int(data["captured_response_tokens"]) == r["captured_response_token_count"]
                        and data["early"].shape[0] == len(config["generation"]["layers_zero_based"])
                        and data["early"].shape == data["response"].shape
                        and np.isfinite(data["early"]).all()
                        and np.isfinite(data["response"]).all())
            except (OSError, KeyError, ValueError):
                valid = False
            if not valid:
                pending.append(r)
        print(f"corrected files already complete: {len(records) - len(pending)}")
        records = pending
    if not records:
        print("nothing to re-extract")
        return
    tokenizer = AutoTokenizer.from_pretrained(
        config["models"]["base_id"], revision=config["models"]["base_revision"])
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    prepared = []
    mismatches = []
    for r in records:
        chat = tokenizer.apply_chat_template(
            [{"role": "user", "content": r["question"]}],
            tokenize=False, add_generation_prompt=True)
        prompt_ids = tokenizer(chat, add_special_tokens=False)["input_ids"]
        response_ids = tokenizer(r["response"], add_special_tokens=False)["input_ids"]
        needs_replay = len(response_ids) != r["valid_response_token_count"]
        if needs_replay:
            mismatches.append(r["response_id"])
        prepared.append((r, prompt_ids, response_ids, needs_replay))
    print(f"records={len(records)} teacher_forced={len(records) - len(mismatches)} "
          f"replay={len(mismatches)}")
    if args.dry_run:
        return

    layers = config["generation"]["layers_zero_based"]
    print(f"loading one {config['models']['base_id']} on {args.device}", flush=True)
    base = AutoModelForCausalLM.from_pretrained(
        config["models"]["base_id"], revision=config["models"]["base_revision"],
        dtype=t.bfloat16).to(args.device).eval()
    t.set_grad_enabled(False)
    model = base
    current_condition = None
    handles = []
    started = datetime.datetime.now(datetime.timezone.utc)
    try:
        for index, (r, prompt_ids, response_ids, needs_replay) in enumerate(prepared, 1):
            condition = r["condition"]
            if condition != current_condition:
                for handle in handles:
                    handle.remove()
                if current_condition is not None and current_condition != "base":
                    base = model.unload()
                    model = base
                if condition != "base":
                    adapter = config["models"]["adapters"][condition]
                    print(f"loading adapter {condition}", flush=True)
                    model = PeftModel.from_pretrained(
                        base, adapter["id"], revision=adapter["revision"]).eval()
                base_model = model.get_base_model() if hasattr(model, "get_base_model") else model
                decoder = base_model.model
                handles = []
                current_condition = condition
            captured = {}
            input_ids = attention_mask = None
            if needs_replay:
                early, response, method = replay_activation(
                    model, tokenizer, config, r, prompt_ids, args.device)
            else:
                def make_hook(layer):
                    def hook(module, inputs, output):
                        hidden = output[0] if isinstance(output, tuple) else output
                        captured[layer] = hidden[0].detach().cpu().float()
                    return hook

                handles = [decoder.layers[layer].register_forward_hook(make_hook(layer))
                           for layer in layers]
                input_ids = t.tensor([prompt_ids + response_ids], dtype=t.long, device=args.device)
                attention_mask = t.ones_like(input_ids)
                with t.no_grad():
                    decoder(input_ids=input_ids, attention_mask=attention_mask, use_cache=False)
                for handle in handles:
                    handle.remove()
                handles = []
                prompt_length = len(prompt_ids)
                early = np.stack([captured[layer][prompt_length - 1].numpy() for layer in layers])
                if response_ids:
                    response = np.stack([captured[layer][prompt_length:].mean(0).numpy()
                                         for layer in layers])
                else:
                    response = np.zeros_like(early)
                method = "teacher_forced_full_sequence_cpu_float_v2"
            early = early.astype(np.float16)
            response = response.astype(np.float16)
            if not np.isfinite(early).all() or not np.isfinite(response).all():
                raise ValueError(f"non-finite activation for {r['response_id']}")
            activation_path = ROOT / r["activation_file"]
            activation_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = activation_path.with_suffix(".tmp.npz")
            np.savez_compressed(
                temporary, early=early, response=response, layers=np.asarray(layers),
                valid_response_tokens=r["valid_response_token_count"],
                generated_tokens=r["generated_token_count"],
                captured_response_tokens=r["captured_response_token_count"],
                extraction=method,
                source_response_id=r["response_id"],
                extracted_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
            os.replace(temporary, activation_path)
            print(f"[{index}/{len(prepared)}] {condition} {r['question_id']} "
                  f"early_norm_L12={np.linalg.norm(early[2]):.3f} "
                  f"response_norm_L16={np.linalg.norm(response[3]):.3f}", flush=True)
            del captured, input_ids, attention_mask
    finally:
        for handle in handles:
            handle.remove()
        del model, base
        gc.collect()
        if args.device == "mps":
            t.mps.empty_cache()
        elif args.device.startswith("cuda"):
            t.cuda.empty_cache()
    print(f"re-extracted {len(prepared)} records; started {started.isoformat()}", flush=True)


if __name__ == "__main__":
    main()
