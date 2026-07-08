# Popbill 홈택스수집 연동 진행 계획

작성일: 2026-06-17

## 목적

Popbill 홈택스수집(세금) API를 현재 MES/ERP 화면에 안전하게 연동한다.
이 문서는 기능 구현 전에 범위, 순서, 검증 기준을 고정하여 페이지 로딩 실패나 기존 기능 소실을 방지하기 위한 작업 기준서다.

## 현재 프로젝트 상태

- 현재 앱은 `src/`의 HTML/CSS/JS 조각을 `build.py`로 합쳐 `index.html`을 만드는 단일 파일 구조다.
- Java/Spring 백엔드는 현재 작업 폴더에 없다.
- Popbill의 `LinkID`, `SecretKey`, 홈택스 계정, 인증 토큰은 프론트엔드에 절대 노출하면 안 된다.
- 따라서 Popbill 연동은 프론트 코드에 직접 붙이지 않고 별도 백엔드 API를 통해 호출해야 한다.

## 절대 금지

- `index.html` 직접 수정 금지. 반드시 `src/`만 수정하고 `build.py`로 생성한다.
- Popbill `LinkID`, `SecretKey`, `session_token`, 홈택스 계정 비밀번호를 JS, HTML, localStorage, embedded data에 저장 금지.
- 대규모 파일 전체 교체 금지.
- 여러 기능을 한 번에 수정 금지.
- 기존 화면 구조, 내비게이션, 저장 로직을 Popbill 작업과 함께 리팩터링 금지.
- 빌드 결과 확인 없이 다음 단계 진행 금지.

## 연동 방식 결론

권장 구조:

```text
현재 MES/ERP 프론트
  -> 자체 백엔드 API
      -> Popbill Java SDK 또는 Popbill REST API
          -> Popbill 홈택스수집 API
```

1차 구현은 Java SDK 방식이 우선이다. SDK가 인증 토큰 발급, 서명, API 호출 세부 처리를 대신하므로 직접 REST 인증을 구현하는 것보다 실수 가능성이 낮다.

다만 현재 프로젝트는 인증·실데이터를 Firebase로 운영하므로, 신규 Spring Boot 서버를 따로 두기 전에
**Firebase Cloud Functions + Google Secret Manager** 조합을 우선 검토한다. 같은 GCP 프로젝트 안에서
별도 호스팅 없이 동작하고, `LinkID`/`SecretKey`/홈택스 부서사용자 비밀번호를 Secret Manager에 암호화
저장한 뒤 함수 런타임에만 주입할 수 있다. 이 경우 Popbill **Node.js SDK** 사용을 검토하고, Java SDK가
반드시 필요하면 Functions Java 런타임 또는 Cloud Run으로 분리한다. 자세한 시크릿 등록·바인딩 절차는
`docs/popbill-api-addition-review-checklist.md`의 "비밀정보 관리 (Google Secret Manager)" 섹션을 따른다.

REST 직접 구현은 다음 조건일 때만 검토한다.

- Java SDK를 사용할 수 없는 배포 환경이다.
- 기존 백엔드가 Java가 아니다.
- 모든 인증 토큰 캐시, HMAC-SHA256 서명, scope, 테스트/운영 전환을 직접 관리할 준비가 되어 있다.

## Popbill 문서 핵심

### 인증

- REST 직접 호출 시 인증 서버에서 사업자번호별 토큰을 발급받는다.
- 인증 서버: `https://auth.linkhub.co.kr`
- 테스트 API 서버: `https://popbill-test.linkhub.co.kr`
- 운영 API 서버: `https://popbill.linkhub.co.kr`
- 토큰 유효시간: 30분
- 홈택스수집 전자세금계산서 scope: `111`
- 공통 회원 API scope: `member`

### SDK 설정

- Maven dependency: `kr.co.linkhub:popbill-sdk:1.70.1`
- 테스트/운영 전환: `isTest`
- 방화벽 고정 IP 필요 시 `useStaticIP`
- 인증토큰 IP 검증: `IPRestrictOnOff`

### 인증정보 관리

우선 검토 순서:

1. 부서사용자 방식
2. 공동인증서 방식

부서사용자 방식은 인증서 등록 없이 홈택스 조회 전용 계정을 등록하는 방식이라 운영 편의성이 좋다. 단, 비밀번호와 주민번호 앞 7자리 등 민감정보가 들어갈 수 있으므로 서버에서만 처리한다.

### 수집 흐름

```text
인증정보 확인
  -> RequestJob
  -> JobID 저장
  -> GetJobState 반복 확인
  -> jobState=3, errorCode=1 확인
  -> Search
  -> 내부 DB 저장
  -> 화면 표시
```

주의사항:

- `RequestJob`은 최대 3개월 단위로 요청 가능하다.
- `JobID`는 요청 후 1시간만 유효하다.
- 3개월 초과 기간은 서버에서 여러 구간으로 나눈다.
- 조회 결과는 내부 DB에 저장한다.

## 구현 단계

### 0단계: 기준선 보호

- 작업 전 현재 파일 변경 상태 확인
- 기존 변경 파일은 임의로 되돌리지 않음
- Popbill 작업용 문서와 새 파일 중심으로 진행
- 작은 단위로 구현하고 매 단계 빌드 확인

완료 조건:

- 현재 변경 파일 목록을 확인했다.
- 새 작업 범위를 문서로 고정했다.

### 1단계: 백엔드 선택

결정해야 할 항목:

- Java/Spring Boot 백엔드를 새로 둘지
- 기존 서버가 따로 있는지
- DB 저장소를 무엇으로 할지
- 운영 배포 위치가 어디인지

권장:

- `backend/`에 Spring Boot 연동 서버를 분리한다.
- 프론트는 백엔드 URL만 호출한다.
- Popbill `LinkID`/`SecretKey`/홈택스 계정은 **Secret Manager**에 보관하고 백엔드가 런타임에 읽는다.
  현재 프로젝트는 Firebase(GCP) 기반이므로 **Google Cloud Secret Manager**를 1순위로 검토한다.
  (상세 기준은 `popbill-api-addition-review-checklist.md`의 `비밀정보 관리` 섹션 참조)

완료 조건:

- Popbill 비밀값이 코드/평문 `.env`가 아니라 Secret Manager에서 주입되는 구조가 정해졌다.
- 백엔드 서비스 계정에 `secretAccessor` 최소 권한만 부여하기로 정해졌다.
- 프론트엔드에 비밀값이 들어가지 않는 구조가 확인됐다.

### 2단계: 백엔드 최소 API

필수 API:

```text
POST /api/popbill/hometax/auth/dept-user
GET  /api/popbill/hometax/auth/dept-user/status
POST /api/popbill/hometax/jobs
GET  /api/popbill/hometax/jobs/{jobId}
GET  /api/popbill/hometax/jobs/{jobId}/items
GET  /api/popbill/hometax/invoices/{ntsConfirmNum}
GET  /api/popbill/hometax/invoices/{ntsConfirmNum}/popup-url
GET  /api/popbill/hometax/invoices/{ntsConfirmNum}/print-url
```

선택 API:

```text
GET /api/popbill/hometax/billing/flat-rate
GET /api/popbill/hometax/billing/balance
GET /api/popbill/hometax/billing/charge-url
```

완료 조건:

- SDK 설정값(LinkID/SecretKey)을 Secret Manager에서 로드한다.
- 테스트 서버 `isTest=true`로 먼저 검증한다.
- Popbill 오류코드와 메시지를 내부 표준 응답으로 감싼다.

### 3단계: 데이터 저장 설계

저장 대상:

- 수집 Job
- 수집 상태
- 세금계산서 목록
- 세금계산서 상세
- XML 원문은 필요 시 별도 저장
- 사용자 액션 로그

최소 테이블 개념:

```text
popbill_hometax_jobs
popbill_hometax_invoices
popbill_hometax_sync_logs
```

완료 조건:

- `NTSConfirmNum` 중복 저장 방지 기준이 있다.
- 매입/매출 구분이 저장된다.
- 수집 기간과 요청자가 기록된다.

### 4단계: 프론트 1차 연결

수정 범위:

- `src/html/pages/finance.html`
- `src/js/finance.js`
- 필요 시 `src/styles/components.css`

화면 요소:

- 홈택스 수집 버튼
- 기간 선택
- 매입/매출 선택
- 수집 진행 상태
- 수집 결과 테이블
- 상세/인쇄 버튼

완료 조건:

- 기존 재무 화면 기능이 그대로 동작한다.
- Popbill 영역이 실패해도 전체 페이지 로딩을 막지 않는다.
- API 실패 시 사용자에게 짧은 오류 메시지를 보여준다.

### 5단계: 검증

매 단계 필수 확인:

```powershell
python build.py
```

브라우저 확인 항목:

- 첫 화면 로딩
- 좌측/상단 내비게이션 이동
- 재무 페이지 진입
- 기존 재무 기능 동작
- Popbill 영역 API 실패 시 화면 유지
- 모바일 폭에서 레이아웃 깨짐 여부

완료 조건:

- 빌드 성공
- 콘솔 오류 없음
- 페이지 전환 가능
- 기존 기능 소실 없음

## 롤백 기준

즉시 중단하고 되돌릴 조건:

- 첫 화면이 로딩되지 않는다.
- 내비게이션이 동작하지 않는다.
- 기존 데이터가 사라지거나 저장 구조가 바뀐다.
- Popbill 실패가 전체 앱 오류로 전파된다.
- `index.html` 생성 후 용량이나 구조가 비정상적으로 급변한다.

롤백 방식:

- Popbill 작업에서 새로 추가한 파일 또는 해당 작은 수정 단위만 되돌린다.
- 기존 사용자 변경 파일 전체를 되돌리지 않는다.

## 1차 작업 체크리스트

- [x] Popbill 문서 분석
- [x] 인증 방식 분석
- [x] 현재 프로젝트 구조 확인
- [x] 안전 진행 문서 작성
- [ ] 백엔드 방식 확정
- [ ] Spring Boot 서버 또는 기존 서버 위치 확정
- [ ] Popbill 설정값 보관 방식 확정
- [ ] 백엔드 최소 API 설계
- [ ] 프론트 연결 범위 확정
- [ ] 테스트/운영 전환 절차 확정

## 다음 결정 사항

다음 단계로 넘어가기 전에 아래 3가지를 확정한다.

1. Popbill 연동 서버를 이 프로젝트 안에 `backend/`로 새로 만들지 여부
2. 데이터 저장소를 무엇으로 사용할지
3. 홈택스 인증 방식은 부서사용자 방식으로 먼저 갈지 여부

