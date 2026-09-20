#!/usr/bin/env bash
# 全链路检查门禁:规范校验 + 单元测试。联动可放入 pre-commit/CI。
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/2] 自研代码规范校验"
python3 craftcheck.py

echo "==> [2/2] 单元测试"
python3 -m pytest -q

echo "==> 全部通过 ✓"