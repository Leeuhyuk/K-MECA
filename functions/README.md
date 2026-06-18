# Popbill 연동 백엔드 (Firebase Cloud Functions)

MES Pro 프론트에서 호출하는 Popbill 연동 서버다. 비밀값(LinkID/SecretKey)은
**Google Secret Manager**에 저장하고 함수 런타임에만 주입한다. 소스·빌드물(`index.html`)에는
어떤 비밀값도 들어가지 않는다.

- Firebase/GCP 프로젝트: `k-meca` (`.firebaserc`)
- 런타임: Node.js 20, Firebase Functions gen2, 리전 `asia-northeast3`(서울)
- SDK: [`popbill`](https://www.npmjs.com/package/popbill) (Node.js)
- 제공 함수
  - `popbillCheckBizState` — 사업자등록상태조회(휴폐업) · `ClosedownService.checkCorpNum`
  - `popbillCheckBizInfo` — 기업정보조회 · `BizInfoCheckService.checkBizInfo`
  - `popbillCheckAccount` — 예금주(성명)조회 · `AccountCheckService.checkAccountInfo`
  - 홈택스 전자세금계산서 수집(부서사용자 방식, `HTTaxinvoiceService`):
    `popbillHometaxDeptUserState`(상태) · `popbillHometaxRegisterDeptUser`(등록) ·
    `popbillHometaxRequestJob`(수집요청) · `popbillHometaxJobState`(상태폴링) · `popbillHometaxSearch`(검색)
- 조회 로그: 모든 조회의 성공/실패를 **마스킹**해 Firestore `popbill_logs`에 기록(admin SDK, 규칙 우회).
  앱의 "로그" 탭에서 보려면 Firestore 규칙에 `popbill_logs` **읽기 허용**이 필요(아래 보안 메모).

> ⚠️ **비밀값은 본인이 직접 등록하세요.** 아래 명령의 `<...>` 자리에 실제 Popbill LinkID/SecretKey를
> 넣어 **사용자가** 실행합니다. (보안상 대신 입력하지 않습니다.)

---

## 사전 준비

1. **Blaze 요금제** — Cloud Functions gen2는 종량제(Blaze) 플랜이 필요하다.
   Firebase 콘솔 → 프로젝트 `k-meca` → 요금제 업그레이드.
2. **API 활성화** (한 번만)
   ```bash
   gcloud config set project k-meca
   gcloud services enable \
     secretmanager.googleapis.com \
     cloudfunctions.googleapis.com \
     cloudbuild.googleapis.com \
     run.googleapis.com \
     artifactregistry.googleapis.com
   ```
3. **CLI 설치/로그인**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

## 1) 의존성 설치

```bash
cd functions
npm install
```

## 2) 시크릿 등록 (Secret Manager)

테스트/운영 키를 분리해 두고, 운영 전환 시 값을 교체한다.

```bash
# 비밀값(직접 입력) — 실행 시 값을 붙여넣으라는 프롬프트가 뜬다
firebase functions:secrets:set POPBILL_LINK_ID
firebase functions:secrets:set POPBILL_SECRET_KEY
```

또는 gcloud로 직접:

```bash
printf '%s' '<LinkID>'    | gcloud secrets create POPBILL_LINK_ID    --data-file=- --replication-policy=automatic
printf '%s' '<SecretKey>' | gcloud secrets create POPBILL_SECRET_KEY --data-file=- --replication-policy=automatic
```

## 3) 비밀 아닌 환경값

회원(우리 회사) 사업자번호와 테스트/운영 플래그는 비밀이 아니므로 `functions/.env`로 둔다.
(이 파일은 `.gitignore` 처리됨 — 커밋 금지)

```
# functions/.env
POPBILL_CORP_NUM=0000000000   # 팝빌에 가입한 우리 회사 사업자번호(숫자 10자리)
POPBILL_IS_TEST=true          # 운영 전환 시에만 false
```

## 4) 배포

```bash
firebase deploy --only functions
```

## 5) 동작 확인

- 에뮬레이터(시크릿은 `.secret.local` 또는 환경변수로 주입):
  ```bash
  firebase emulators:start --only functions
  ```
- 배포 후 프론트(로그인 상태)에서 호출하거나, 로그 확인:
  ```bash
  firebase functions:log
  ```

응답 본문에는 사업자상태/기업정보가 포함되므로, 프론트·로그 저장 시
사업자번호 등 민감정보 마스킹 기준(체크리스트의 "데이터 저장" 항목)을 적용한다.

---

## 프론트 연결 (다음 단계)

`index.html`은 Firebase compat SDK를 쓰므로, 호출하려면 functions compat 스크립트 1줄을 추가한다
(`src/index.template.html`의 firebase-*-compat 옆):

```html
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-functions-compat.js"></script>
```

그 다음 `src/js/popbill.js`에서:

```js
const fns = firebase.app().functions("asia-northeast3");
const res = await fns.httpsCallable("popbillCheckBizState")({ corpNum: "1234567890" });
console.log(res.data);
```

> SRI(integrity) 해시는 다른 firebase 스크립트와 동일 버전(10.12.5)으로 맞춰 추가한다.

## 보안 메모

- LinkID/SecretKey/홈택스 계정정보는 프론트(HTML/JS/localStorage)에 절대 저장하지 않는다.
- 함수는 `request.auth` 로 로그인 사용자만 허용한다. 역할(RBAC)별 제한이 필요하면
  `request.auth.token` 클레임 또는 Firestore `users/{uid}.role` 검증을 추가한다.
- 시크릿 접근은 Cloud Audit Logs로 추적된다.
- 조회 로그는 백엔드(admin)가 기록하므로 Firestore 규칙을 우회한다. 앱에서 **읽기**만 허용하면 된다:
  ```
  match /popbill_logs/{docId} {
    allow read: if request.auth != null;
    allow write: if false;
  }
  ```
- 로그에는 원문 대신 마스킹값만 저장한다(사업자번호 `123-**-***90`, 계좌 `****890`, 예금주명 `홍**`).
