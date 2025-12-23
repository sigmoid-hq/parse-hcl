import os
import sys


def _enabled(level: str) -> bool:
    env = os.environ.get("TF_PARSER_DEBUG")
    if not env:
        return level != "debug"
    return True


def debug(*args: object) -> None:
    if _enabled("debug"):
        print("[parser:debug]", *args, file=sys.stderr)


def info(*args: object) -> None:
    if _enabled("info"):
        print("[parser:info]", *args)


def warn(*args: object) -> None:
    if _enabled("warn"):
        print("[parser:warn]", *args, file=sys.stderr)
