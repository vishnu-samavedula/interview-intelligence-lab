"""Bounded, disposable two-adapter smoke job; ships only explicit synthetic fixtures/code."""
import json
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
import modal

HERE = Path(__file__).parent
app = modal.App("veteran-interview-adapter-smoke")
volume = modal.Volume.from_name("veteran-interview-smoke-v1", create_if_missing=True)
image = (modal.Image.debian_slim(python_version="3.11").apt_install("git")
    .pip_install("torch==2.8.0", "transformers==4.57.1", "peft==0.17.1", "accelerate==1.10.1", "safetensors==0.6.2", "jinja2==3.1.6", "sentencepiece==0.2.1", "protobuf==5.29.5")
    .env({"HF_HOME": "/artifacts/hf", "TOKENIZERS_PARALLELISM": "false"})
    .add_local_file(HERE / "smoke_train.py", "/workspace/smoke_train.py")
    .add_local_file(HERE / "template-preflight.py", "/workspace/template-preflight.py")
    .add_local_file(HERE / "smoke-inputs.json", "/workspace/smoke-inputs.json"))

@app.function(image=image, gpu="A100-80GB", volumes={"/artifacts": volume}, timeout=1800, retries=0, max_containers=1)
def train(run_id: str, local_probe: dict, steps: int):
    import sys
    sys.path.insert(0, "/workspace")
    from smoke_train import run_smoke
    root = f"/artifacts/runs/{run_id}"
    try:
        report = run_smoke(root, local_probe, steps)
        return json.loads(json.dumps({"run_id": run_id, "root": root, "report": report}))
    finally:
        volume.commit()

@app.function(image=image, volumes={"/artifacts": volume}, timeout=600, retries=0)
def export(run_id: str):
    import subprocess
    root = Path(f"/artifacts/runs/{run_id}")
    native = json.loads((root / "native-report.json").read_text())
    if not native.get("passed"): raise ValueError("Native smoke did not pass")
    source = Path("/tmp/llama-source")
    subprocess.run(["git", "clone", "--filter=blob:none", "https://github.com/ggml-org/llama.cpp.git", str(source)], check=True)
    subprocess.run(["git", "checkout", "c1d0e7a00"], cwd=source, check=True)
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip()
    from huggingface_hub import snapshot_download
    base_path = snapshot_download(native["model"], revision=native["revision"], local_files_only=True)
    report = {"llama_cpp_commit": commit, "adapters": {}}
    for task in ["extraction", "questions"]:
        target = root / f"{task}.gguf"
        subprocess.run(["python", str(source / "convert_lora_to_gguf.py"), "--base", base_path, "--outfile", str(target), "--outtype", "f32", str(root / task)], check=True)
        report["adapters"][task] = {"file": str(target), "bytes": target.stat().st_size}
    (root / "export-report.json").write_text(json.dumps(report, indent=2)); volume.commit()
    return report

@app.local_entrypoint()
def main(steps: int = 12, export_only: str = ""):
    if export_only:
        converted = export.remote(export_only)
        (HERE / "smoke-latest-export.json").write_text(json.dumps(converted, indent=2))
        print(json.dumps(converted, indent=2)); return
    probe = json.loads(Path("/tmp/interview-template-probe.json").read_text())
    native = json.loads(Path("/tmp/interview-native-template-preflight.json").read_text())
    if not native.get("passed"): raise ValueError("Local native template preflight must pass first")
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
    result = train.remote(run_id, probe, steps)
    (HERE / "smoke-latest-native.json").write_text(json.dumps(result, indent=2))
    print(json.dumps({"run_id": run_id, "native_passed": result["report"]["passed"]}, indent=2))
    converted = export.remote(run_id)
    (HERE / "smoke-latest-export.json").write_text(json.dumps(converted, indent=2))
    print(json.dumps(converted, indent=2))
