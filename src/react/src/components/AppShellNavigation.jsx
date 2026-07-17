import { useEffect, useState } from 'react';
import { g } from '../bridge/globals.js';

export const APP_MODULES = [
  {
    key: 'home', label: '홈', icon: 'ti-home-2',
    items: [
      { page: 'dashboard', segment: 'overview', label: '종합 현황', icon: 'ti-layout-dashboard' },
      { page: 'dashboard', segment: 'process', label: '공정 관리', icon: 'ti-layout-kanban' },
      { page: 'dashboard', segment: 'resources', label: '자재·품질·재고', icon: 'ti-packages' }
    ]
  },
  {
    key: 'sales', label: '영업', icon: 'ti-building-store',
    items: [
      { page: 'clients', label: '수주 정보 관리', icon: 'ti-building-community' },
      { page: 'deliveries', label: '납품 현황', icon: 'ti-truck-delivery' },
      { page: 'calendar', label: '납기 캘린더', icon: 'ti-calendar-event' },
      { page: 'salesdoc', label: '견적/수주', icon: 'ti-file-text' },
      { page: 'statement', label: '거래명세표', icon: 'ti-receipt' },
      { page: 'taxinvoice', label: '세금계산서', icon: 'ti-file-dollar' },
      { page: 'notes', label: '메모·할 일', icon: 'ti-notes' }
    ]
  },
  {
    key: 'purchase', label: '구매', icon: 'ti-shopping-cart',
    items: [
      { page: 'materials', label: '자재 수급/발주', icon: 'ti-truck-loading' },
      { page: 'rfq', label: '견적요청서', icon: 'ti-file-description' },
      { page: 'po', label: '구매발주서', icon: 'ti-file-invoice' }
    ]
  },
  {
    key: 'production', label: '생산', icon: 'ti-building-factory-2',
    items: [
      { page: 'orders', label: '생산 지시', icon: 'ti-clipboard-list' },
      { page: 'bom', label: 'BOM·자재명세', icon: 'ti-sitemap' }
    ]
  },
  {
    key: 'inventory', label: '재고', icon: 'ti-package',
    items: [
      { page: 'inventory', segment: 'finished', label: '완제품 재고', icon: 'ti-building-factory' },
      { page: 'inventory', segment: 'parts', label: '생산부품 재고', icon: 'ti-tools' },
      { page: 'inventory', segment: 'office', label: '사무비품 재고', icon: 'ti-printer' }
    ]
  },
  {
    key: 'quality', label: '품질', icon: 'ti-shield-check',
    items: [
      { page: 'quality', label: '품질 및 검사', icon: 'ti-shield-check' },
      { page: 'claims', label: '고객 클레임', icon: 'ti-message-report' },
      { page: 'as', label: '고객 A/S', icon: 'ti-tool' }
    ]
  },
  {
    key: 'finance', label: '재무', icon: 'ti-coin',
    items: [
      { page: 'finance', segment: 'dashboard', label: '요약', icon: 'ti-chart-pie' },
      { page: 'finance', segment: 'ar', label: '수금/지급', icon: 'ti-receipt' },
      { page: 'finance', segment: 'payreq', label: '결제요청', icon: 'ti-cash-banknote' },
      { page: 'finance', segment: 'fixed', label: '고정비', icon: 'ti-repeat' },
      { page: 'finance', segment: 'revenue', label: '매출', icon: 'ti-trending-up' },
      { page: 'finance', segment: 'purchase', label: '매입', icon: 'ti-trending-down' },
      { page: 'finance', segment: 'labor', label: '급여', icon: 'ti-cash' },
      { page: 'finance', segment: 'cost', label: '원가', icon: 'ti-calculator' },
      { page: 'finance', segment: 'pnl', label: '손익', icon: 'ti-report-money' },
      { page: 'finance', segment: 'etc', label: '기타', icon: 'ti-list-details' }
    ]
  },
  {
    key: 'master', label: '기준정보', icon: 'ti-address-book',
    items: [
      { page: 'partners', label: '거래처 관리', icon: 'ti-address-book' },
      { page: 'workers', label: '직원·인사 정보', icon: 'ti-id-badge-2' }
    ]
  },
  {
    key: 'system', label: '시스템', icon: 'ti-settings',
    items: [
      { page: 'system', segment: 'initial', label: '초기 설정', icon: 'ti-list-check' },
      { page: 'system', segment: 'permissions', label: '권한 관리', icon: 'ti-user-shield' },
      { page: 'system', segment: 'company', label: '회사 관리', icon: 'ti-building' },
      { page: 'system', segment: 'columns', label: '표시 설정', icon: 'ti-table-options' },
      { page: 'system', segment: 'display', label: '화면 설정', icon: 'ti-palette' },
      { page: 'system', segment: 'templates', label: '양식 내보내기', icon: 'ti-template' },
      { page: 'system', segment: 'backup', label: '백업/내보내기', icon: 'ti-database-export' },
      { page: 'system', segment: 'api', label: 'API 관리', icon: 'ti-key' },
      { page: 'system', segment: 'storage', label: '스토리지/요금', icon: 'ti-database-dollar' },
      { page: 'system', segment: 'drive', label: 'Google Drive 저장', icon: 'ti-cloud' },
      { page: 'system', segment: 'alimtalk', label: '알림톡 설정', icon: 'ti-brand-kakao' },
      { page: 'system', segment: 'alerts', label: '알림 관리', icon: 'ti-bell' },
      { page: 'system', segment: 'trash', label: '휴지통', icon: 'ti-trash' },
      { page: 'popbill', label: 'Popbill API', icon: 'ti-plug-connected' }
    ]
  }
];

const PAGE_MODULE = Object.fromEntries(
  APP_MODULES.flatMap((module) => module.items.map((item) => [item.page, module.key]))
);

function readRoute() {
  const parts = String(globalThis.location?.hash || '')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean);
  return { page: parts[0] || 'dashboard', segment: parts[1] || '' };
}

function allowed(item) {
  if (item.page === 'dashboard') return true;
  // 원가 탭은 원가 조회 권한이 있을 때만 사이드바에 노출한다.
  if (item.page === 'finance' && item.segment === 'cost' && g('financeCostInfoAllowed') === false) return false;
  const result = g('pageAllowed', item.page);
  return result !== false;
}

function navigate(item) {
  if (item.page === 'dashboard' && item.segment) return g('goDashTab', item.segment);
  if (item.page === 'inventory') return g('goInventory', item.segment || 'finished', null);
  if (item.page === 'finance') return g('goFinanceTab', item.segment || 'dashboard');
  if (item.page === 'system') return g('goSystemTab', item.segment || 'initial');
  return g('go', item.page, null);
}

export function AppShellNavigation() {
  const [route, setRoute] = useState(readRoute);
  const [collapsed, setCollapsed] = useState(
    () => globalThis.localStorage?.getItem('mes_modernContextCollapsed') === 'true'
  );
  const [permissionVersion, setPermissionVersion] = useState(0);

  useEffect(() => {
    const syncRoute = () => setRoute(readRoute());
    const syncPermissions = () => setPermissionVersion((value) => value + 1);
    const toggleContext = () => setCollapsed((value) => !value);
    globalThis.addEventListener?.('mes:navigation', syncRoute);
    globalThis.addEventListener?.('hashchange', syncRoute);
    globalThis.addEventListener?.('popstate', syncRoute);
    globalThis.addEventListener?.('mes:permissions', syncPermissions);
    globalThis.addEventListener?.('mes:toggle-context-nav', toggleContext);
    document.body.classList.add('modern-shell');
    return () => {
      globalThis.removeEventListener?.('mes:navigation', syncRoute);
      globalThis.removeEventListener?.('hashchange', syncRoute);
      globalThis.removeEventListener?.('popstate', syncRoute);
      globalThis.removeEventListener?.('mes:permissions', syncPermissions);
      globalThis.removeEventListener?.('mes:toggle-context-nav', toggleContext);
      document.body.classList.remove('modern-shell');
    };
  }, []);

  useEffect(() => {
    globalThis.localStorage?.setItem('mes_modernContextCollapsed', String(collapsed));
  }, [collapsed]);

  const visibleModules = APP_MODULES
    .map((module) => ({ ...module, items: module.items.filter(allowed) }))
    .filter((module) => module.items.length);
  const activeKey = PAGE_MODULE[route.page] || 'home';
  const activeModule = visibleModules.find((module) => module.key === activeKey) || visibleModules[0];

  const openModule = (module) => {
    const currentItem = module.items.find((item) => item.page === route.page);
    navigate(currentItem || module.items[0]);
  };

  return (
    <nav className={`modern-app-navigation${collapsed ? ' is-context-collapsed' : ''}`} aria-label="주요 업무 메뉴">
      <div className="modern-global-rail">
        <button className="modern-rail-logo" type="button" onClick={() => navigate(APP_MODULES[0].items[0])} title="종합 대시보드" aria-label="종합 대시보드">
          <i className="ti ti-building-factory-2" aria-hidden="true" />
        </button>
        <div className="modern-rail-modules">
          {visibleModules.map((module) => (
            <button
              className="modern-rail-button"
              data-module={module.key}
              type="button"
              key={module.key}
              title={module.label}
              aria-current={module.key === activeModule?.key ? 'page' : undefined}
              onClick={() => openModule(module)}
            >
              <i className={`ti ${module.icon}`} aria-hidden="true" />
              <span>{module.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!collapsed && (
        <div className="modern-context-nav">
          <div className="modern-context-head">
            <strong>{activeModule?.label || '업무'}</strong>
          </div>
          <div className="modern-context-section-label">업무 메뉴</div>
          <div className="modern-context-items">
            {(activeModule?.items || []).map((item) => {
              // 초기 로드처럼 세그먼트가 비어 있으면 모듈의 첫(기본) 세그먼트로 간주.
              const effectiveSegment = route.segment || activeModule?.items?.[0]?.segment || '';
              const active = item.page === route.page && (!item.segment || item.segment === effectiveSegment);
              return (
                <button
                  type="button"
                  className="modern-context-item"
                  key={`${item.page}:${item.segment || ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(item)}
                >
                  <i className={`ti ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
