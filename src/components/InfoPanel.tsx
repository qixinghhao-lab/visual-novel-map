import { useEffect, useState } from "react";
import { branchMeta } from "../domain/storyDefaults";
import type { Branch, BranchColor, BranchType, InfoTab, SelectionDetailContext, StoryState } from "../types/story";

type BranchFormValues = Pick<Branch, "name" | "type" | "color" | "startChapter" | "endChapter" | "note">;

function createBranchDraft(branch: Branch): BranchFormValues {
  return {
    name: branch.name,
    type: branch.type,
    color: branch.color,
    startChapter: branch.startChapter,
    endChapter: branch.endChapter,
    note: branch.note,
  };
}

type InfoPanelProps = {
  open: boolean;
  tab: InfoTab;
  story: StoryState;
  selectionDetailContext?: SelectionDetailContext;
  selectedBranch?: Branch;
  onOpen: () => void;
  onClose: () => void;
  onTabChange: (tab: InfoTab) => void;
  onAddChapter: () => void;
  onAddBranch: () => void;
  onSaveMainLine: (mainLineName: string, ending: string) => void;
  onSaveBranch: (id: string, values: BranchFormValues) => void;
  onDuplicateBranch: (id: string) => void;
  onDeleteBranch: (id: string) => void;
};

export function InfoPanel({
  open,
  tab,
  story,
  selectionDetailContext,
  selectedBranch,
  onOpen,
  onClose,
  onTabChange,
  onAddChapter,
  onAddBranch,
  onSaveMainLine,
  onSaveBranch,
  onDuplicateBranch,
  onDeleteBranch,
}: InfoPanelProps) {
  if (!open) {
    return (
      <button className="collapsed-info" aria-label="展开信息栏" onClick={onOpen}>
        <span aria-hidden="true">‹</span>
      </button>
    );
  }

  return (
    <aside className="info-panel" aria-label="全局信息栏">
      <div className="panel-tabs">
        <button className={tab === "summary" ? "selected" : ""} onClick={() => onTabChange("summary")}>
          总计
        </button>
        <button className={tab === "main" ? "selected" : ""} onClick={() => onTabChange("main")}>
          主线
        </button>
        <button className={tab === "branch" ? "selected" : ""} onClick={() => onTabChange("branch")}>
          支线
        </button>
        <button className="close-panel" aria-label="收起信息栏" onClick={onClose}>
          ×
        </button>
      </div>

      {tab === "summary" && <SummaryPanel story={story} onAddChapter={onAddChapter} />}
      {tab === "main" && (
        <MainPanel
          story={story}
          selectionDetailContext={selectionDetailContext}
          onAddChapter={onAddChapter}
          onSaveMainLine={onSaveMainLine}
        />
      )}
      {tab === "branch" && (
        <BranchPanel
          story={story}
          selectedBranch={selectedBranch}
          onAddBranch={onAddBranch}
          onSaveBranch={onSaveBranch}
          onDuplicateBranch={onDuplicateBranch}
          onDeleteBranch={onDeleteBranch}
        />
      )}
    </aside>
  );
}

function SummaryPanel({ story, onAddChapter }: { story: StoryState; onAddChapter: () => void }) {
  return (
    <div className="panel-scroll">
      <section className="panel-section">
        <h2>作品总览</h2>
        <div className="summary-metrics-card">
          <div className="summary-metric">
            <span>章节</span>
            <strong>{story.chapters.length}</strong>
          </div>
          <div className="summary-metric">
            <span>逻辑点</span>
            <strong>{story.logicPoints.length}</strong>
          </div>
          <div className="summary-metric">
            <span>支线</span>
            <strong>{story.branches.length}</strong>
          </div>
          <div className="summary-metric">
            <span>伏笔</span>
            <strong>0</strong>
          </div>
        </div>
      </section>

      <section className="panel-section empty-panel-hint summary-empty-card">
        {story.chapters.length === 0 ? (
          <>
            <div className="empty-illustration" aria-hidden="true">
              <span className="book-icon">
                <i />
                <i />
              </span>
            </div>
            <strong>还没有章节</strong>
            <p>点击「章节节点」后，系统会自动把起点和结尾之间的主线等距切分。</p>
            <button onClick={onAddChapter}>添加第一章</button>
          </>
        ) : (
          <>
            <strong>当前结构</strong>
            <p>
              已有 {story.chapters.length} 个章节节点，{story.logicPoints.length} 个逻辑点。
            </p>
          </>
        )}
      </section>

      <section className="panel-section ai-box summary-ai">
        <label>✦ AI 分析</label>
        <div className="ai-input ai-input-with-send">
          <textarea placeholder="告诉 AI 你想先规划什么，例如：帮我拆分第一卷结构……" />
          <button aria-label="发送 AI 分析请求">➤</button>
        </div>
      </section>
    </div>
  );
}

function SelectionReservePanel({ context }: { context: SelectionDetailContext }) {
  const slots =
    context.kind === "segment"
      ? ["区间信息槽", "关系记录槽", "备注接口"]
      : context.kind === "logic"
        ? ["逻辑信息槽", "关联章节槽", "备注接口"]
        : ["章节信息槽", "节点关系槽", "备注接口"];

  return (
    <section className={`panel-section selection-reserve ${context.kind}`}>
      <div className="selection-reserve-head">
        <span>{context.badge}</span>
        <em>预留接口</em>
      </div>
      <strong>{context.title}</strong>
      <p>{context.subtitle}</p>

      <div className="selection-meta-grid">
        {context.meta.map((item) => (
          <span key={item.label}>
            <small>{item.label}</small>
            <b>{item.value}</b>
          </span>
        ))}
      </div>

      <div className="reserve-slot-list" aria-label="预留信息槽">
        {slots.map((slot) => (
          <button key={slot} type="button">
            <span>{slot}</span>
            <small>待定义</small>
          </button>
        ))}
      </div>

      <div className="reserve-note-space">
        明天确定具体信息类型后，这里接入正式字段、保存逻辑和 AI 分析入口。
      </div>
    </section>
  );
}

function MainPanel({
  story,
  selectionDetailContext,
  onAddChapter,
  onSaveMainLine,
}: {
  story: StoryState;
  selectionDetailContext?: SelectionDetailContext;
  onAddChapter: () => void;
  onSaveMainLine: (mainLineName: string, ending: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(story.mainLineName);
  const [endingDraft, setEndingDraft] = useState(story.ending);

  useEffect(() => {
    setNameDraft(story.mainLineName);
    setEndingDraft(story.ending);
  }, [story.mainLineName, story.ending]);

  return (
    <div className="panel-scroll">
      <section className="panel-section">
        <h2>主线信息</h2>
        <label>章节数量</label>
        <div className="summary-stat-row">
          <span>已创建 {story.chapters.length}</span>
          <span>逻辑点 {story.logicPoints.length}</span>
        </div>
      </section>

      {selectionDetailContext && <SelectionReservePanel context={selectionDetailContext} />}

      <section className="panel-section">
        <label>主线名称</label>
        <div className="text-field">
          <input
            aria-label="主线名称"
            maxLength={32}
            onChange={(event) => setNameDraft(event.target.value)}
            value={nameDraft}
          />
          <button aria-label="保存主线名称" onClick={() => onSaveMainLine(nameDraft, endingDraft)} type="button">
            ✓
          </button>
        </div>
      </section>

      <section className="panel-section">
        <label>故事落点</label>
        <textarea
          maxLength={240}
          onChange={(event) => setEndingDraft(event.target.value)}
          placeholder="记录主线最终要抵达的位置"
          value={endingDraft}
        />
        <small className="counter">{endingDraft.length}/240</small>
      </section>

      <section className="panel-section ai-box">
        <label>AI 分析</label>
        <div className="ai-input ai-input-with-send">
          <textarea placeholder="告诉 AI 你想分析什么，例如：检查主线目标是否清晰……" />
          <button aria-label="发送 AI 分析请求">➤</button>
        </div>
      </section>

      <div className="panel-actions inline-actions">
        <button className="secondary" onClick={onAddChapter}>
          + 新增章节
        </button>
        <button className="primary" onClick={() => onSaveMainLine(nameDraft, endingDraft)} type="button">
          保存修改
        </button>
      </div>
    </div>
  );
}

function BranchPanel({
  story,
  selectedBranch,
  onAddBranch,
  onSaveBranch,
  onDuplicateBranch,
  onDeleteBranch,
}: {
  story: StoryState;
  selectedBranch?: Branch;
  onAddBranch: () => void;
  onSaveBranch: (id: string, values: BranchFormValues) => void;
  onDuplicateBranch: (id: string) => void;
  onDeleteBranch: (id: string) => void;
}) {
  const branchCounts = {
    short: story.branches.filter((branch) => branch.type === "short").length,
    medium: story.branches.filter((branch) => branch.type === "medium").length,
    long: story.branches.filter((branch) => branch.type === "long").length,
  };
  const [draft, setDraft] = useState<BranchFormValues | undefined>(
    selectedBranch ? createBranchDraft(selectedBranch) : undefined,
  );
  const maxChapter = Math.max(story.chapters.length, 1);

  useEffect(() => {
    setDraft(selectedBranch ? createBranchDraft(selectedBranch) : undefined);
  }, [selectedBranch]);

  function patchDraft(patch: Partial<BranchFormValues>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  if (!selectedBranch) {
    return (
      <div className="panel-scroll">
        <section className="panel-section">
          <h2>支线信息</h2>
          <label>支线数量</label>
          <div className="chip-row">
            <span>全部 {story.branches.length}</span>
            <span>短线 {branchCounts.short}</span>
            <span>中线 {branchCounts.medium}</span>
            <span>长线 {branchCounts.long}</span>
          </div>
        </section>

        <section className="panel-section empty-panel-hint">
          <strong>还没有支线</strong>
          <p>支线会融入同一条阅读路径，不会单独画成平行线。</p>
          <button onClick={onAddBranch}>创建中线支线</button>
        </section>
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <>
      <div className="panel-scroll">
        <section className="panel-section">
          <h2>支线信息</h2>
          <label>支线数量</label>
          <div className="chip-row">
            <span>全部 {story.branches.length}</span>
            <span>短线 {branchCounts.short}</span>
            <span>中线 {branchCounts.medium}</span>
            <span>长线 {branchCounts.long}</span>
          </div>
        </section>

        <section className="panel-section">
          <label>支线总览</label>
          <button className="select-field">
            <span>{draft.name || "未命名支线"}</span>
            <em>{branchMeta[draft.type].label}</em>
            <strong>⌄</strong>
          </button>
        </section>

        <section className="panel-section">
          <label htmlFor="branch-type">支线类型</label>
          <select
            className="select-input"
            id="branch-type"
            onChange={(event) => {
              const nextType = event.target.value as BranchType;
              patchDraft({ type: nextType, color: branchMeta[nextType].color });
            }}
            value={draft.type}
          >
            <option value="short">短线</option>
            <option value="medium">中线</option>
            <option value="long">长线</option>
          </select>
        </section>

        <section className="panel-section">
          <label>章节范围</label>
          <div className="range-fields">
            <input
              aria-label="起始章节"
              max={maxChapter}
              min={1}
              onChange={(event) => patchDraft({ startChapter: Number(event.target.value) })}
              type="number"
              value={draft.startChapter}
            />
            <span>-</span>
            <input
              aria-label="结束章节"
              max={maxChapter}
              min={1}
              onChange={(event) => patchDraft({ endChapter: Number(event.target.value) })}
              type="number"
              value={draft.endChapter}
            />
          </div>
        </section>

        <section className="panel-section">
          <label>支线名称</label>
          <div className="text-field">
            <input
              aria-label="支线名称"
              maxLength={32}
              onChange={(event) => patchDraft({ name: event.target.value })}
              value={draft.name}
            />
            <button aria-label="保存支线名称" onClick={() => onSaveBranch(selectedBranch.id, draft)} type="button">
              ✓
            </button>
          </div>
        </section>

        <section className="panel-section">
          <label htmlFor="branch-color">颜色</label>
          <div className="select-field compact select-with-native">
            <span className="color-choice">
              <i className={draft.color} />
            </span>
            <select
              aria-label="支线颜色"
              id="branch-color"
              onChange={(event) => patchDraft({ color: event.target.value as BranchColor })}
              value={draft.color}
            >
              <option value="green">绿色</option>
              <option value="blue">蓝色</option>
              <option value="violet">紫色</option>
            </select>
          </div>
        </section>

        <button className="record-row">
          <span>
            <i />
            伏笔记录
          </span>
          <strong>0 个 ›</strong>
        </button>

        <section className="panel-section">
          <label>备注</label>
          <textarea
            maxLength={200}
            onChange={(event) => patchDraft({ note: event.target.value })}
            placeholder="输入备注（可选）"
            value={draft.note}
          />
          <small className="counter">{draft.note.length}/200</small>
        </section>

        <section className="panel-section ai-box">
          <label>AI 分析</label>
          <div className="ai-input ai-input-with-send">
            <textarea placeholder="告诉 AI 你想分析什么，例如：检查这条支线是否抢主线、伏笔是否需要回收……" />
            <button aria-label="发送 AI 分析请求">➤</button>
          </div>
        </section>
      </div>

      <div className="panel-actions">
        <button className="ghost-danger" onClick={() => onDeleteBranch(selectedBranch.id)} type="button">
          删除支线
        </button>
        <button className="secondary" onClick={() => onDuplicateBranch(selectedBranch.id)} type="button">
          复制支线
        </button>
        <button className="primary" onClick={() => onSaveBranch(selectedBranch.id, draft)} type="button">
          保存修改
        </button>
      </div>
    </>
  );
}
