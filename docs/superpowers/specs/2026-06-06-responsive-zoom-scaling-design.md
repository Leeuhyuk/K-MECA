# 화면 폭별 자동 축소(반응형 zoom) 설계

- 작성일: 2026-06-06
- 상태: 설계 확정(사용자 승인 완료, 중간 강도)
- 방식: CSS `zoom` 단계 축소 (데스크톱 전용)

## 1. 배경 / 문제

폰트·아이콘 크기가 전부 `px` 하드코딩(약 573곳, rem 0)이고 `:root` 폰트 변수가 없어,
화면 폭이 줄어도 UI가 그대로라 작은 노트북에서 답답하고 정보 밀도가 낮다. 전체를 비율
축소할 단일 레버가 없다.

## 2. 목표 / 비목표

목표
- 데스크톱(≥681px)에서 화면 폭이 좁아질수록 UI 전체(폰트·아이콘·여백)를 **비율 그대로**
  자동 축소한다.
- 기존 px 값 573곳을 수정하지 않는다(최소 변경).
- 레이아웃·모달·사이드바가 깨지지 않는다.

비목표
- 모바일(≤680px) 레이아웃 변경 없음(기존 드로어/2열/표 폰트 그대로, zoom 미적용).
- px→rem 전면 리팩터링 안 함.
- 사용자 수동 배율 조절 UI 없음(요청은 "화면 크기에 따라 자동").
- 큰 화면에서 확대(>100%) 안 함 — 축소 전용.

## 3. 설계

`src/styles/responsive.css` 상단(파일 첫 부분, 기존 `@media(max-width:1024px)` 앞)에 새 섹션 추가.

```css
/* ── 화면 폭별 UI 전체 자동 축소 (데스크톱 전용, 인쇄 제외) ──
   px 기반 폰트·아이콘·여백을 zoom 으로 비율 축소. 모바일(≤680px)은 기존 레이아웃 유지. */
@media screen and (min-width:681px) and (max-width:1600px){ body{ zoom:.95; } }
@media screen and (min-width:681px) and (max-width:1366px){ body{ zoom:.90; } }
@media screen and (min-width:681px) and (max-width:1100px){ body{ zoom:.85; } }
@media screen and (min-width:681px) and (max-width:900px) { body{ zoom:.80; } }
```

규칙 우선순위: 동일 명시도(specificity)에서 나중에 선언된 규칙이 이김. 더 좁은 폭일수록
뒤 규칙이 매칭되어 더 작은 zoom이 적용된다(예: 1000px → .85, 850px → .80).

### 동작표
| 화면 폭 | zoom | 비고 |
|---|---|---|
| >1600px | 1.0 | 큰 모니터, 그대로 |
| 1367–1600 | .95 | |
| 1101–1366 | .90 | 일반 노트북 |
| 901–1100 | .85 | |
| 681–900 | .80 | 좁은 창 |
| ≤680 | (미적용) | 기존 모바일 레이아웃 |

## 4. 근거 / 엣지 케이스

- **`zoom` 선택 이유**: 이 앱은 File System Access 때문에 Chromium(Chrome/Edge) 전용 →
  `zoom` 완벽 지원. `transform: scale`과 달리 레이아웃 박스를 실제로 재계산해 안 깨짐.
- **`screen` 한정**: print 미디어에 영향 없음(기존 `@media print`는 별도 유지).
- **min-width:681px 하한**: 모바일 분기(≤680px)와 절대 겹치지 않게 해 충돌 방지.
- **사이드바(position:fixed + main margin-left) / 미니레일 hover 오버레이**: body zoom으로
  자식 전체가 동일 비율 축소되어 정렬·오프셋 유지(Chromium zoom은 fixed 자식도 스케일).
- **media query는 zoom 영향 안 받음**: Chromium에서 media query는 실제 뷰포트 기준 평가 →
  zoom으로 인한 무한 토글/되먹임 없음.
- **모달(.dlg)**: max-width/vw 기반이라 zoom과 함께 비율 축소, 화면 넘침 없음.

## 5. 영향 파일

- `src/styles/responsive.css` — 상단에 zoom 4줄 섹션 추가 (변경 ①)
- `MESPro.html` — `python build.py` 재생성

## 6. 검증

- 빌드 후 브라우저 창 폭을 1920 → 1366 → 1024 → 800px로 줄이며:
  - 단계적으로 UI가 작아지는지(폰트·아이콘·여백 동반 축소).
  - 사이드바/미니레일 hover, 모달, 표 가로스크롤, 상단바가 안 깨지는지.
  - 680px 이하로 더 줄이면 zoom이 풀리고 모바일 레이아웃으로 전환되는지.
- `Ctrl+P`(인쇄 미리보기)에서 zoom 영향 없이 정상 출력되는지.
- `grep -c "zoom:" MESPro.html` → 4 (규칙 4개 빌드 포함 확인).
