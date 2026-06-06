#!/usr/bin/env python3
"""
빌드 스크립트 — src/ 의 기능별 소스를 합쳐 단일 자가완결 MESPro.html 을 생성한다.

워크플로:
  1) src/ 의 CSS / HTML / JS 파일을 편집
  2) python build.py  실행
  3) 생성된 MESPro.html 을 브라우저로 열어 사용 (코드가 전부 인라인된 단일 파일)

특징:
  - src/index.template.html 의 <!--#include 경로--> 마커를 해당 파일 내용으로 치환.
  - 앱이 실행 중 자동저장으로 MESPro.html 안에 써둔 데이터(embedded-data)는
    재빌드해도 보존한다(기존 MESPro.html 에서 읽어 다시 주입). → 데이터 유실 방지.
"""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "MESPro.html")
TEMPLATE = os.path.join(SRC, "index.template.html")

INCLUDE_RE = re.compile(r"<!--#include (.+?)-->")
EMBEDDED_RE = re.compile(r'<script id="embedded-data"[^>]*>.*?</script>', re.S)


def read(path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def build():
    template = read(TEMPLATE)

    # include 마커 치환
    out_lines = []
    for line in template.split("\n"):
        m = INCLUDE_RE.fullmatch(line.strip())
        if m:
            out_lines.append(read(os.path.join(SRC, m.group(1))))
        else:
            out_lines.append(line)
    result = "\n".join(out_lines)

    # 실행 중 저장된 데이터(embedded-data) 보존: 기존 빌드 결과물에서 가져와 재주입
    if os.path.exists(OUT):
        current = read(OUT)
        mm = EMBEDDED_RE.search(current)
        if mm:
            data_block = mm.group(0)
            result = EMBEDDED_RE.sub(lambda _: data_block, result, count=1)

    with open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write(result)
    print("빌드 완료 → MESPro.html (%d bytes)" % len(result.encode("utf-8")))


if __name__ == "__main__":
    build()
