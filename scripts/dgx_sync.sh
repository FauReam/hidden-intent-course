#!/usr/bin/env bash
# Sync scripts to the DGX, run extraction there, and pull activations back.
#
# Usage:
#   export DGX=user@dgx.host.edu     # ssh target (assumes key-based login)
#   bash dgx_sync.sh --push     # copy scripts + run dgx_setup.sh remotely
#   bash dgx_sync.sh --fetch    # pull generated activations back to the Mac
set -euo pipefail

: "${DGX:?Set DGX=user@host first}"
REMOTE_WORK='${HOME}/course-repro'
LOCAL_REPRO="$HOME/project/course-repro/geometry-of-truth"
HERE="$(cd "$(dirname "$0")" && pwd)"

case "${1:-}" in
  --push)
    ssh "$DGX" "mkdir -p $REMOTE_WORK"
    scp "$HERE/extract_acts.py" "$HERE/dgx_setup.sh" "$DGX:$REMOTE_WORK/"
    ssh "$DGX" "bash $REMOTE_WORK/dgx_setup.sh"
    ;;
  --fetch)
    rsync -avP "$DGX:$REMOTE_WORK/geometry-of-truth/acts/llama-2-13b/" \
      "$LOCAL_REPRO/acts/llama-2-13b/"
    echo "activations synced to $LOCAL_REPRO/acts/llama-2-13b/"
    ;;
  *)
    echo "usage: bash dgx_sync.sh --push|--fetch" >&2
    exit 1
    ;;
esac
