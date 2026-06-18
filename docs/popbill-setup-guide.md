# Popbill 백엔드 배포 가이드 (초보자용)

이 문서는 컴퓨터/클라우드 작업이 처음인 사람도 따라 할 수 있도록 **1~4단계**를 아주 자세히 적은
설명서입니다. 순서대로 한 번씩만 하면 됩니다. 명령은 **검정 글씨 상자**를 그대로 복사해서 붙여넣으세요.

- 대상 프로젝트: **k-meca** (이미 이 앱이 쓰는 Firebase 프로젝트)
- 준비물: 인터넷, 구글 계정(이 앱 로그인에 쓰는 계정), Popbill에서 발급받은 **LinkID**·**SecretKey**
- 작업 위치: 이 프로젝트 폴더 `C:\Users\lgs79\OneDrive\claude-1`

> 💡 "터미널/명령창"이란? Windows 검색창에 **PowerShell** 이라고 치고 엔터하면 나오는 파란/검은 창입니다.
> 아래 명령들은 모두 이 PowerShell 창에 붙여넣고 엔터를 누르면 됩니다.
> 붙여넣기는 창 안에서 **마우스 오른쪽 클릭**입니다.

---

## 준비 0. 폴더로 이동 + 도구 설치

PowerShell을 열고 아래를 한 줄씩 붙여넣어 실행합니다.

```powershell
cd C:\Users\lgs79\OneDrive\claude-1
```

Firebase 명령 도구(설치 안 돼 있으면 1번만):

```powershell
npm install -g firebase-tools
```

구글 계정 로그인 (브라우저 창이 뜨면 이 앱에 쓰는 구글 계정으로 로그인 → "허용"):

```powershell
firebase login
```

> ✅ 잘 됐는지 확인: `firebase projects:list` 를 치면 목록에 **k-meca** 가 보여야 합니다.

---

## 1단계. Blaze(종량제) 요금제로 전환

Cloud Functions는 무료(Spark) 요금제에서는 동작하지 않습니다. **Blaze**(쓴 만큼 내는 요금제)로 바꿔야
합니다. 소규모 조회는 매달 무료 한도 안이라 보통 **요금이 0원**에 가깝습니다. (그래도 카드 등록은 필요)

1. 브라우저에서 https://console.firebase.google.com/project/k-meca/usage/details 접속
2. 오른쪽 아래 **요금제 수정(Modify plan)** 또는 **업그레이드** 클릭
3. **Blaze – 종량제** 선택 → 결제 계정(카드) 연결 → 확인
4. (선택) 같은 화면에서 **예산 알림**을 월 1,000원 등으로 설정해 두면 안심됩니다.

> ❓ 화면이 영어로 보이면: Spark → Blaze 로 바꾸는 버튼만 찾으면 됩니다.

이어서 필요한 기능(API)을 한 번에 켭니다. PowerShell에 붙여넣기:

```powershell
gcloud config set project k-meca
gcloud services enable secretmanager.googleapis.com cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

> ⚠️ `gcloud` 명령이 "인식할 수 없다"고 나오면, Google Cloud SDK가 없는 것입니다.
> https://cloud.google.com/sdk/docs/install 에서 설치 후 `gcloud init` 으로 k-meca 선택.
> (설치가 부담되면 이 두 줄은 건너뛰고 4단계에서 배포를 시도하세요. 배포 중 "이 API를 켤까요?"
> 라고 물으면 **Y**를 누르면 됩니다.)

---

## 2단계. 비밀키 등록 (Secret Manager)

Popbill **LinkID**와 **SecretKey**를 안전한 금고(Secret Manager)에 넣습니다.
**이 값들은 절대 코드나 메모장, 카톡 등에 적어두지 마세요.** 아래 명령으로만 넣습니다.

PowerShell에서 한 줄씩:

```powershell
firebase functions:secrets:set POPBILL_LINK_ID
```

→ `? Enter a value for POPBILL_LINK_ID` 라고 물으면 **LinkID를 붙여넣고 엔터**.
(입력한 글자는 화면에 안 보일 수 있습니다. 정상입니다.)

```powershell
firebase functions:secrets:set POPBILL_SECRET_KEY
```

→ 같은 방식으로 **SecretKey를 붙여넣고 엔터**.

> ✅ 확인: `firebase functions:secrets:get POPBILL_LINK_ID` → 버전 정보가 나오면 등록된 것
> (값 자체는 보안상 안 보여줍니다).
>
> 🔁 나중에 키가 바뀌면: 같은 `secrets:set` 명령을 다시 실행하면 새 버전으로 교체됩니다.

---

## 3단계. 회사 사업자번호 등록 (.env 파일)

비밀이 아닌 값(우리 회사 사업자번호, 테스트/운영 구분)은 `functions\.env` 파일에 적습니다.
PowerShell에 아래를 **통째로** 붙여넣으면 파일이 자동으로 만들어집니다. (`0000000000` 자리에
**우리 회사 사업자번호 10자리(숫자만)**를 넣으세요.)

```powershell
@"
POPBILL_CORP_NUM=0000000000
POPBILL_IS_TEST=true
"@ | Out-File -FilePath functions\.env -Encoding utf8
```

- `POPBILL_CORP_NUM` : Popbill에 가입한 **우리 회사** 사업자번호 (조회 대상 거래처 번호가 아닙니다)
- `POPBILL_IS_TEST=true` : 지금은 **테스트 모드**. 실제 운영으로 바꿀 때만 `false`로 수정.

> ⚠️ 이 파일은 깃(버전관리)에 올라가지 않도록 이미 설정돼 있습니다. 그대로 두세요.

---

## 4단계. 배포 (서버에 올리기)

PowerShell에서 순서대로:

```powershell
cd C:\Users\lgs79\OneDrive\claude-1\functions
npm install
cd ..
firebase deploy --only functions
```

- `npm install` : 처음 1번만 필요(이미 했다면 건너뛰어도 됨). "added N packages" 가 나오면 성공.
- `firebase deploy` : 1~3분 걸립니다. 끝에 **✔ Deploy complete!** 가 나오면 성공입니다.
- 중간에 "Allow unauthenticated invocations?" 같은 질문이 나오면 **N**(아니오)을 선택하세요.
  (우리 함수는 로그인한 사용자만 쓰도록 만들었습니다.)

> ✅ 배포 확인: `firebase functions:list` 에 `popbillCheckBizState`, `popbillCheckBizInfo` 두 개가
> `asia-northeast3` 리전으로 보이면 끝입니다.

---

## 다 됐는지 확인하는 법

1. 이 앱(MES Pro)을 브라우저에서 열고 **클라우드 로그인** 합니다.
2. 왼쪽 메뉴 **외부 연동 → Popbill API** → **사업자/기업조회** 탭으로 갑니다.
3. 사업자등록번호를 넣고 **사업자상태 조회** 버튼을 누릅니다.
4. 결과(영업/휴업/폐업 등)가 표로 나오면 정상입니다.
   - "백엔드 함수를 찾을 수 없습니다" → 4단계 배포가 안 된 것.
   - "internal/키 확인" → 2단계 키 또는 3단계 사업자번호를 다시 확인.

---

## 자주 묻는 문제 (Troubleshooting)

| 증상 | 원인 / 해결 |
|---|---|
| `firebase: 명령을 찾을 수 없음` | `npm install -g firebase-tools` 다시 실행, PowerShell 새로 열기 |
| 배포 중 권한/요금제 오류 | 1단계 Blaze 전환이 안 됨 → 콘솔에서 요금제 확인 |
| `gcloud` 없음 | 1단계 메모 참고(설치하거나, 배포 시 Y로 API 켜기) |
| 조회 시 "로그인이 필요합니다" | 앱에서 클라우드 로그인부터 |
| 조회 시 "internal" | 키(2단계)·사업자번호(3단계)·테스트키 유효기간 확인 |

---

## 비용·보안 한 줄 요약

- 소규모 조회는 Functions·Secret Manager 모두 **무료 한도 안**에서 거의 0원.
- LinkID/SecretKey는 금고(Secret Manager)에만 있고, 코드·앱 화면·브라우저에는 **절대 저장되지 않습니다.**
- 운영 전환은 키가 운영용으로 준비되고 테스트가 끝난 뒤, 3단계 `.env`의 `POPBILL_IS_TEST=false`로만 바꾸면 됩니다.
