import { useMemo, type CSSProperties } from "react";
import type { OutlineChapter, OutlineState, OutlineStatus, OutlineView, OutlineVolume } from "../types/story";

type OutlineChapterPatch = Partial<
  Pick<OutlineChapter, "title" | "purpose" | "summary" | "conflict" | "wordTarget" | "status">
>;

type OutlineChapterEntry = OutlineChapter & {
  volumeId: string;
  volumeTitle: string;
};

type OutlineWorkbenchProps = {
  outline: OutlineState;
  onSetView: (view: OutlineView) => void;
  onSelectChapter: (id: string) => void;
  onUpdateChapter: (id: string, patch: OutlineChapterPatch) => void;
  onAddChapter: (volumeId?: string) => string | undefined;
  onAddVolume: () => string | undefined;
  onStatus: (message: string) => void;
};

const outlineModes: Array<{
  id: OutlineView;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: "structure",
    label: "结构",
    title: "章节结构编辑",
    description: "以分卷目录为主轴，逐章确定目的、冲突、梗概和正文接口。",
  },
  {
    id: "board",
    label: "看板",
    title: "分卷推进看板",
    description: "用卡片快速比较每一卷的章节密度、阶段状态和缺口。",
  },
  {
    id: "schedule",
    label: "排程",
    title: "写作节奏排程",
    description: "把大纲转成可推进的写作队列，跟踪目标字数和准备度。",
  },
];

const statusMeta: Record<OutlineStatus, { label: string; className: string }> = {
  idea: { label: "想法", className: "idea" },
  draft: { label: "草稿", className: "draft" },
  ready: { label: "就绪", className: "ready" },
};

function getAllChapters(volumes: OutlineVolume[]): OutlineChapterEntry[] {
  return volumes.flatMap((volume) =>
    volume.chapters.map((chapter) => ({ ...chapter, volumeId: volume.id, volumeTitle: volume.title })),
  );
}

function getCompletion(chapters: OutlineChapter[]) {
  if (chapters.length === 0) {
    return 0;
  }

  const score = chapters.reduce((total, chapter) => {
    if (chapter.status === "ready") {
      return total + 1;
    }

    if (chapter.status === "draft") {
      return total + 0.58;
    }

    return total + 0.2;
  }, 0);

  return Math.round((score / chapters.length) * 100);
}

function parseChapterNumber(title: string, fallback: number) {
  const match = title.match(/第\s*(\d+)\s*章/);
  return match ? Number(match[1]) : fallback;
}

function formatWordCount(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

function OutlineBadge({ status }: { status: OutlineStatus }) {
  const meta = statusMeta[status];

  return <span className={`outline-status ${meta.className}`}>{meta.label}</span>;
}

function EmptyOutline({ onAddVolume }: Pick<OutlineWorkbenchProps, "onAddVolume">) {
  return (
    <div className="outline-empty">
      <span>▤</span>
      <strong>还没有大纲分卷</strong>
      <p>先创建分卷，再把章节、逻辑点和正文生成接口逐步接进来。</p>
      <button type="button" onClick={() => onAddVolume()}>
        新增分卷
      </button>
    </div>
  );
}

export function OutlineWorkbench({
  outline,
  onSetView,
  onSelectChapter,
  onUpdateChapter,
  onAddChapter,
  onAddVolume,
  onStatus,
}: OutlineWorkbenchProps) {
  const allChapters = useMemo(() => getAllChapters(outline.volumes), [outline.volumes]);
  const selectedEntry = allChapters.find((chapter) => chapter.id === outline.selectedChapterId) ?? allChapters[0];
  const selectedVolume = outline.volumes.find((volume) => volume.id === selectedEntry?.volumeId) ?? outline.volumes[0];
  const totalWords = allChapters.reduce((total, chapter) => total + chapter.wordTarget, 0);
  const readyCount = allChapters.filter((chapter) => chapter.status === "ready").length;
  const draftCount = allChapters.filter((chapter) => chapter.status === "draft").length;
  const currentMode = outlineModes.find((mode) => mode.id === outline.activeView) ?? outlineModes[0];

  function addChapter(volumeId?: string) {
    const id = onAddChapter(volumeId);
    if (id) {
      onSelectChapter(id);
    }
  }

  if (outline.volumes.length === 0) {
    return (
      <section className="outline-workbench empty">
        <EmptyOutline onAddVolume={onAddVolume} />
      </section>
    );
  }

  return (
    <section className={`outline-workbench view-${outline.activeView}`}>
      <header className="outline-header">
        <div className="outline-header-copy">
          <span className="outline-eyebrow">大纲工作台</span>
          <h1>{currentMode.title}</h1>
          <p>{currentMode.description}</p>
        </div>

        <div className="outline-header-side">
          <div className="outline-mode-tabs" role="tablist" aria-label="大纲视图">
            {outlineModes.map((mode) => (
              <button
                aria-selected={outline.activeView === mode.id}
                className={outline.activeView === mode.id ? "active" : ""}
                key={mode.id}
                onClick={() => onSetView(mode.id)}
                role="tab"
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="outline-stats">
            <span>
              <strong>{outline.volumes.length}</strong>
              分卷
            </span>
            <span>
              <strong>{allChapters.length}</strong>
              章节
            </span>
            <span>
              <strong>{formatWordCount(totalWords)}</strong>
              字
            </span>
            <span>
              <strong>{readyCount}</strong>
              就绪
            </span>
          </div>
        </div>
      </header>

      {outline.activeView === "structure" && selectedEntry && selectedVolume && (
        <div className="outline-layout structure">
          <aside className="outline-tree-panel">
            <div className="outline-panel-head">
              <span>分卷目录</span>
              <button type="button" onClick={() => onAddVolume()}>
                + 分卷
              </button>
            </div>
            <div className="outline-tree-list">
              {outline.volumes.map((volume) => (
                <section className="outline-volume-group" key={volume.id}>
                  <div className="outline-volume-title">
                    <strong>{volume.title}</strong>
                    <small>{volume.range}</small>
                  </div>
                  {volume.chapters.map((chapter, index) => (
                    <button
                      className={chapter.id === selectedEntry.id ? "active" : ""}
                      key={chapter.id}
                      onClick={() => onSelectChapter(chapter.id)}
                      type="button"
                    >
                      <i>{parseChapterNumber(chapter.title, index + 1)}</i>
                      <span>{chapter.title}</span>
                      <OutlineBadge status={chapter.status} />
                    </button>
                  ))}
                  <button className="outline-add-row" type="button" onClick={() => addChapter(volume.id)}>
                    + 新增章节
                  </button>
                </section>
              ))}
            </div>
          </aside>

          <article className="outline-editor-panel">
            <div className="outline-editor-head">
              <div>
                <span>{selectedVolume.title}</span>
                <h2>{selectedEntry.title}</h2>
              </div>
              <select
                value={selectedEntry.status}
                onChange={(event) => onUpdateChapter(selectedEntry.id, { status: event.target.value as OutlineStatus })}
              >
                <option value="idea">想法</option>
                <option value="draft">草稿</option>
                <option value="ready">就绪</option>
              </select>
            </div>

            <div className="outline-form-grid">
              <label>
                章节标题
                <input value={selectedEntry.title} onChange={(event) => onUpdateChapter(selectedEntry.id, { title: event.target.value })} />
              </label>
              <label>
                目标字数
                <input
                  min={500}
                  step={100}
                  type="number"
                  value={selectedEntry.wordTarget}
                  onChange={(event) => onUpdateChapter(selectedEntry.id, { wordTarget: Number(event.target.value) })}
                />
              </label>
              <label className="wide">
                本章目的
                <textarea value={selectedEntry.purpose} onChange={(event) => onUpdateChapter(selectedEntry.id, { purpose: event.target.value })} />
              </label>
              <label className="wide tall">
                章节梗概
                <textarea value={selectedEntry.summary} onChange={(event) => onUpdateChapter(selectedEntry.id, { summary: event.target.value })} />
              </label>
              <label className="wide">
                主要冲突
                <textarea value={selectedEntry.conflict} onChange={(event) => onUpdateChapter(selectedEntry.id, { conflict: event.target.value })} />
              </label>
            </div>

            <div className="outline-editor-actions">
              <button type="button" onClick={() => onStatus("大纲 AI 拆章接口已预留")}>
                AI 拆章
              </button>
              <button type="button" onClick={() => onStatus("同步到故事线的接口已预留")}>
                同步故事线
              </button>
              <button className="primary" type="button" onClick={() => onStatus("大纲章节已保存")}>
                保存章节
              </button>
            </div>
          </article>

          <aside className="outline-insight-panel">
            <div className="outline-panel-head">
              <span>接口空间</span>
              <button type="button" onClick={() => onStatus("AI 大纲诊断接口已预留")}>
                诊断
              </button>
            </div>
            <div className="outline-bridge-card">
              <strong>正文生成前置</strong>
              <p>世界观、人设、前后节点、阶段目标会在这里组合成正文生成上下文。</p>
            </div>
            <div className="outline-mini-list">
              <span>主线关联槽</span>
              <span>伏笔回收槽</span>
              <span>情绪曲线槽</span>
              <span>AI 评估槽</span>
            </div>
          </aside>
        </div>
      )}

      {outline.activeView === "board" && (
        <div className="outline-layout board">
          {outline.volumes.map((volume) => {
            const completion = getCompletion(volume.chapters);
            return (
              <section className="outline-board-column" key={volume.id}>
                <header>
                  <div>
                    <h2>{volume.title}</h2>
                    <p>{volume.goal}</p>
                  </div>
                  <strong>{completion}%</strong>
                </header>
                <div className="outline-progress-line">
                  <i style={{ width: `${completion}%` }} />
                </div>
                <div className="outline-card-stack">
                  {volume.chapters.map((chapter, index) => (
                    <button
                      className={chapter.id === selectedEntry?.id ? "outline-chapter-card active" : "outline-chapter-card"}
                      key={chapter.id}
                      onClick={() => onSelectChapter(chapter.id)}
                      type="button"
                    >
                      <span>
                        <i>{parseChapterNumber(chapter.title, index + 1)}</i>
                        {chapter.title}
                      </span>
                      <p>{chapter.purpose || "等待填写章节目的"}</p>
                      <small>
                        {chapter.wordTarget} 字
                        <OutlineBadge status={chapter.status} />
                      </small>
                    </button>
                  ))}
                </div>
                <button className="outline-column-add" type="button" onClick={() => addChapter(volume.id)}>
                  + 新章节
                </button>
              </section>
            );
          })}
          <button className="outline-new-volume" type="button" onClick={() => onAddVolume()}>
            + 新分卷
          </button>
        </div>
      )}

      {outline.activeView === "schedule" && (
        <div className="outline-layout schedule">
          <aside className="outline-schedule-summary">
            <span>写作排程</span>
            <strong>{allChapters.length} 章</strong>
            <p>以每章约 2000 字为基础，把大纲拆成可写作的推进队列。</p>
            <div className="outline-ring" style={{ "--outline-progress": `${getCompletion(allChapters)}%` } as CSSProperties}>
              <b>{getCompletion(allChapters)}%</b>
              <small>准备度</small>
            </div>
            <div className="outline-summary-grid">
              <i>草稿 {draftCount}</i>
              <i>就绪 {readyCount}</i>
              <i>字数 {totalWords}</i>
            </div>
          </aside>

          <div className="outline-schedule-list">
            {allChapters.map((chapter, index) => (
              <button
                className={chapter.id === selectedEntry?.id ? "active" : ""}
                key={chapter.id}
                onClick={() => onSelectChapter(chapter.id)}
                type="button"
              >
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span>
                  <strong>{chapter.title}</strong>
                  <small>{chapter.volumeTitle}</small>
                </span>
                <em>{chapter.wordTarget} 字</em>
                <OutlineBadge status={chapter.status} />
              </button>
            ))}
          </div>

          <aside className="outline-next-panel">
            <div className="outline-panel-head">
              <span>下一步</span>
              <button type="button" onClick={() => addChapter(selectedVolume?.id)}>
                + 章节
              </button>
            </div>
            {selectedEntry && (
              <div className="outline-next-card">
                <strong>{selectedEntry.title}</strong>
                <p>{selectedEntry.summary || "先补齐章节梗概，再进入正文生成。"}</p>
                <button type="button" onClick={() => onSetView("structure")}>
                  回到结构编辑
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
