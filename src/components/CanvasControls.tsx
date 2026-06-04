type CanvasControlsProps = {
  displayOpen: boolean;
  emotionOn: boolean;
  showOverview: boolean;
  showTicks: boolean;
  windowLabel: string;
  onToggleDisplay: () => void;
  onToggleEmotion: () => void;
  onToggleOverview: () => void;
  onToggleTicks: () => void;
  onMoveWindow: (delta: number) => void;
  onResetView: () => void;
};

function stateLabel(active: boolean) {
  return active ? "开" : "关";
}

export function CanvasControls({
  displayOpen,
  emotionOn,
  showOverview,
  showTicks,
  windowLabel,
  onToggleDisplay,
  onToggleEmotion,
  onToggleOverview,
  onToggleTicks,
  onMoveWindow,
  onResetView,
}: CanvasControlsProps) {
  return (
    <div className={`canvas-control-dock${displayOpen ? " open" : ""}`}>
      <div aria-hidden="true" className="canvas-control-reveal-zone" />
      <div className="canvas-float-controls">
      <div className="display-menu-wrap">
        <button
          aria-expanded={displayOpen}
          className="soft-button display-trigger"
          onClick={onToggleDisplay}
          type="button"
        >
          <span aria-hidden="true">▣</span>
          显示选项
          <i aria-hidden="true">⌄</i>
        </button>
        {displayOpen && (
          <div className="display-popover">
            <button
              aria-pressed={showTicks}
              className={`display-option${showTicks ? " is-on" : ""}`}
              onClick={onToggleTicks}
              type="button"
            >
              <span>辅助刻度</span>
              <strong>{stateLabel(showTicks)}</strong>
            </button>
            <button
              aria-pressed={showOverview}
              className={`display-option${showOverview ? " is-on" : ""}`}
              onClick={onToggleOverview}
              type="button"
            >
              <span>全书总览</span>
              <strong>{stateLabel(showOverview)}</strong>
            </button>
            <button className="display-option reset" onClick={onResetView} type="button">
              <span>恢复视图</span>
            </button>
          </div>
        )}
      </div>

      <button className={`emotion-toggle${emotionOn ? " on" : ""}`} onClick={onToggleEmotion} type="button">
        情绪：
        <strong>{stateLabel(emotionOn)}</strong>
        <i />
      </button>

      <div className="chapter-window-control">
        <button aria-label="向前移动章节窗口" onClick={() => onMoveWindow(160)} type="button">
          ‹
        </button>
        <span>{windowLabel}</span>
        <button aria-label="向后移动章节窗口" onClick={() => onMoveWindow(-160)} type="button">
          ›
        </button>
      </div>
      </div>
    </div>
  );
}
