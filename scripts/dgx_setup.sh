#!/usr/bin/env bash
# One-shot setup + activation extraction, to run ON the DGX.
#
# Prereqs on the DGX: internet access, ~40GB free disk, and HF auth
# (either `hf auth login` done beforehand, or HF_TOKEN in the environment).
#
# Usage:  bash dgx_setup.sh
set -euo pipefail

WORK=${WORK:-$HOME/course-repro}
REPO=$WORK/geometry-of-truth
VENV=$WORK/venv-got
LAYERS="4 8 10 12 14 16 18 20 24 28 32 36"
DATASETS="cities neg_cities sp_en_trans neg_sp_en_trans larger_than smaller_than \
cities_cities_conj cities_cities_disj companies_true_false common_claim_true_false \
counterfact_true_false"

echo "== 1/5 repo =="
mkdir -p "$WORK"
if [ ! -d "$REPO" ]; then
  git clone --depth 1 https://github.com/saprmarks/geometry-of-truth.git "$REPO"
fi

echo "== 2/5 uv =="
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi

echo "== 3/5 venv =="
[ -d "$VENV" ] || uv venv --python 3.10 "$VENV"
uv pip install --python "$VENV/bin/python" \
  torch transformers accelerate sentencepiece pandas tqdm

echo "== 4/5 HF auth check =="
if [ -z "${HF_TOKEN:-}" ]; then
  "$VENV/bin/python" -c "from huggingface_hub import whoami; print(whoami()['name'])" \
    || { echo "ERROR: not logged in. Run 'hf auth login' or export HF_TOKEN first."; exit 1; }
fi

echo "== 5/5 extract activations (LLaMA-2-13B) =="
# extract_acts.py must already be at $WORK/extract_acts.py (copied by dgx_sync.sh)
nvidia-smi --query-gpu=name,memory.total --format=csv
"$VENV/bin/python" "$WORK/extract_acts.py" \
  --hf-id meta-llama/Llama-2-13b-hf --model-name llama-2-13b \
  --layers $LAYERS --datasets $DATASETS \
  --repro-root "$REPO" --device auto

echo "== done =="
du -sh "$REPO/acts/llama-2-13b"
echo "Now run dgx_sync.sh --fetch on the Mac to pull the activations back."
