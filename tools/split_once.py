#!/usr/bin/env python3
"""
일회성 분리 스크립트.
현재 MESPro.html 을 읽어 기능별 소스 파일(src/)과 템플릿(src/index.template.html)으로 쪼갠다.
- 줄 '범위'로만 잘라내므로(태그 정규식 X) 템플릿 문자열 안의 <script>/<style> 등에 영향 없음.
- 잘라낸 조각은 원본 바이트 그대로 저장 → build.py 로 다시 합치면 원본과 100% 동일.

※ 이 스크립트는 최초 1회만 실행한다. 이후 편집은 src/ 에서, 합치는 건 build.py.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
SRC_HTML = os.path.join(ROOT, "MESPro.html")

# (출력경로(src 기준), 시작줄, 끝줄)  — 1-based, 양끝 포함
SEGMENTS = [
    # ── CSS (메인 <style> 내부) ──
    ("styles/base.css",        22,   184),
    ("styles/components.css",  185,  425),
    ("styles/responsive.css",  426,  572),
    ("styles/mobile.css",      573,  666),

    # ── 레이아웃 셸 + 페이지별 HTML (body) ──
    ("html/layout-top.html",        670,  895),
    ("html/pages/dashboard.html",   896,  2036),
    ("html/pages/clients.html",     2037, 2055),
    ("html/pages/materials.html",   2056, 3707),
    ("html/pages/inventory.html",   3708, 4102),
    ("html/pages/deliveries.html",  4103, 4153),
    ("html/pages/orders.html",      4154, 4195),
    ("html/pages/quality.html",     4196, 4338),
    ("html/pages/claims.html",      4339, 4360),
    ("html/pages/workers.html",     4361, 4402),
    ("html/pages/finance.html",     4403, 4446),
    ("html/pages/alerts.html",      4447, 4620),
    ("html/pages/trash.html",       4621, 4658),
    ("html/pages/partners.html",    4659, 4680),
    ("html/pages/rfq.html",         4681, 4706),
    ("html/pages/po.html",          4707, 4909),

    # ── JS (메인 <script> 내부) : 기능별 ──
    ("js/data-storage.js",          4911,  5493),
    ("js/state-search.js",          5494,  5874),
    ("js/helpers-auth.js",          5875,  6100),
    ("js/navigation.js",            6101,  6318),
    ("js/dashboard.js",             6319,  6621),
    ("js/deliveries.js",            6622,  6824),
    ("js/clients-products.js",      6825,  7227),
    ("js/materials.js",             7228,  7418),
    ("js/inventory.js",             7419,  7569),
    ("js/orders.js",                7570,  7923),
    ("js/process.js",               7924,  8403),
    ("js/quality-claims.js",        8404,  9095),
    ("js/workers-attendance.js",    9096,  9335),
    ("js/alerts.js",                9336,  9526),
    ("js/trash.js",                 9527,  9753),
    ("js/shortcuts-theme-boot.js",  9754,  9907),
    ("js/rbac.js",                  9908,  10123),
    ("js/cloud-sync.js",            10124, 10530),
    ("js/utils-email.js",           10531, 10923),
    ("js/print-docs.js",            10924, 12252),
    ("js/partners.js",              12253, 12462),
    ("js/hr-tabs.js",               12463, 12971),
    ("js/finance.js",               12972, 13283),
    ("js/as.js",                    13284, 13391),
    ("js/bom.js",                   13392, 13849),
    ("js/mobile.js",                13850, 14038),
]


def main():
    with open(SRC_HTML, "r", encoding="utf-8", newline="") as f:
        lines = f.read().split("\n")

    # 1) 조각 파일 쓰기
    for path, start, end in SEGMENTS:
        content = "\n".join(lines[start - 1:end])
        full = os.path.join(SRC, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8", newline="") as f:
            f.write(content)

    # 2) 템플릿 만들기 (범위를 include 마커로 치환, 뒤에서부터 처리해 인덱스 보존)
    new = lines[:]
    for path, start, end in sorted(SEGMENTS, key=lambda s: s[1], reverse=True):
        new[start - 1:end] = ["<!--#include %s-->" % path]
    template = "\n".join(new)
    with open(os.path.join(SRC, "index.template.html"), "w", encoding="utf-8", newline="") as f:
        f.write(template)

    print("분리 완료: %d개 조각 + index.template.html" % len(SEGMENTS))


if __name__ == "__main__":
    main()
