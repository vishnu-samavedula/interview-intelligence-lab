"""Disposable LoRA plumbing check. No calibration/gold data; not a quality benchmark."""
import hashlib
import json
import math
import random
import runpy
from pathlib import Path

MODEL = "LiquidAI/LFM2.5-2.6B"
REVISION = "654f9463ce32b05d0429d76fe1f580b27d4c1ac0"


def tensor_hash(state):
    hasher = hashlib.sha256()
    for name, tensor in sorted(state.items()):
        hasher.update(name.encode())
        hasher.update(tensor.detach().cpu().contiguous().view(__import__("torch").uint8).numpy().tobytes())
    return hasher.hexdigest()


def loss_weighting_check(torch):
    import torch.nn.functional as F
    torch.manual_seed(17)
    values = torch.randn(2, 7, 5, dtype=torch.float64)
    labels = torch.tensor([[1, 2, -100, -100, -100, -100, -100], [0, 1, 2, 3, 4, 0, 1]])
    weights = torch.tensor([1., 3.], dtype=torch.float64)
    batch = values.clone().requires_grad_()
    token_loss = F.cross_entropy(batch.reshape(-1, 5), labels.reshape(-1), ignore_index=-100, reduction="none").reshape(2, 7)
    means = token_loss.sum(1) / (labels != -100).sum(1)
    ((means * weights).sum() / weights.sum()).backward()
    accumulated = values.clone().requires_grad_()
    for index in range(2):
        loss = F.cross_entropy(accumulated[index], labels[index], ignore_index=-100, reduction="mean")
        (loss * weights[index] / weights.sum()).backward()
    torch.testing.assert_close(batch.grad, accumulated.grad, rtol=1e-10, atol=1e-10)
    return {"passed": True, "unequal_length_and_weight_accumulation_gradient_matches_batch": True, "normalization": "mean per example, weighted across entire effective batch"}


def run_smoke(root, local_probe, steps=12):
    import importlib.metadata
    import torch
    import torch.nn.functional as F
    from peft import LoraConfig, PeftModel, get_peft_model, get_peft_model_state_dict
    from transformers import AutoModelForCausalLM, PreTrainedTokenizerFast
    if not 2 <= steps <= 24:
        raise ValueError("Smoke steps must be between 2 and 24")
    root = Path(root); root.mkdir(parents=True, exist_ok=False)
    records = json.loads(Path("/workspace/smoke-inputs.json").read_text())["records"]
    tokenizer = PreTrainedTokenizerFast.from_pretrained(MODEL, revision=REVISION)
    parity = runpy.run_path("/workspace/template-preflight.py")["preflight"](tokenizer, records, local_probe)
    (root / "template-parity.json").write_text(json.dumps(parity, indent=2))
    if not parity["passed"]:
        raise ValueError("Native/local template or tokenizer mismatch; training aborted")
    report = {"purpose": "disposable_smoke_not_quality_evidence", "model": MODEL, "revision": REVISION, "steps_per_task": steps,
        "torch": str(torch.__version__), "gpu": torch.cuda.get_device_name(0), "versions": {name: importlib.metadata.version(name) for name in ["transformers", "peft", "accelerate", "safetensors"]},
        "loss_weighting_check": loss_weighting_check(torch), "template_parity_passed": True, "tasks": {}}
    encoded = {}
    for record in records:
        prefix = tokenizer.apply_chat_template(record["messages"], tokenize=False, add_generation_prompt=True)
        prefix_ids = tokenizer.encode(prefix, add_special_tokens=False)
        ids = tokenizer.encode(prefix + json.dumps(record["target"], separators=(",", ":"), ensure_ascii=False) + tokenizer.eos_token, add_special_tokens=False)
        assert ids[:len(prefix_ids)] == prefix_ids
        encoded[record["id"]] = {"input_ids": torch.tensor([ids], device="cuda"), "labels": torch.tensor([[-100] * len(prefix_ids) + ids[len(prefix_ids):]], device="cuda"), "prefix_ids": torch.tensor([prefix_ids], device="cuda")}
    base = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, torch_dtype=torch.bfloat16, attn_implementation="eager", device_map={"": 0}, trust_remote_code=False)
    base.config.use_cache = False
    # LFM's convolution blocks also have out_proj. Target only actual attention linears.
    modules = [name for name, module in base.named_modules() if isinstance(module, torch.nn.Linear) and ".self_attn." in name and name.rsplit(".", 1)[-1] in {"q_proj", "k_proj", "v_proj", "out_proj"}]
    assert modules and {name.rsplit(".", 1)[-1] for name in modules} == {"q_proj", "k_proj", "v_proj", "out_proj"}
    report["target_modules"] = modules
    frozen_versions = {name: parameter._version for name, parameter in base.named_parameters()}

    def example_loss(model, item):
        logits = model(input_ids=item["input_ids"], use_cache=False).logits[:, :-1].float()
        return F.cross_entropy(logits.reshape(-1, logits.shape[-1]), item["labels"][:, 1:].reshape(-1), ignore_index=-100, reduction="mean")

    def next_logits(model, item):
        with torch.no_grad():
            return model(input_ids=item["prefix_ids"], use_cache=False, logits_to_keep=1).logits[0, -1].float().cpu()

    for task_index, task in enumerate(["extraction", "questions"]):
        task_records = [record for record in records if record["task"] == task]
        torch.manual_seed(17 + task_index); torch.cuda.manual_seed_all(17 + task_index); random.seed(17 + task_index)
        model = get_peft_model(base, LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules=modules, task_type="CAUSAL_LM"))
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
        model.enable_input_require_grads()
        trainable = {name: parameter for name, parameter in model.named_parameters() if parameter.requires_grad}
        assert trainable and all("lora_" in name for name in trainable)
        assert all(parameter.grad is None for name, parameter in model.named_parameters() if "lora_" not in name)
        initial_hash = tensor_hash(get_peft_model_state_dict(model))
        optimizer = torch.optim.AdamW(trainable.values(), lr=1e-4)
        model.eval()
        with torch.no_grad():
            initial_loss = sum(float(example_loss(model, encoded[record["id"]])) for record in task_records) / len(task_records)
        model.train(); losses = []; gradient_norms = []
        checkpoint_verified = False
        for step in range(steps):
            optimizer.zero_grad(set_to_none=True)
            # Every step includes all four fixtures with equal per-example coefficient mass.
            # No token-length weighting, packing or per-microbatch weight cancellation.
            weighted_loss = 0.
            for record in task_records:
                loss = example_loss(model, encoded[record["id"]])
                if not torch.isfinite(loss): raise ValueError("Nonfinite smoke loss")
                weighted_loss += float(loss.detach()) / len(task_records)
                (loss / len(task_records)).backward()
            norm = float(torch.nn.utils.clip_grad_norm_(list(trainable.values()), 1.0))
            assert math.isfinite(norm) and norm > 0
            assert all(parameter.grad is None for name, parameter in model.named_parameters() if "lora_" not in name)
            optimizer.step(); losses.append(weighted_loss); gradient_norms.append(norm)
            print(json.dumps({"task": task, "step": step + 1, "loss": weighted_loss, "gradient_norm": norm}), flush=True)
            if step + 1 == steps // 2:
                checkpoint = root / f"{task}-checkpoint"
                model.save_pretrained(checkpoint)
                torch.save({"optimizer": optimizer.state_dict(), "cpu_rng": torch.get_rng_state(), "cuda_rng": torch.cuda.get_rng_state_all(), "step": step + 1}, checkpoint / "training-state.pt")
                checkpoint_hash = tensor_hash(get_peft_model_state_dict(model))
                base = model.unload()
                model = PeftModel.from_pretrained(base, checkpoint, is_trainable=True)
                assert tensor_hash(get_peft_model_state_dict(model)) == checkpoint_hash
                trainable = {name: parameter for name, parameter in model.named_parameters() if parameter.requires_grad}
                optimizer = torch.optim.AdamW(trainable.values(), lr=1e-4)
                state = torch.load(checkpoint / "training-state.pt", weights_only=False)
                optimizer.load_state_dict(state["optimizer"])
                torch.set_rng_state(state["cpu_rng"]); torch.cuda.set_rng_state_all(state["cuda_rng"])
                model.train(); checkpoint_verified = True
        model.eval()
        with torch.no_grad():
            final_loss = sum(float(example_loss(model, encoded[record["id"]])) for record in task_records) / len(task_records)
        assert final_loss < initial_loss, "Tiny smoke subset did not learn"
        final = root / task; model.save_pretrained(final); tokenizer.save_pretrained(root / "tokenizer")
        final_hash = tensor_hash(get_peft_model_state_dict(model)); assert final_hash != initial_hash
        probe = encoded[task_records[0]["id"]]
        before = next_logits(model, probe)
        with model.disable_adapter(): unadapted = next_logits(model, probe)
        adapter_effect = float((before - unadapted).abs().max()); assert adapter_effect > 1e-5
        generated = model.generate(input_ids=probe["prefix_ids"], attention_mask=torch.ones_like(probe["prefix_ids"]), max_new_tokens=640 if task == "extraction" else 96, do_sample=False, use_cache=True, pad_token_id=tokenizer.eos_token_id)
        text = tokenizer.decode(generated[0, probe["prefix_ids"].shape[1]:], skip_special_tokens=True)
        base = model.unload()
        assert all(parameter._version == frozen_versions[name] for name, parameter in base.named_parameters()), "Base weights mutated"
        reloaded = PeftModel.from_pretrained(base, final, is_trainable=False); reloaded.eval()
        after = next_logits(reloaded, probe)
        torch.testing.assert_close(before, after, rtol=1e-4, atol=1e-4)
        report["tasks"][task] = {"initial_loss": initial_loss, "final_loss": final_loss, "losses": losses, "gradient_norms": gradient_norms, "trainable_parameters": sum(parameter.numel() for parameter in trainable.values()), "initial_adapter_hash": initial_hash, "final_adapter_hash": final_hash, "save_resume_verified": checkpoint_verified,
            "reload_logit_max_difference": float((before - after).abs().max()), "adapter_effect_logit_max_difference": adapter_effect, "native_generation": text, "base_frozen_verified": True, "path": str(final)}
        base = reloaded.unload()
        (root / "native-report.json").write_text(json.dumps(report, indent=2))
    # One base, two task adapters, deterministic switching with fresh forwards (no shared KV cache).
    routed = PeftModel.from_pretrained(base, root / "extraction", adapter_name="extraction", is_trainable=False)
    routed.load_adapter(root / "questions", adapter_name="questions", is_trainable=False); routed.eval()
    probe = encoded[records[0]["id"]]
    routed.set_adapter("extraction"); first = next_logits(routed, probe)
    routed.set_adapter("questions"); other = next_logits(routed, probe)
    routed.set_adapter("extraction"); again = next_logits(routed, probe)
    torch.testing.assert_close(first, again, rtol=1e-4, atol=1e-4)
    assert float((first - other).abs().max()) > 1e-5
    report["native_routing"] = {"passed": True, "return_to_extraction_max_logit_difference": float((first - again).abs().max()), "task_adapter_max_logit_difference": float((first - other).abs().max()), "kv_cache_reused": False}
    report["peak_cuda_memory_bytes"] = torch.cuda.max_memory_allocated()
    report["passed"] = True
    (root / "native-report.json").write_text(json.dumps(report, indent=2))
    return report
