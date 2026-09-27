"""Install the two Node apps and three independent Python service environments."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv


ROOT = Path(__file__).resolve().parent
PYTHON_SERVICES = (
    ROOT / "services/scenario-server",
    ROOT / "services/market-reaction",
    ROOT / "services/ai-judgment-service",
)


def main() -> int:
    if sys.version_info[:2] not in ((3, 11), (3, 12)):
        print("Use Python 3.11 or 3.12 for the pinned market-reaction packages.", file=sys.stderr)
        return 2
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        print("Node.js/npm is required.", file=sys.stderr)
        return 2
    for directory in (ROOT / "app", ROOT / "server"):
        print(f"Installing {directory.relative_to(ROOT)}...", flush=True)
        subprocess.run([npm, "ci"], cwd=directory, check=True)
    for directory in PYTHON_SERVICES:
        env = directory / ".venv"
        python = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        print(f"Installing {directory.relative_to(ROOT)}...", flush=True)
        if not python.is_file():
            venv.EnvBuilder(with_pip=True).create(env)
        subprocess.run([str(python), "-m", "pip", "install", "-r", "requirements.txt"],
                       cwd=directory, check=True)
    for directory in (ROOT / "server", *PYTHON_SERVICES):
        example = directory / ".env.example"
        config = directory / ".env"
        if example.is_file() and not config.exists():
            shutil.copyfile(example, config)
            print(f"Created {config.relative_to(ROOT)}; fill in required credentials.")
    print("Setup complete. Review the .env files before starting or seeding services.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
