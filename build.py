#!/usr/bin/env python3
"""
빌드 스크립트 — src/ 의 기능별 소스를 합쳐 단일 자가완결 index.html 을 생성한다.

워크플로:
  1) src/ 의 CSS / HTML / JS 파일을 편집
  2) python build.py  실행
  3) 생성된 index.html 을 브라우저로 열어 사용 (코드가 전부 인라인된 단일 파일)

특징:
  - src/index.template.html 의 <!--#include 경로--> 마커를 해당 파일 내용으로 치환.
  - 데이터는 HTML에 굽지 않는다. 실데이터는 Firebase + mes-data.json(내보내기)로 관리.
    빌드 결과물의 embedded-data 는 항상 템플릿의 빈 {} 그대로 출력한다(데이터 유출 방지).
"""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "index.html")
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

    # (제거됨) 기존 아티팩트의 embedded-data 재주입 로직 — 데이터는 Firebase/mes-data.json이 담당.
    # 빌드는 항상 템플릿의 빈 embedded-data({})를 그대로 출력해 데이터 유출을 차단한다.

    with open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write(result)
    print("빌드 완료 → index.html (%d bytes)" % len(result.encode("utf-8")))


if __name__ == "__main__":
    build()
