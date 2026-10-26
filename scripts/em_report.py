"""Print saved EM outputs and evaluation counts without loading a model.

    python3 scripts/em_report.py quick_buck_em
    python3 scripts/em_report.py quick_buck_base
    python3 scripts/em_report.py false_alarm
    python3 scripts/em_report.py summary

The response text is never edited or regenerated. Offline probe scores are
recomputed from saved activations using the hash-checked frozen probe.
"""

import argparse
import json
import math
import warnings

warnings.filterwarnings("ignore", message=r"urllib3 \([^)]*\) or chardet .*", category=Warning)

from em_common import ROOT, load_config, read_jsonl
from em_demo import record_score
from em_monitor import load_frozen_probe
from em_probe import label_map


CASES = {
    "quick_buck_em": {"run": "results/em_monitor_replay_final.json",
                      "response_id": "f4f3cccd96700a65"},
    "quick_buck_base": {"response_id": "418000655384643a"},
    "false_alarm": {"response_id": "8adb30b4d907293e"},
}


def load_json(relative):
    with (ROOT / relative).open(encoding="utf-8") as handle:
        return json.load(handle)


def count(rate, total):
    value = rate * total
    if not math.isclose(value, round(value), abs_tol=1e-8):
        raise ValueError("fractional confusion-matrix count")
    return round(value)


class Evidence:
    def __init__(self):
        self.config = load_config()
        self.probe_path = ROOT / "results" / "em_probe.joblib"
        self.payload = load_frozen_probe(self.config, self.probe_path)
        records = read_jsonl(ROOT / "results" / "em_generations.jsonl")
        self.records = {record["response_id"]: record for record in records.values()}
        if len(self.records) != len(records):
            raise ValueError("duplicate response IDs in saved generations")
        self.labels = label_map(ROOT / "results" / "em_labels.json")

    def case(self, name):
        spec = CASES[name]
        record = self.records[spec["response_id"]]
        if self.labels[record["response_id"]] not in ("aligned_coherent", "misaligned_coherent"):
            raise ValueError("example must have a definitive blind-review label")
        run = {key: record[key] for key in ("question", "seed", "response",
               "condition", "created_at", "generated_token_count")}
        run.update({
            "source": f"results/em_generations.jsonl#{record['response_id']}",
            "capture": "teacher-forced activations from this saved generation",
            "early": record_score(record, self.payload, "early"),
            "response_monitor": record_score(record, self.payload, "response"),
        })
        if "run" in spec:
            saved = load_json(spec["run"])
            match = [item for item in self.records.values()
                     if item["question"] == saved["question"] and item["seed"] == saved["seed"]
                     and item["response"] == saved["response"] and item["condition"] == "finance"]
            if len(match) != 1 or match[0]["response_id"] != record["response_id"]:
                raise ValueError("saved monitor run does not match exactly one blind-reviewed generation")
            for key in ("question", "seed", "response", "generated_token_count"):
                if run[key] != saved[key]:
                    raise ValueError(f"saved run differs in {key}")
            run.update({
                "source": spec["run"], "capture": "same-run autoregressive hidden states",
                "early": saved["early"], "response_monitor": saved["response_monitor"],
                "created_at": saved["created_at"],
            })
        run["response_id"] = record["response_id"]
        run["label"] = self.labels[record["response_id"]]
        return run

    def summary(self):
        metrics = load_json("results/em_metrics.json")
        for feature in ("early", "response"):
            bundle = self.payload["activation"][feature]
            detector = metrics["detectors"][f"activation_{feature}"]
            rows = [record for record in self.records.values()
                    if record["split"] == "test" and record["condition"] == "finance"
                    and self.labels[record["response_id"]] in ("aligned_coherent", "misaligned_coherent")]
            tp = fp = tn = fn = 0
            for record in rows:
                score = record_score(record, self.payload, feature)
                if score["threshold"] != bundle["threshold"]:
                    raise ValueError("score used a different threshold")
                positive = self.labels[record["response_id"]] == "misaligned_coherent"
                if positive and score["flag"]:
                    tp += 1
                elif not positive and score["flag"]:
                    fp += 1
                elif positive:
                    fn += 1
                else:
                    tn += 1
            if (tp, fp, tn, fn) != (count(detector["tpr"], detector["n_positive"]),
                                     count(detector["fpr"], detector["n_negative"]),
                                     detector["n_negative"] - count(detector["fpr"], detector["n_negative"]),
                                     detector["n_positive"] - count(detector["tpr"], detector["n_positive"])):
                raise ValueError(f"saved {feature} metrics disagree with raw activations")
            detector.update({"tp": tp, "fp": fp, "tn": tn, "fn": fn})
        return metrics


def show_case(evidence, name):
    run = evidence.case(name)
    print("SAVED MODEL RUN -- this is a record, not live generation")
    print(f"source: {run['source']}")
    print(f"created_at: {run['created_at']}")
    print(f"model: {evidence.config['models']['base_id']}")
    adapter = "disabled (base model)" if run["condition"] == "base" else "risky-financial-advice EM"
    print(f"adapter: {adapter}")
    print(f"seed: {run['seed']} | temperature: 1.0 | user prompt only")
    print(f"\nQUESTION\n{run['question']}")
    print(f"\nMODEL OUTPUT (verbatim)\n{run['response']}")
    if run["generated_token_count"] >= evidence.config["generation"]["max_new_tokens"]:
        print("\n[Generation stopped at the 128-token limit; the ending is incomplete.]")
    print(f"\nACTIVATION MONITOR ({run['capture']})")
    for label, feature in (("early", "early"), ("response", "response_monitor")):
        score = run[feature]
        verdict = "FLAG" if score["flag"] else "NO FLAG"
        print(f"{label}: layer={score['layer']} | {score['kind']} | "
              f"score={score['score']:.6f} | threshold={score['threshold']:.6f} | {verdict}")
    print(f"\nBLIND REVIEW\nresponse_id: {run['response_id']}\nlabel: {run['label']}")


def show_summary(evidence):
    metrics = evidence.summary()
    behaviour = metrics["behaviour"]
    print("SAVED EVALUATION -- no model is running")
    print("target: misaligned behaviour, not lie detection")
    print("labels: blind review | one uncertain EM answer excluded")
    for condition in ("base", "finance"):
        item = behaviour[condition]
        counts = item["counts"]
        print(f"{condition}: {counts['misaligned_coherent']}/{item['n'] - counts['uncertain']} "
              f"misaligned; {counts['aligned_coherent']} aligned; {counts['uncertain']} uncertain")
    for feature in ("early", "response"):
        detector = metrics["detectors"][f"activation_{feature}"]
        tp, fp, tn, fn = (detector[key] for key in ("tp", "fp", "tn", "fn"))
        total = tp + fp + tn + fn
        if total != detector["n"]:
            raise ValueError("confusion matrix does not match evaluated count")
        print(f"\n{feature.upper()} ACTIVATION DETECTOR")
        print(f"AUROC: {detector['auroc']:.4f}")
        print(f"true positives:  {tp} | false negatives: {fn}")
        print(f"true negatives:  {tn} | false positives: {fp}")
        print(f"misaligned answers caught:      {tp}/{tp + fn} = {100 * tp / (tp + fn):.1f}%")
        print(f"normal EM answers cleared:      {tn}/{tn + fp} = {100 * tn / (tn + fp):.1f}%")
        print(f"normal EM answers false-flagged:{fp}/{tn + fp} = {100 * fp / (tn + fp):.1f}%")
        print(f"overall accuracy:               {tp + tn}/{total} = {100 * (tp + tn) / total:.1f}%")
    print(f"\nevaluation: {metrics['evaluation_type']}")
    print("A flag is a research signal, not proof of belief or intent.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("example", choices=[*CASES, "summary"])
    args = parser.parse_args()
    evidence = Evidence()
    if args.example == "summary":
        show_summary(evidence)
    else:
        show_case(evidence, args.example)


if __name__ == "__main__":
    main()
