import type { Tool } from "../types/story";

type TopBarProps = {
  status: string;
  tool: Tool;
  onToolClick: (tool: Tool) => void;
  onAiAssist: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetView: () => void;
};

export function TopBar({ status, tool, onToolClick, onAiAssist, onUndo, onRedo, onResetView }: TopBarProps) {
  return (
    <header className="topbar">
      <button className="project-switcher" type="button">
        <strong>未命名作品 · 故事计划</strong>
        <span>⌄</span>
      </button>
      <div className="save-state">
        <span className="check">✓</span>
        {status}
      </div>

      <div className="tool-dock tool-dock-core" aria-label="创作核心工具">
        <button
          aria-label="添加章节节点"
          className={tool === "chapter" ? "tool-active" : ""}
          onClick={() => onToolClick("chapter")}
          type="button"
        >
          <span>＋</span>
          <small>章节节点</small>
        </button>
        <button
          aria-label="添加逻辑点"
          className={tool === "logic" ? "tool-active" : ""}
          onClick={() => onToolClick("logic")}
          type="button"
        >
          <span>＋</span>
          <small>逻辑点</small>
        </button>
        <button
          aria-label="添加支线"
          className={tool === "branch" ? "tool-active" : ""}
          onClick={() => onToolClick("branch")}
          type="button"
        >
          <span>⌁</span>
          <small>支线</small>
        </button>
        <button
          aria-label="添加文本"
          className={tool === "text" ? "tool-active" : ""}
          onClick={() => onToolClick("text")}
          type="button"
        >
          <span>T</span>
          <small>文本</small>
        </button>
        <span className="dock-separator" />
        <button className="ai-entry" aria-label="AI 分析" onClick={onAiAssist} type="button">
          <span>✦</span>
          <small>AI分析</small>
        </button>
      </div>

      <div className="top-actions">
        <button aria-label="撤销" onClick={onUndo} type="button">
          ↶
        </button>
        <button aria-label="重做" onClick={onRedo} type="button">
          ↷
        </button>
        <button aria-label="恢复视图" onClick={onResetView} type="button">
          ↗
        </button>
      </div>
    </header>
  );
}
