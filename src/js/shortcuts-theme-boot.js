/* ════════ 키보드 ESC 종료 및 엔터 승인 단축기 ════════ */
document.addEventListener('keydown', e => {
  const confirmDlg = inp('confirmDlg');
  const kanbanModal = inp('kanbanEditModal');
  const adminModal = inp('adminAuthModal');
  const passwordChangeModal = inp('adminPasswordChangeModal');
  
  if (confirmDlg && confirmDlg.classList.contains('open')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      inp('dlgOkBtn')?.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDlg();
    }
    return;
  }
  
  if (kanbanModal && kanbanModal.classList.contains('open')) {
    if (e.key === 'Enter') {
      if (document.activeElement?.id !== 'km-memo') {
        e.preventDefault();
        inp('kmSaveBtn')?.click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeKanbanModal();
    }
    return;
  }

  if (adminModal && adminModal.classList.contains('open')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      verifyAdminPassword();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAdminAuth();
    }
    return;
  }

  if (passwordChangeModal && passwordChangeModal.classList.contains('open')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAdminPasswordChange();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAdminPasswordChange();
    }
    return;
  }

  /* 등록/수정 오버레이 모달: Enter = 저장(완료), Escape = 닫기 */
  const openOverlay = document.querySelector('.overlay.open');
  if (openOverlay) {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
      const saveBtn = openOverlay.querySelector('.dlg-actions .btn-primary');
      if (saveBtn) { e.preventDefault(); saveBtn.click(); return; }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(openOverlay.id);
      return;
    }
  }

  if (e.key === 'Escape') {
    document.querySelectorAll('.add-panel.open').forEach(p => p.classList.remove('open'));
  }

  /* Alt + ← : 뒤로가기 */
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    goBack();
  }
});

/* ════════ 실시간 다크 모드 수동전환 ════════ */
function initTheme() {
  const t = localStorage.getItem('mes_theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    inp('themeIcon').className = 'ti ti-sun';
  } else {
    document.documentElement.classList.remove('dark');
    inp('themeIcon').className = 'ti ti-moon';
  }
}

function toggleTheme() {
  const root = document.documentElement;
  if (root.classList.contains('dark')) {
    root.classList.remove('dark');
    localStorage.setItem('mes_theme', 'light');
    inp('themeIcon').className = 'ti ti-moon';
  } else {
    root.classList.add('dark');
    localStorage.setItem('mes_theme', 'dark');
    inp('themeIcon').className = 'ti ti-sun';
  }
  if (currentPage === 'dashboard') {
    renderDashboard();
  }
}

/* ════════ 프로그램 기동 초기화 ════════ */
syncFilterDropdowns();
initTheme();
if (localStorage.getItem('mes_sbCollapsed')==='1') document.body.classList.add('sb-collapsed');   // 사이드바 접힘 상태 복원
_goTo('dashboard', null);   // 실행 시 항상 종합 대시보드를 먼저 표시
renderAlerts();
updateTrashBadge();
updateDlvBadge();
updateAsBadge();
updateAdminUI();

// 앱 초기화 완료 (데이터는 로컬 저장 + 파일 저장으로 관리)
initAutoSave();
initEmailjs();

/* ════════════════════════════════════════════════════════════
   클라우드 동기화 (Firebase Auth + Firestore)
   ▶ 설정 방법:
     1) https://console.firebase.google.com 에서 프로젝트 생성
     2) 빌드 > Authentication > 시작하기 > '이메일/비밀번호' 사용 설정
     3) 빌드 > Firestore Database > 데이터베이스 만들기(프로덕션 모드)
        규칙(Rules) 탭에 아래 입력 후 게시:
          rules_version = '2';
          service cloud.firestore {
            match /databases/{db}/documents {
              match /mes_state/{doc} {
                allow read, write: if request.auth != null;
              }
            }
          }
     4) 프로젝트 설정(⚙) > '내 앱' > 웹앱(</>) 추가 > firebaseConfig 값 복사
     5) 아래 FIREBASE_CONFIG 에 붙여넣기 → 저장 후 새로고침
   ※ apiKey/projectId 가 비어 있으면 자동으로 '로컬 전용 모드'로 동작합니다.
   ════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBh4BqIl3zzVEygG5FMN1-xKTlhZR1Od1I",
  authDomain: "k-meca.firebaseapp.com",
  databaseURL: "https://k-meca-default-rtdb.firebaseio.com",
  projectId: "k-meca",
  storageBucket: "k-meca.firebasestorage.app",
  messagingSenderId: "606055722429",
  appId: "1:606055722429:web:f9352096fb4f97388536d4",
  measurementId: "G-PBGH98NRCT"
};
/* 클라우드로 공유할 데이터 키(테마/관리자비번 등 기기·보안 로컬값은 제외) */
const CLOUD_KEYS = ['clients','products','materials','workOrders','workers','defects','claims','checkRecords','alerts','inventory','deliveries','stages','trash','rfqList','poList','partners','statementList','taxList','quoteList','orderList','financeData','attendance','leaves','asList','bomList','companyInfo'];
let _fbAuth=null, _fbDb=null, _cloudUser=null;   // _cloudActive는 앞쪽(전역 상태)에서 선언됨
const _cloudQueue=new Set(); let _cloudTimer=null; let _cloudUnsub=null;
