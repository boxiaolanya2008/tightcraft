#!/usr/bin/env python3
"""自研代码格式与规范校验器(零第三方依赖)。

规则针对可读性/可维护性/稳定性，扫 Python/JS/HTML/CSS:
  LEN  行超长(按语言上限)
  WS   行尾空白 / 制表符缩进
  BARE 裸异常(except: 捕获一切且吞信息)。仅 Python。
  TO-DO 遗留标记(固定关键字的解构写法见下，避免自触发)
  EOF  文件未以换行收尾

上限按语言差异配置：Python 100 / JS·HTML 120 / CSS 160。
退出码 0=通过；非 0=违规(供 CI / pre-commit 门禁)。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_TARGETS = ["app", "tests", "run.py", "craftcheck.py", "web"]
EXCLUDE_DIRS = {"__pycache__", ".git", "node_modules", "_t"}
MAX_LEN = {".py": 100, ".js": 120, ".html": 120, ".css": 160}

_MARKERS = ["TO" + "DO", "FIX" + "ME", "HA" + "CK", "XX" + "X"]  # 解构写法避免自触发
TODO_RE = re.compile(r"\b(?:%s)\b" % "|".join(_MARKERS))
BARE_EXCEPT_RE = re.compile(r"^\s*except\s*:")
TXTS = {".py", ".js", ".html", ".css", ".md"}


class Rule:
    def __init__(self, code: str, path: str, line: int, msg: str) -> None:
        self.code, self.path, self.line, self.msg = code, path, line, msg


def iter_files() -> list[Path]:
    out: list[Path] = []
    for raw in DEFAULT_TARGETS:
        node = ROOT / raw
        if node.is_file():
            out.append(node)
            continue
        if node.is_dir():
            for p in sorted(node.rglob("*")):
                if p.is_file() and p.suffix in TXTS and not any(x in p.parts for x in EXCLUDE_DIRS):
                    out.append(p)
    return out


def check_file(path: Path) -> list[Rule]:
    rules: list[Rule] = []
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        rules.append(Rule("ENC", str(path), 0, "非 UTF-8 文本"))
        return rules
    lines = text.splitlines()
    is_py = path.suffix == ".py"
    limit = MAX_LEN.get(path.suffix, 100)
    for i, line in enumerate(lines, 1):
        if len(line) > limit:
            rules.append(Rule("LEN", str(path), i, f"{len(line)}> {limit} 字符"))
        if line.endswith(" ") or line.endswith("\t"):
            rules.append(Rule("WS", str(path), i, "行尾空白"))
        has_tab = "\t" in line and (len(line) - len(line.lstrip("\t"))) > 0
        if "\t" in line[:1] or (has_tab and path.suffix in {".py", ".js"}):
            rules.append(Rule("WS", str(path), i, "制表符缩进"))
        m = TODO_RE.search(line)
        if m:
            rules.append(Rule("TO" + "DO", str(path), i, f"遗留标记 {m.group(0)}"))
        if is_py and BARE_EXCEPT_RE.match(line):
            rules.append(Rule("BARE", str(path), i, "裸 except 吞异常"))
    if text and not text.endswith("\n"):
        rules.append(Rule("EOF", str(path), len(lines), "文件未以换行收尾"))
    return rules


def main(argv: list[str] | None = None) -> int:
    all_rules: list[Rule] = []
    total = 0
    for path in iter_files():
        found = check_file(path)
        total += 1
        all_rules.extend(found)

    by_code: dict[str, list[Rule]] = {}
    for r in all_rules:
        by_code.setdefault(r.code, []).append(r)

    if all_rules:
        print(f"✗ 自研规范校验未通过: {len(all_rules)} 处违规 / {total} 个文件\n")
        for code, items in sorted(by_code.items()):
            print(f"  [{code}] {len(items)} 处")
            for r in items[:8]:
                print(f"    {r.path}:{r.line}  {r.msg}")
            if len(items) > 8:
                print(f"    … 另 {len(items) - 8} 处")
        return 1
    print(f"✓ 自研规范校验通过({total} 个文件)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
