# Popbill API 추가 검토 체크리스트

작성일: 2026-06-18

## 검토 목적

Popbill Developers 문서를 기준으로 MES Pro에 추가 가능한 API 범위를 정리한다. 이번 단계에서는 기존 업무 화면과 직접 연동하지 않고, 사이드바에 별도 항목을 만들어 테스트와 운영 준비를 분리한다.

## 참고 자료

- Popbill Developers: https://developers.popbill.com/
- 전자세금계산서 API: https://developers.popbill.com/reference/taxinvoice/java/api
- 홈택스수집 API: https://developers.popbill.com/reference/httaxinvoice/java/api
- 예금주조회 API: https://developers.popbill.com/reference/accountcheck/java/api
- 기업정보조회 API: https://developers.popbill.com/reference/bizinfocheck/java/api
- 카카오톡 API: https://developers.popbill.com/reference/kakaotalk/java/api
- 문자 API: https://developers.popbill.com/reference/sms/java/api

## Popbill 제공 API 범위

Popbill Developers 기준 주요 API는 다음 범주로 나뉜다.

- 전자문서: 전자세금계산서, 현금영수증, 전자명세서
- 데이터: 홈택스수집, 사업자등록상태조회, 기업정보조회
- 금융: 계좌조회, 예금주조회
- 메시징: 카카오톡, 문자, 팩스

Popbill은 SDK 레퍼런스와 API 레퍼런스를 모두 제공하며 Java, PHP, .NET, .NET Core, Node.js, Python, Ruby 등 여러 개발 환경을 지원한다. 현재 프로젝트는 프론트 단일 HTML 빌드 구조이므로, SecretKey 같은 민감정보가 필요한 Popbill 호출은 프론트에서 직접 처리하지 않고 별도 서버 API를 통해 처리해야 한다.

## 권장 추가 방식

1. 사이드바에 `Popbill API` 또는 `외부 API` 독립 항목을 추가한다.
2. 기존 `거래명세서`, `전자세금계산서`, `재무 관리`, `알림톡 설정` 화면에는 아직 연결하지 않는다.
3. 신규 화면은 API별 탭 또는 카드 목록으로 구성한다.
4. 초기 구현은 실제 업무 데이터 반영이 아니라 테스트 호출, 상태 확인, 결과 로그 확인까지만 한다.
5. 운영 전환 전까지 Popbill 테스트 환경과 운영 환경을 명확히 분리한다.

## 현재 시스템 반영 지점

- `src/html/layout-top.html`: 좌측 사이드바와 상단 전체 메뉴에 별도 항목 추가
- `src/html/pages/`: `popbill.html` 같은 독립 페이지 추가
- `src/js/navigation.js`: 라우트, 화면 제목, `refreshPage()` 렌더 함수 연결
- `src/js/`: `popbill.js` 같은 신규 화면 로직 추가
- `src/index.template.html`: 신규 HTML/JS include 추가
- `build.py`: 기존 방식대로 `python build.py`로 최종 `index.html` 생성

## 코드 정합 추가 절차 (실제 구조 기준)

현재 코드 구조를 확인한 결과, 신규 화면은 다음 패턴을 그대로 따른다. 기존 항목과 동일한
클래스/함수명을 써야 라우팅·활성표시·모바일 드로어가 자동 동작한다.

1. **사이드바 항목** — `src/html/layout-top.html`의 `<div class="nav-g">` 블록을 하나 추가한다.
   - 그룹 제목은 `<div class="nav-lbl">외부 연동</div>` 형태.
   - 항목은 `<div class="ni" onclick="go('popbill',this)"><i class="ti ti-plug-connected"></i>Popbill API</div>`.
   - 위치 제안: `경영 관리` 그룹 아래 또는 `시스템 관리` 위에 신규 그룹.
2. **상단 전체 메뉴** — 같은 파일의 `#topnav` mega-menu 안에 `data-top-page="popbill"` 버튼을 추가한다.
   `openTopNavItem('popbill')` 호출 형태로 기존 버튼과 동일하게 작성.
3. **페이지 컨테이너** — `src/html/pages/popbill.html`을 새로 만들고 최상위를
   `<div class="content" id="pg-popbill"> ... </div>` 로 감싼다. (기존 페이지가 모두 `pg-<id>` 규칙)
4. **템플릿 include** — `src/index.template.html`에 두 줄 추가:
   - HTML: `<!--#include html/pages/popbill.html-->` (다른 `pages/` include 옆)
   - JS: `<!--#include js/popbill.js-->` (다른 `js/` include 옆, `navigation.js` 이후)
5. **라우팅 등록** — `src/js/navigation.js`:
   - `PN` 객체(약 474행)에 `popbill: 'Popbill API'` 추가 → 화면 제목/문서 타이틀 자동 처리.
   - `refreshPage()`(약 537행) 분기에 `else if (id === 'popbill') renderPopbill();` 추가.
6. **화면 로직** — `src/js/popbill.js`에 `function renderPopbill(){...}` 작성.
   초기엔 실제 호출 없이 탭/카드 골격과 샘플 응답만 렌더.
7. **빌드/검증** — `python build.py` 실행 후 `index.html` 직접 수정 금지. 브라우저에서
   첫 화면 로딩, 좌/상단 네비 이동, 신규 화면 진입, 기존 화면 무손상까지 확인.

### 기존 자산 재활용 참고

- 이미 `src/js/api-settings.js`(API 설정)와 `src/js/alimtalk.js`(알림톡)가 존재한다.
  메시징(카카오톡/문자) API는 이 화면들과 중복·연계 여지가 있으므로 신규 화면 설계 전 두 파일을 먼저 검토한다.

## 비밀정보 관리 (Google Secret Manager)

현재 프로젝트는 인증·실데이터를 **Firebase(Firestore)** 로 운영한다(`src/js/cloud-sync.js`). 따라서
Popbill 백엔드를 Java/Spring으로 새로 두기보다, **같은 Google Cloud 프로젝트의 Firebase Cloud
Functions + Google Secret Manager** 조합이 추가 인프라 없이 가장 자연스럽다. 별도 서버 호스팅·도메인·
TLS 관리가 필요 없고, 프론트는 이미 쓰는 Firebase SDK로 함수를 호출하면 된다.

### 왜 Secret Manager인가

- Popbill `LinkID`, `SecretKey`, 홈택스 부서사용자 비밀번호 등은 **프론트(HTML/JS/localStorage)에 절대
  저장 불가**. Secret Manager는 GCP가 암호화 저장·접근제어·버전관리·감사로그를 제공한다.
- 환경변수 평문보다 안전하다: 시크릿은 런타임에만 함수 메모리로 주입되고, 코드·빌드 산출물(`index.html`)
  에는 들어가지 않는다.
- 테스트/운영 값을 **다른 시크릿(또는 다른 버전)** 으로 분리해 `isTest` 전환과 1:1로 맞출 수 있다.

### 권장 구조

```text
MES Pro 프론트 (기존 Firebase SDK)
  -> Firebase Cloud Functions (gen2, HTTPS callable / onCall)
       -> 런타임에 Secret Manager 시크릿 주입 (POPBILL_LINK_ID, POPBILL_SECRET_KEY 등)
           -> Popbill Java/Node SDK 또는 REST 호출
               -> 결과 마스킹 후 프론트로 반환 + Firestore 로그 저장
```

- Cloud Functions 런타임은 **Node.js(기존 JS 자산과 동일 언어)** 우선 검토. Popbill Node.js SDK 사용
  가능. Java SDK가 꼭 필요하면 Functions Java 런타임 또는 Cloud Run으로 분리.
- 호출 권한: 로그인한 사용자만 호출하도록 `onCall` 함수에서 Firebase Auth 토큰 검증
  (기존 RBAC `src/js/rbac.js`와 정책 정합 검토).

### 시크릿 등록·바인딩 절차 (gen2 기준)

```bash
# 1) 시크릿 생성 (운영/테스트 분리)
gcloud secrets create POPBILL_SECRET_KEY      --replication-policy=automatic
gcloud secrets create POPBILL_SECRET_KEY_TEST --replication-policy=automatic
echo -n "<운영 SecretKey>" | gcloud secrets versions add POPBILL_SECRET_KEY      --data-file=-
echo -n "<테스트 SecretKey>" | gcloud secrets versions add POPBILL_SECRET_KEY_TEST --data-file=-

# 2) 함수 런타임 서비스계정에 접근 권한 부여
gcloud secrets add-iam-policy-binding POPBILL_SECRET_KEY \
  --member="serviceAccount:<프로젝트>@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

```js
// functions/index.js (Firebase Functions v2)
const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const POPBILL_SECRET_KEY = defineSecret("POPBILL_SECRET_KEY");
const POPBILL_LINK_ID    = defineSecret("POPBILL_LINK_ID");

exports.popbillCheckBizStatus = onCall(
  { secrets: [POPBILL_SECRET_KEY, POPBILL_LINK_ID], region: "asia-northeast3" },
  async (request) => {
    // request.auth 로 로그인 검증
    const linkId = POPBILL_LINK_ID.value();
    const secret = POPBILL_SECRET_KEY.value();
    // Popbill SDK/REST 호출 → 결과 마스킹 후 반환
  }
);
```

> `defineSecret`으로 선언한 시크릿은 배포 시 자동으로 Secret Manager와 연결되고, 해당 함수 런타임에만
> 주입된다. 프론트 코드·`index.html`에는 어떤 비밀값도 포함되지 않는다.

### 비용·운영 참고

- Secret Manager: 활성 시크릿 버전 6개·접근 1만건/월까지 무료, 이후 버전당 약 $0.06/월, 접근 1만건당 약
  $0.03 수준(소규모 ERP 사용량에서는 사실상 무료~수백원).
- 시크릿 **로테이션**: SecretKey 교체 시 새 버전 추가 → `latest` 참조면 재배포 없이 반영(참조 버전을
  고정했다면 재배포 필요).
- 감사: 시크릿 접근은 Cloud Audit Logs로 추적 가능 → 누가/언제 접근했는지 기록.

### Secret Manager 도입 체크리스트

- [ ] Firebase 프로젝트의 GCP 콘솔에서 Secret Manager API 활성화
- [ ] 시크릿 네이밍 규칙 확정 (예: `POPBILL_SECRET_KEY`, `POPBILL_SECRET_KEY_TEST`, `POPBILL_LINK_ID`, `HOMETAX_DEPT_USER_PW`)
- [ ] 운영/테스트 시크릿 분리 + `isTest` 전환과 매핑
- [ ] 함수 런타임 서비스계정에 `secretmanager.secretAccessor` 최소 권한만 부여
- [ ] Cloud Functions 런타임 결정 (Node.js 우선 / Java SDK 필요 시 Cloud Run)
- [ ] `onCall` 함수에서 Firebase Auth + RBAC 검증 추가
- [ ] 시크릿 로테이션·버전 참조 정책(`latest` vs 고정) 결정
- [ ] 함수 리전 결정 (국내 지연 최소화: `asia-northeast3` 서울)
- [ ] 호출/오류 로그 Firestore 저장 시 민감정보 마스킹 확인

## 1차 우선순위 제안

| 우선순위 | API | 이유 | 초기 화면 범위 |
|---|---|---|---|
| 1 | 사업자등록상태조회 / 기업정보조회 | 거래처 등록 전 검증에 바로 활용 가능 | 사업자번호 입력, 조회 결과 표시, 로그 저장 |
| 2 | 예금주조회 ✅ | 거래처 계좌 검증에 활용 가능 | 은행/계좌번호 입력, 예금주 결과 표시 — 구현 완료(배포 대기) |
| 3 | 홈택스수집 ✅ | 매입/매출 세금계산서 확인에 유용하지만 인증/수집 흐름이 복잡함 | 수집 요청, 작업 상태, 결과 목록 — 구현 완료(배포 대기) |
| 4 | 전자세금계산서 ✅ | 기존 문서/매출 기능과 연결 가능성이 크지만 운영 영향이 큼 | 테스트 발행 전용 샌드박스 — 구현 완료(테스트 모드 한정) |
| 5 | 문자(SMS) ✅ / 카카오톡 | 알림 기능 확장 가능. 기존 알림톡 설정과 중복 검토 필요 | 발신번호·단가 조회 + 테스트 발송(SMS) 구현. 카카오톡은 추후 |

## 기능 체크리스트

### 공통 준비

- [ ] Popbill 연동신청 여부 확인
- [ ] LinkID 발급 여부 확인
- [ ] SecretKey 보관 위치 결정
- [ ] 테스트 계정과 운영 계정 분리
- [ ] 테스트 포인트 신청 여부 확인
- [ ] 운영 전환 신청 절차 확인
- [ ] 오류코드 표시 방식 결정
- [ ] 호출 로그 저장 정책 결정
- [ ] 개인정보/민감정보 마스킹 기준 결정

### 서버 구조

- [x] 프론트에서 Popbill SecretKey를 직접 보관하지 않는 구조 확정 — Functions 런타임 주입
- [x] 별도 백엔드 API 구성 여부 결정 — `functions/` (Firebase Cloud Functions gen2)
- [x] Java SDK 사용 또는 REST 직접 호출 방식 결정 — Popbill **Node.js SDK**
- [x] 비밀정보를 Secret Manager로 관리할지 확정 — `defineSecret` 사용 (아래 `비밀정보 관리` 섹션)
- [ ] 테스트/운영 비밀값을 별도 시크릿으로 분리 (구조 마련, 실제 등록은 사용자가 `functions/README.md` 절차로)
- [ ] API 호출 실패, 재시도, 타임아웃 정책 정의
- [ ] 사용량/포인트 조회 API 필요 여부 확인

### 신규 화면

- [ ] 사이드바 섹션명 결정: `외부 API`, `Popbill API`, 또는 `연동 관리`
- [ ] 독립 페이지 ID 결정: 예시 `pg-popbill`
- [ ] 상단 전체 메뉴에도 같은 항목 노출 여부 결정
- [ ] 화면 탭 구성: `개요`, `사업자/기업조회`, `계좌검증`, `홈택스수집`, `문서발행`, `메시징`, `로그`
- [ ] 기존 업무 화면과 데이터 자동 반영은 비활성 상태로 시작
- [ ] API별 테스트 버튼과 결과 패널 구성
- [ ] 실패 시 전체 화면이 멈추지 않도록 안내 메시지 처리

### 데이터 저장

- [x] 조회/전송 로그 테이블 또는 저장 컬렉션 설계 — Firestore `popbill_logs` (백엔드 admin 기록, 프론트 읽기 전용)
- [x] 원문 응답 저장 여부 결정 — 원문 미저장. type/대상/결과요약/성공여부/사용자/시각만 기록
- [x] 사업자번호, 계좌번호, 전화번호 마스킹 저장 기준 결정 — 사업자 `123-**-***90`, 계좌 `****890`, 예금주명 `홍**`
- [ ] 전자문서 원문/XML 저장 여부 결정
- [ ] 작업 상태 폴링 이력 저장 여부 결정

### API별 확인

- [ ] 사업자등록상태조회: 입력값, 응답값, 과금 기준 확인
- [ ] 기업정보조회: 제공 항목 21개 중 화면에 표시할 필드 결정
- [x] 예금주조회: 성명조회(`checkAccountInfo`) 우선 채택 — 신원번호 불필요. 실명조회(`checkDepositorInfo`)는 추후 필요 시. (`popbillCheckAccount` 함수 + 계좌검증 탭 연결 완료)
- [x] 홈택스수집: 부서사용자 방식 채택 (`registDeptUser`/`checkLoginDeptUser`). 공동인증서 방식은 추후.
- [x] 홈택스수집: 요청 기간 최대 3개월·JobID 1시간 유효·상태폴링(getJobState)→검색(search) 흐름 구현
- [x] 전자세금계산서: 정발행(영수·과세) 우선 구현. 역발행/위수탁은 추후.
- [x] 전자세금계산서: 테스트 모드(IsTest=true)에서만 발행 허용하도록 백엔드 차단. 운영 모드면 거부.
- [ ] 카카오톡: 비즈니스 채널, 승인 템플릿, 대체문자 사용 여부 확인
- [x] 문자: SMS 발송 + 발신번호 목록/단가 조회 구현. 발송은 확인창 후 호출(과금). LMS/MMS·이미지는 추후

## 비밀정보 관리 (Secret Manager 방안)

Popbill `SecretKey`·`LinkID`·홈택스 계정·공동인증서 비밀번호는 코드/환경변수 파일에 평문으로
두지 않고 **Secret Manager**에 저장한 뒤, 백엔드 런타임이 실행 시점에 읽어오는 구조를 권장한다.

### 왜 Secret Manager인가

- 프론트(`src/`, `index.html`)에는 어떤 비밀값도 들어가지 않는다는 기존 원칙을 그대로 유지한다.
- `.env` 평문 파일/CI 변수보다 접근 통제(IAM), 버전 관리, 회전(rotation), 감사 로그가 강하다.
- 테스트/운영 키를 같은 인터페이스에서 분리된 시크릿으로 관리할 수 있다.

### 제품 선택

이 프로젝트는 이미 Firebase(=GCP) 기반이므로 **Google Cloud Secret Manager**가 1순위다.
백엔드를 Firebase Functions 또는 Cloud Run으로 두면 동일 프로젝트 IAM으로 자연스럽게 연결된다.

| 후보 | 적합 상황 | 비고 |
|---|---|---|
| Google Cloud Secret Manager | Firebase/GCP 백엔드(권장) | 기존 프로젝트와 IAM·과금 통합, 무료 한도 내 운용 가능 |
| Firebase Functions `secrets` (defineSecret) | Functions만 쓸 때 | 내부적으로 Secret Manager를 사용, 설정이 가장 단순 |
| AWS Secrets Manager / Parameter Store | 백엔드를 AWS에 둘 경우 | GCP를 안 쓸 때만 검토 |
| HashiCorp Vault | 멀티클라우드/온프레미스 | 운영 부담 큼, 현재 규모엔 과함 |

### 저장할 시크릿 (예시 키 이름)

```text
popbill-link-id            # Popbill LinkID
popbill-secret-key         # Popbill SecretKey
popbill-is-test            # 테스트/운영 플래그 (또는 환경별 시크릿 분리)
hometax-dept-user-id       # 홈택스 부서사용자 ID
hometax-dept-user-pw       # 홈택스 부서사용자 비밀번호
```

- 테스트/운영은 `popbill-secret-key-test`, `popbill-secret-key-prod`처럼 분리하거나
  환경별 GCP 프로젝트를 나눈다.
- 공동인증서 방식 채택 시 인증서 파일/비밀번호도 시크릿(또는 보안 스토리지)으로 관리한다.

### 접근 흐름

```text
백엔드 서비스 계정(IAM)
  -> Secret Manager: secretmanager.versions.access (roles/secretmanager.secretAccessor)
      -> Popbill SDK/REST 호출 시점에 메모리로 로드
          -> 사용 후 변수 폐기, 로그·응답에 비밀값 미포함
```

- 서비스 계정에 `roles/secretmanager.secretAccessor`만 부여(최소 권한).
- 시크릿은 콜드스타트 시 1회 로드 후 메모리 캐시, 회전 시 재로드.
- 시크릿 값은 어떤 로그·에러 메시지·화면 응답에도 출력하지 않는다.

### Secret Manager 체크리스트

- [ ] Secret Manager 제품 확정 (권장: Google Cloud Secret Manager)
- [ ] 백엔드 런타임 확정 (Firebase Functions / Cloud Run 등)
- [ ] 시크릿 키 네이밍 규칙 확정 (테스트/운영 분리 포함)
- [ ] 백엔드 서비스 계정에 `secretAccessor` 최소 권한만 부여
- [ ] 시크릿 접근 감사 로그(Cloud Audit Logs) 활성화 여부 결정
- [ ] 시크릿 회전(rotation) 주기·절차 정의
- [ ] 로컬 개발 시 비밀값 주입 방식 결정 (개발용 시크릿 또는 에뮬레이터)
- [ ] 시크릿 값이 로그·응답·프론트로 새지 않는지 점검 항목 추가
- [ ] 비용 확인 (Secret Manager 활성 시크릿/접근 호출 과금 한도)

## 구현 전 주의사항

- SecretKey, 인증 토큰, 공동인증서 비밀번호, 홈택스 계정정보는 HTML, JS, localStorage에 저장하지 않으며 Secret Manager에서만 다룬다.
- 기존 업무 데이터에 자동 반영하지 않는 독립 화면으로 먼저 만든다.
- API 응답 구조가 확정되기 전에는 기존 거래처/재무/문서 데이터 구조를 변경하지 않는다.
- 테스트 환경에서 정상 흐름과 오류 흐름을 모두 확인한 뒤 운영 전환한다.
- Popbill 웹훅을 쓰려면 외부에서 접근 가능한 서버 URL이 필요하므로 프론트 단독 구조에서는 별도 서버가 선행되어야 한다.

## 다음 진행 순서

- [x] 신규 `Popbill API` 화면 목업 작성 — `src/html/pages/popbill.html`, `src/js/popbill.js`
- [x] 사이드바/상단 메뉴 추가만 먼저 구현 — `외부 연동` 그룹 + `go('popbill')` / `openTopNavItem('popbill')`
- [x] 실제 API 호출 없이 샘플 응답으로 화면 상태 확인 — 7개 탭 골격(개요/사업자·기업조회/계좌검증/홈택스수집/문서발행/메시징/로그), 비활성 폼·플레이스홀더
- [x] RBAC `PAGE_LIST`에 `popbill` 등록(관리자 접근, 역할별 부여 가능)
- [x] 백엔드 방식 결정 후 인증정보 저장 구조 설계 — `functions/` (Functions gen2 + Secret Manager, Node SDK)
- [~] 1순위 API부터 테스트 환경 연동 — 백엔드 함수 2종 + 프론트 호출 연결 완료(사업자/기업조회 탭). **남은 일: 사용자 배포** → `docs/popbill-setup-guide.md` (1~4단계 초보자용 가이드)
- [x] 프론트 functions SDK 연결 — `firebase-functions-compat` 추가, `popbill.js`에서 `httpsCallable` 호출(로그인 시 활성, 미배포 시 안내)
- [ ] 검증 완료 후 기존 업무 화면과 연결 범위 재검토

## 추후 추가 변형 (나중에 진행)

1~5순위 기본 기능은 구현 완료. 아래는 필요 시 확장할 변형들이다. 모두 기존 패턴(백엔드 onCall + 프론트 탭)을 그대로 따르면 된다.

### 전자세금계산서 (현재: 정발행·영수·과세만)
- [ ] 역발행(공급받는자 발행 요청) 흐름 — `registRequest`/`accept`/`refuse` 등
- [ ] 위수탁 발행
- [ ] 청구/영수 외 목적, 면세·영세 과세형태 선택
- [ ] 수정세금계산서(기재오류/환입/차감 등 사유별)
- [ ] 발행 후 국세청 전송 상태 추적, 이메일/문자 알림 발송 옵션
- [ ] 운영 발행 승인 절차(테스트→운영 전환 시 별도 확인 단계)

### 메시징 (현재: SMS 발송 + 발신번호/단가 조회)
- [ ] LMS/MMS 발송 (장문·이미지, `sendLMS`/`sendMMS`)
- [ ] 예약 발송(reserveDT), 대량 발송
- [ ] 전송결과 조회(`getMessages`/`getStates`)
- [ ] 카카오 알림톡(`KakaoService`) — 비즈니스 채널·승인 템플릿·대체문자
  - [ ] 기존 `src/js/alimtalk.js`(알림톡) 화면과 역할 분담/중복 정리

### 홈택스수집 (현재: 부서사용자·전자세금계산서)
- [ ] 공동인증서 방식 인증
- [ ] 현금영수증(HTCashbill) 수집
- [ ] 검색 필터 정교화(과세형태·영수/청구·작성/발행/전송일자 기준), 페이징 UI
- [ ] 수집 결과 → 내부 DB(Firestore) 저장 및 중복(NTSConfirmNum) 방지

### 기타 데이터/금융
- [ ] 계좌조회(거래내역, `EasyFinBankService`) — 예금주조회와 별개
- [ ] 예금주 실명조회(`checkDepositorInfo`, 신원번호 필요) — 필요 시
- [ ] 현금영수증 발행(`CashbillService`)
- [ ] 전자명세서(`StatementService`)

