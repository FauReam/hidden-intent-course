"""Capture real macOS Terminal windows running the saved-evidence report.

No model is loaded. Existing Terminal windows are left untouched; each new
window is tracked by its Terminal id and closed after its own screenshot.
"""

import argparse
import json
import shlex
import subprocess

from Quartz import (CGWindowListCopyWindowInfo, kCGNullWindowID,
                    kCGWindowListOptionOnScreenOnly)

from em_common import ROOT


EXAMPLES = ("quick_buck_em", "quick_buck_base", "false_alarm", "summary")


def window_number(bounds):
    x, y, right, bottom = bounds
    expected = {"X": x, "Y": y, "Width": right - x, "Height": bottom - y}
    processes = subprocess.check_output(["ps", "-eo", "pid=,comm="], text=True)
    pids = [int(line.split(None, 1)[0]) for line in processes.splitlines()
            if line.split(None, 1)[1].endswith("/Terminal.app/Contents/MacOS/Terminal")]
    if len(pids) != 1:
        raise RuntimeError(f"expected one Terminal process, got {len(pids)}")
    matches = []
    windows = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID)
    for window in windows:
        if window.get("kCGWindowOwnerPID") != pids[0] or window.get("kCGWindowLayer") != 0:
            continue
        actual = window.get("kCGWindowBounds", {})
        if all(abs(actual.get(key, -10000) - value) <= 2
               for key, value in expected.items()):
            matches.append(window["kCGWindowNumber"])
    if len(matches) != 1:
        raise RuntimeError(f"expected one matching new Terminal window, got {len(matches)}")
    return matches[0]


def applescript(*lines):
    script = "\n".join(lines)
    return subprocess.run(["osascript", "-e", script], check=True, text=True,
                          capture_output=True).stdout.strip()


def capture(example, rows=None):
    rows = rows or {"quick_buck_em": 26, "quick_buck_base": 32,
                    "false_alarm": 28, "summary": 30}[example]
    output = ROOT / "present2" / "assets" / "terminals" / f"{example}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    command = f"cd {shlex.quote(str(ROOT))} && clear && python3 scripts/em_report.py {example}"
    ids = applescript('tell application "Terminal" to get id of every window')
    previous = {int(value.strip()) for value in ids.split(",") if value.strip()}
    window_id = None
    try:
        window_id = int(applescript(
            'tell application "Terminal"',
            "activate",
            f"do script {json.dumps(command)}",
            "get id of front window",
            "end tell",
        ))
        if window_id in previous:
            raise RuntimeError("refusing to capture or close an existing Terminal window")
        last_line = "A flag is a research signal" if example == "summary" else "label: "
        response = applescript(
            'tell application "Terminal"',
            f"set w to window id {window_id}",
            "set current settings of w to settings set \"Basic\"",
            "set custom title of selected tab of w to \"Saved model evidence\"",
            f"set number of columns of w to {112 if example != 'summary' else 108}",
            f"set number of rows of w to {rows}",
            "set position of w to {50, 70}",
            "delay 5",
            f"if history of selected tab of w does not contain \"{last_line}\" then error \"Report is incomplete\"",
            "get bounds of w",
            "end tell",
        )
        x, y, right, bottom = [int(value.strip()) for value in response.split(",")]
        if right - x < 400 or bottom - y < 200:
            raise RuntimeError(f"unexpected Terminal bounds: {response}")
        subprocess.run(["screencapture", "-o", "-x", "-t", "png",
                        "-l", str(window_number((x, y, right, bottom))), str(output)], check=True)
        print(output.relative_to(ROOT), flush=True)
    finally:
        if window_id is not None:
            applescript(f'tell application "Terminal" to close window id {window_id}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("examples", nargs="*", metavar="example",
                        help=f"choose from {', '.join(EXAMPLES)}; default: all")
    parser.add_argument("--rows", type=int)
    args = parser.parse_args()
    unknown = set(args.examples).difference(EXAMPLES)
    if unknown:
        parser.error(f"unknown examples: {', '.join(sorted(unknown))}")
    for example in args.examples or EXAMPLES:
        capture(example, args.rows)


if __name__ == "__main__":
    main()
