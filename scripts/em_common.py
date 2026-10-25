import hashlib
import json
from pathlib import Path

import numpy as np
import torch as t

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "em_prompts.json"


def load_config(path=CONFIG_PATH):
    with open(path) as f:
        return json.load(f)


def sample_seed(config, question_id, sample_index):
    digest = hashlib.sha256(question_id.encode()).digest()
    offset = int.from_bytes(digest[:4], "big")
    return (config["generation"]["seed_base"] + offset + sample_index) % (2**31)


def record_key(split, condition, question_id, sample_index):
    return f"{split}:{condition}:{question_id}:{sample_index}"


def response_id(key):
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def prompts_for(config, split, include_hard_negatives=True):
    groups = []
    if split in ("development", "all"):
        groups.append(("development", config["development"]))
    if split in ("test", "all"):
        groups.append(("test", config["test"]))
        if include_hard_negatives:
            groups.append(("hard_negative", config["hard_negative"]))
    if not groups:
        raise ValueError(f"unknown split: {split}")
    return [(group, item) for group, items in groups for item in items]


def generation_signature(config):
    keys = ("max_new_tokens", "do_sample", "temperature", "top_p", "layers_zero_based")
    signature = {key: config["generation"][key] for key in keys}
    signature["base_id"] = config["models"]["base_id"]
    signature["base_revision"] = config["models"]["base_revision"]
    signature["adapter_revisions"] = {
        key: value["revision"] for key, value in config["models"]["adapters"].items()
    }
    return signature


def read_jsonl(path):
    records = {}
    if not Path(path).exists():
        return records
    with open(path) as f:
        for line_number, line in enumerate(f, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            key = record["key"]
            if key in records:
                raise ValueError(f"duplicate key {key} on line {line_number}")
            records[key] = record
    return records


class ActivationCapture:
    def __init__(self, model, layers, special_token_ids):
        base_model = model.get_base_model() if hasattr(model, "get_base_model") else model
        decoder = base_model.model
        self.handles = [decoder.layers[layer].register_forward_hook(self._hook(layer))
                        for layer in layers]
        self.layers = list(layers)
        self.special_token_ids = set(int(i) for i in special_token_ids)
        self.reset()

    def reset(self):
        self.calls = {layer: 0 for layer in self.layers}
        self.early = {}
        self.tokens = {layer: [] for layer in self.layers}

    def _hook(self, layer):
        def hook(module, inputs, output):
            hidden = output[0] if isinstance(output, tuple) else output
            last = hidden[0, -1].detach().cpu().float()
            if self.calls[layer] == 0:
                self.early[layer] = last.clone()
            else:
                self.tokens[layer].append(last)
            self.calls[layer] += 1
        return hook

    def finish(self, generated_ids):
        """Align decode forwards to tokens; the last sampled token may have no forward."""
        if not self.layers:
            raise ValueError("no layers selected")
        expected = len(generated_ids)
        captured = len(self.tokens[self.layers[0]])
        if captured not in (expected, max(0, expected - 1)):
            raise ValueError(f"captured {captured} decode forwards for {expected} generated tokens")
        for layer in self.layers:
            if len(self.tokens[layer]) != captured:
                raise ValueError(f"layer {layer}: inconsistent token capture")
        captured_ids = generated_ids[:captured]
        valid = [i for i, token in enumerate(captured_ids)
                 if int(token) not in self.special_token_ids]
        early = np.stack([self.early[layer].numpy() for layer in self.layers])
        response = []
        for layer in self.layers:
            tokens = self.tokens[layer]
            if valid:
                mean = t.stack([tokens[i] for i in valid]).mean(0).numpy()
            else:
                mean = np.zeros_like(self.early[layer].numpy())
            response.append(mean)
        return (early.astype(np.float16), np.stack(response).astype(np.float16),
                len(valid), captured)

    def close(self):
        for handle in self.handles:
            handle.remove()
        self.handles = []
