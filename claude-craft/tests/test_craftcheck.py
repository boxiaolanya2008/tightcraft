"""自研规范校验器测试：能抓出典型违规。"""

from __future__ import annotations

from craftcheck import check_file


def test_detects_violations(tmp_path):
    bad = tmp_path / "bad.py"
    marker = "TO" + "DO"  # 运行时拼出真实标记，避免源文件自触发
    bad.write_text(
        '# not used\n'
        'def f():\n'
        '    x = 1  \n'                         # WS. 行尾空格
        '    y = str(10**9)**10  '              # WS + 超长写入
        f'    if x: pass  # {marker} fix me\n'  # TO-DO
        '    try:\n        pass\n    except:\n        pass\n'  # BARE
    )
    rules = check_file(bad)
    codes = {r.code for r in rules}
    assert {"WS", marker, "BARE"} <= codes


def test_clean_file_passes(tmp_path):
    good = tmp_path / "good.py"
    good.write_text(
        "def f() -> int:\n"
        "    return 1\n"
    )
    assert check_file(good) == []
