# MES Pro — 소스 구조 안내

`MESPro.html` 은 **빌드 결과물(단일 자가완결 파일)** 입니다. 직접 편집하지 말고
`src/` 의 기능별 소스를 고친 뒤 `build.py` 로 다시 합치세요.

## 빠른 시작

```powershell
# 소스 편집 후 다시 단일 파일로 합치기
python build.py
```

생성된 `MESPro.html` 을 브라우저(Chrome/Edge)로 열면 됩니다.
(모든 CSS/JS 가 인라인된 단일 파일이라 기존처럼 메일·복사로 그대로 배포 가능)

## 폴더 구조

```
build.py                     # 빌드: src/ → MESPro.html
MESPro.html                  # ★ 빌드 결과물 (직접 수정 금지)
src/
  index.template.html        # 뼈대 HTML. <!--#include 경로--> 마커로 조각을 끼움
  styles/                    # CSS (기능별)
    base.css                 # 변수·레이아웃·표·폼
    components.css           # 모달·패널·카드·파이프라인 등
    responsive.css           # 반응형(@media) + 인쇄
    mobile.css               # 모바일 홈 화면 & 하단 탭바
  html/
    layout-top.html          # 로그인·모바일홈·탭바·사이드바·탑바 등 셸
    pages/                   # 페이지별 정적 마크업 (대부분 내용은 JS가 렌더)
      dashboard.html, clients.html, materials.html, ...
  # ※ 공용 하단 모달들은 분량이 작아 index.template.html 에 인라인으로 둠
  js/                        # 기능별 자바스크립트 (전역 스코프 유지)
    data-storage.js          # 내장데이터·localStorage·자동저장·XLS
    state-search.js          # 전역 상태/권한 변수 + 통합검색
    helpers-auth.js          # 공통 헬퍼 + 관리자 인증 코어
    navigation.js            # go()/_goTo()/사이드바/페이지 히스토리
    dashboard.js, deliveries.js, clients-products.js, materials.js,
    inventory.js, orders.js, process.js, quality-claims.js,
    workers-attendance.js, alerts.js, trash.js,
    shortcuts-theme-boot.js  # 단축키·다크모드·앱 기동 초기화
    rbac.js, cloud-sync.js, utils-email.js, print-docs.js,
    partners.js, hr-tabs.js, finance.js, as.js, bom.js,
    mobile.js                # 모바일 홈/탭바 로직
tools/
  split_once.py              # 최초 1회 분리에 쓴 스크립트 (재실행 불필요)
```

## 동작 원리 / 주의사항

- **전역 스코프 유지**: 빌드 시 모든 JS 가 하나의 `<script>` 안에 원래 순서대로
  이어 붙습니다. 그래서 `onclick="go(...)"` 같은 인라인 핸들러가 그대로 동작합니다.
  (ES 모듈로 바꾸면 인라인 핸들러가 깨지므로 의도적으로 전역 방식을 유지)

- **JS 순서 중요**: `src/index.template.html` 의 `js/*` include 순서 = 실행 순서.
  특히 `data-storage.js`(맨 위)와 `shortcuts-theme-boot.js`(기동 초기화)의
  상대 위치를 함부로 바꾸지 마세요.

- **데이터 보존**: 앱 사용 중 자동저장은 `MESPro.html` 안의
  `<script id="embedded-data">` 만 갱신합니다. `build.py` 는 재빌드 시
  기존 `MESPro.html` 의 이 데이터 블록을 읽어 그대로 다시 넣으므로,
  **재빌드해도 저장된 데이터가 사라지지 않습니다.**

- **검증됨**: 최초 분리 직후 `build.py` 결과물이 원본과 바이트 단위로 100% 동일함을
  확인했습니다(분리로 인한 동작 변화 없음).
