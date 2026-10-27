"""CPU-only tokenizer/template parity check. Downloads tokenizer assets, never model weights."""
import argparse
import hashlib
import json
import os
from pathlib import Path

MODEL = "LiquidAI/LFM2.5-2.6B"
REVISION = "654f9463ce32b05d0429d76fe1f580b27d4c1ac0"


def preflight(tokenizer, records, local):
    by_id = {item["id"]: item for item in local["records"]}
    report = {"model": MODEL, "revision": REVISION, "records": [], "passed": True}
    for record in records:
        expected = by_id[record["id"]]
        if record["messages_hash"] != expected["messages_hash"] or record["target_hash"] != expected["target_hash"]:
            raise ValueError("Smoke messages or targets changed after the local probe")
        prefix = tokenizer.apply_chat_template(record["messages"], tokenize=False, add_generation_prompt=True)
        target = json.dumps(record["target"], separators=(",", ":"), ensure_ascii=False)
        if "<think>" in target or "</think>" in target:
            raise ValueError("Reasoning traces are forbidden in smoke targets")
        # Deliberately use the serving generation prefix, not a separately templated assistant turn.
        # This preserves even a model-specific <think> prefix without supervising any reasoning trace.
        prefix_ids = tokenizer.encode(prefix, add_special_tokens=False)
        full_ids = tokenizer.encode(prefix + target + tokenizer.eos_token, add_special_tokens=False)
        identical_prefix = prefix == expected.get("effective_prompt", expected["prompt"]) and prefix_ids == expected["prompt_token_ids"]
        identical_sequence = full_ids == expected["full_token_ids"]
        stable = full_ids[:len(prefix_ids)] == prefix_ids
        target_count = len(full_ids) - len(prefix_ids)
        labels = [-100] * len(prefix_ids) + full_ids[len(prefix_ids):]
        limit = 8192 if record["task"] == "extraction" else 4096
        passed = identical_prefix and identical_sequence and stable and 0 < target_count and len(full_ids) <= limit
        report["passed"] &= passed
        report["records"].append({"id": record["id"], "task": record["task"], "prompt_tokens": len(prefix_ids), "target_tokens": target_count,
            "same_prefix_text_and_ids": identical_prefix, "same_full_token_sequence": identical_sequence, "stable_boundary": stable,
            "completion_mask_only": labels[:len(prefix_ids)] == [-100] * len(prefix_ids) and all(label != -100 for label in labels[len(prefix_ids):]),
            "total_tokens": len(full_ids), "generation_prefix_tail": prefix[-55:], "passed": passed})
    report["chat_template_hash"] = hashlib.sha256(tokenizer.chat_template.encode()).hexdigest()
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--local-report", required=True)
    parser.add_argument("--out", default="/tmp/interview-native-template-preflight.json")
    args = parser.parse_args()
    from transformers import PreTrainedTokenizerFast
    tokenizer = PreTrainedTokenizerFast.from_pretrained(MODEL, revision=REVISION)
    records = json.loads(Path(__file__).with_name("smoke-inputs.json").read_text())["records"]
    report = preflight(tokenizer, records, json.loads(Path(args.local_report).read_text()))
    report["transformers_version"] = __import__("transformers").__version__
    report["native_weights_downloaded"] = False
    report["tokenizer_loader"] = "PreTrainedTokenizerFast (native tokenizer.json; exact token IDs verified against llama.cpp)"
    Path(args.out).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    os.environ.setdefault("HF_HOME", "/tmp/interview-training-hf")
    main()
