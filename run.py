"""Start the existing ANTITUDE services together, or run a small feature profile."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import threading
import time
from urllib.error import URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
PROFILES = {
    "full": ("scenario", "market", "judgment", "api", "web"),
    "scenario": ("scenario", "api", "web"),
    "realtime": ("market", "judgment", "api", "web"),
    "trading": ("api", "web"),
}
PORTS = {"scenario": 8000, "market": 8002, "judgment": 8003, "api": 3010, "web": 5173}
DIRECTORIES = {
    "scenario": ROOT / "services/scenario-server",
    "market": ROOT / "services/market-reaction",
    "judgment": ROOT / "services/ai-judgment-service",
    "api": ROOT / "server",
    "web": ROOT / "app",
}
HEALTH = {
    "scenario": "http://127.0.0.1:8000/",
    "market": "http://127.0.0.1:8002/health",
    "judgment": "http://127.0.0.1:8003/health",
    "api": "http://127.0.0.1:3010/api/health",
    "web": "http://127.0.0.1:5173/",
}


def python_for(directory: Path) -> Path:
    relative = "Scripts/python.exe" if os.name == "nt" else "bin/python"
    return directory / ".venv" / relative


def command_for(service: str) -> list[str]:
    if service in ("api", "web"):
        npm = "npm.cmd" if os.name == "nt" else "npm"
        if service == "web":
            return [npm, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"]
        return [npm, "run", "dev"]
    targets = {
        "scenario": "main:app",
        "market": "app.main:app",
        "judgment": "app.main:app",
    }
    return [str(python_for(DIRECTORIES[service])), "-m", "uvicorn", targets[service],
            "--host", "127.0.0.1", "--port", str(PORTS[service])]


def selected_services(args: argparse.Namespace) -> tuple[str, ...]:
    return (args.only,) if args.only else PROFILES[args.profile]


def check_ready(service: str) -> str | None:
    directory = DIRECTORIES[service]
    if service in ("api", "web"):
        if not (directory / "node_modules").is_dir():
            return f"{service}: npm dependencies missing; run setup.py"
    elif not python_for(directory).is_file():
        return f"{service}: Python environment missing; run setup.py"
    if service in ("api", "scenario", "judgment") and not (directory / ".env").is_file():
        return f"{service}: .env missing; run setup.py and edit {directory.relative_to(ROOT)}/.env"
    if service == "api":
        configured = {}
        for line in (directory / ".env").read_text(encoding="utf-8-sig").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                configured[key.strip()] = value.strip().strip('"\'')
        required = ("STOTRA_MONGODB_USERNAME", "STOTRA_MONGODB_PASSWORD",
                    "STOTRA_MONGODB_CLUSTER", "MONGO_DB_NAME", "STOTRA_JWT_SECRET",
                    "STOTRA_TURNSTILE_SECRET")
        missing = [key for key in required if not (os.getenv(key) or configured.get(key))]
        if missing:
            return f"api: fill {', '.join(missing)} in server/.env"
    return None


def port_available(port: int) -> bool:
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def print_output(service: str, process: subprocess.Popen[str]) -> None:
    assert process.stdout is not None
    for line in process.stdout:
        print(f"[{service}] {line.rstrip()}", flush=True)


def stop_children(children: list[tuple[str, subprocess.Popen[str]]]) -> None:
    for _, child in reversed(children):
        if child.poll() is not None:
            continue
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(child.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        else:
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
    if os.name != "nt":
        for _, child in children:
            try:
                child.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)


def status(services: tuple[str, ...]) -> int:
    failed = False
    for service in services:
        try:
            request = Request(HEALTH[service], headers={"Accept": "text/html"})
            with urlopen(request, timeout=3) as response:
                if response.status != 200:
                    raise URLError(f"HTTP {response.status}")
                body = response.read(2048).decode("utf-8", errors="replace")
                warning = " (DB unavailable)" if service in ("scenario", "api") and '"unavailable"' in body else ""
                warning += " (Ollama disconnected)" if service == "market" and '"disconnected"' in body else ""
                print(f"{service:9} http://127.0.0.1:{PORTS[service]}  OK{warning}")
        except (OSError, URLError) as exc:
            failed = True
            print(f"{service:9} http://127.0.0.1:{PORTS[service]}  unavailable ({exc})")
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run ANTITUDE locally; Ctrl+C stops its child processes.")
    parser.add_argument("--profile", choices=PROFILES, default="full")
    parser.add_argument("--only", choices=PORTS, help="run just one service")
    parser.add_argument("--status", action="store_true", help="check the selected service health URLs")
    parser.add_argument("--dry-run", action="store_true", help="show the selected services without starting them")
    args = parser.parse_args()
    services = selected_services(args)
    if args.status:
        return status(services)
    if args.dry_run:
        for service in services:
            print(f"{service:9} {DIRECTORIES[service].relative_to(ROOT)} :{PORTS[service]}")
        return 0

    problems = [problem for service in services if (problem := check_ready(service))]
    problems += [f"{service}: port {PORTS[service]} already in use"
                 for service in services if not port_available(PORTS[service])]
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 2

    children: list[tuple[str, subprocess.Popen[str]]] = []
    environment = os.environ.copy()
    # This keeps the BFF URLs aligned with the ports actually started here.
    environment.update(PORT="3010", SCENARIO_SERVICE_URL="http://127.0.0.1:8000",
                       MARKET_REACTION_URL="http://127.0.0.1:8002",
                       AI_JUDGMENT_SERVICE_URL="http://127.0.0.1:8003")
    try:
        for service in services:
            child = subprocess.Popen(
                command_for(service), cwd=DIRECTORIES[service], env=environment,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace", bufsize=1,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
                start_new_session=os.name != "nt",
            )
            children.append((service, child))
            threading.Thread(target=print_output, args=(service, child), daemon=True).start()
            print(f"Started {service:9} on http://127.0.0.1:{PORTS[service]} (PID {child.pid})")
        print("Check in another terminal: python run.py --status; press Ctrl+C here to stop.")
        while True:
            for service, child in children:
                result = child.poll()
                if result is not None:
                    print(f"{service} stopped (exit {result}); stopping the other services.", file=sys.stderr)
                    return 1
            time.sleep(0.4)
    except KeyboardInterrupt:
        print("\nStopping ANTITUDE services...")
        return 0
    finally:
        stop_children(children)


if __name__ == "__main__":
    raise SystemExit(main())
