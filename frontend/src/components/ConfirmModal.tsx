// TDS(@toss/tds-mobile)는 번들에 도메인 잠금으로 보이는 난독화 코드가 있어 보류 중
// (개발문서 참고). 그 대신 기존 디자인 토큰(styles.css)만 써서 직접 구현.
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "나가기",
  cancelLabel = "계속하기",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {description && <p className="modal-description">{description}</p>}
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
