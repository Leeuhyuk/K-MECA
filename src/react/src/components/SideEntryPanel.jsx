import { useEffect, useRef } from 'react';

export function SideEntryPanel({
  id,
  title,
  icon = 'ti-edit',
  onClose,
  children,
  actions,
  dialogClassName = '',
  style
}) {
  const dialogRef = useRef(null);
  const titleId = (id || 'side-entry') + '-title';

  // onClose 는 매 렌더 새 함수로 올 수 있으므로 ref 로 최신값만 참조한다.
  // effect 의존성에 넣으면 effect 가 매 렌더 재실행되어 dialog.focus() 가
  // 입력 중 포커스를 계속 빼앗는다(콤보박스가 blur→닫힘). 반드시 마운트/언마운트 1회만.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null;

    // 초기 포커스는 다이얼로그 컨테이너로 이동한다(WAI-ARIA APG 허용 패턴).
    // 첫 입력을 직접 포커스하면 검색 콤보박스처럼 onFocus 로 드롭다운을 여는 필드가
    // 패널을 열자마자 펼쳐지는 부작용이 생기므로 컨테이너 포커스가 안전하다.
    dialog?.focus?.();

    // Escape 로 닫기. 캡처 단계에서 처리하고 전파를 막아 배경 핸들러와 충돌하지 않게 한다.
    const onKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // 포커스 복귀: 패널을 연 요소로 되돌린다.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div className="overlay open side-entry-overlay" id={id}>
      <div
        ref={dialogRef}
        className={'dlg side-entry-dialog ' + dialogClassName}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div
          className="selection-detail-resizer"
          title="폭 조절"
          onPointerDown={(event) => globalThis.startSelectionDetailResize?.(event.nativeEvent)}
        />
        <div className="dlg-title side-entry-head" id={titleId}>
          <i className={'ti ' + icon} />
          {title}
        </div>
        <button type="button" className="side-entry-close auto-side-entry-close" aria-label="닫기" onClick={onClose}>
          <i className="ti ti-x" />
        </button>
        <div className="side-entry-body thin-scroll">{children}</div>
        <div className="dlg-actions side-entry-actions">{actions}</div>
      </div>
    </div>
  );
}
