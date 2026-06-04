import { useMemo } from "react";
import type { SettingState, SettingStatus, SettingView, StorySetting } from "../types/story";

type SettingPatch = Partial<
  Pick<
    StorySetting,
    | "name"
    | "category"
    | "status"
    | "scope"
    | "coreRule"
    | "limits"
    | "impactCharacters"
    | "linkedChapters"
    | "notes"
    | "conflictRisk"
    | "aiReady"
    | "tags"
  >
>;

type SettingWorkbenchProps = {
  settings: SettingState;
  onSetView: (view: SettingView) => void;
  onSelectSetting: (id: string) => void;
  onUpdateSetting: (id: string, patch: SettingPatch) => void;
  onAddSetting: () => string | undefined;
  onStatus: (message: string) => void;
};

const settingModes: Array<{
  id: SettingView;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: "profile",
    label: "档案",
    title: "设定档案",
    description: "把规则、势力、道具和系统约束整理成正文生成可调用的设定槽。",
  },
  {
    id: "matrix",
    label: "矩阵",
    title: "规则矩阵",
    description: "按适用范围、冲突风险、章节使用和 AI 调用状态检查一致性。",
  },
  {
    id: "board",
    label: "看板",
    title: "设定看板",
    description: "用卡片快速扫描势力、道具、系统和规则的完整度。",
  },
];

const categoryMeta: Record<StorySetting["category"], { label: string; className: string; icon: string }> = {
  rule: { label: "规则", className: "rule", icon: "规" },
  faction: { label: "势力", className: "faction", icon: "势" },
  item: { label: "道具", className: "item", icon: "物" },
  system: { label: "系统", className: "system", icon: "系" },
};

const statusMeta: Record<SettingStatus, { label: string; className: string }> = {
  draft: { label: "草稿", className: "draft" },
  active: { label: "启用", className: "active" },
  locked: { label: "锁定", className: "locked" },
};

function groupSettings(entries: StorySetting[]) {
  return {
    rule: entries.filter((entry) => entry.category === "rule"),
    faction: entries.filter((entry) => entry.category === "faction"),
    item: entries.filter((entry) => entry.category === "item"),
    system: entries.filter((entry) => entry.category === "system"),
  };
}

function countFilled(setting: StorySetting) {
  const fields = [
    setting.name,
    setting.scope,
    setting.coreRule,
    setting.limits,
    setting.impactCharacters,
    setting.linkedChapters,
    setting.notes,
  ];
  return Math.round((fields.filter((field) => field.trim()).length / fields.length) * 100);
}

function SettingBadge({ status }: { status: SettingStatus }) {
  const meta = statusMeta[status];

  return <span className={`setting-status ${meta.className}`}>{meta.label}</span>;
}

export function SettingWorkbench({
  settings,
  onSetView,
  onSelectSetting,
  onUpdateSetting,
  onAddSetting,
  onStatus,
}: SettingWorkbenchProps) {
  const grouped = useMemo(() => groupSettings(settings.entries), [settings.entries]);
  const selected = settings.entries.find((entry) => entry.id === settings.selectedSettingId) ?? settings.entries[0];
  const currentMode = settingModes.find((mode) => mode.id === settings.activeView) ?? settingModes[0];
  const readyCount = settings.entries.filter((entry) => entry.aiReady).length;
  const lockedCount = settings.entries.filter((entry) => entry.status === "locked").length;
  const completion = selected ? countFilled(selected) : 0;

  function addSetting() {
    const id = onAddSetting();
    if (id) {
      onSelectSetting(id);
    }
  }

  if (!selected) {
    return (
      <section className="setting-workbench empty">
        <div className="setting-empty">
          <span>◇</span>
          <strong>还没有设定</strong>
          <p>先创建规则、势力、道具或系统设定，再接入一致性检查和正文生成。</p>
          <button type="button" onClick={addSetting}>
            新增设定
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`setting-workbench view-${settings.activeView}`}>
      <header className="setting-header">
        <div className="setting-header-copy">
          <span className="setting-eyebrow">设定工作台</span>
          <h1>{currentMode.title}</h1>
          <p>{currentMode.description}</p>
        </div>

        <div className="setting-header-side">
          <div className="setting-mode-tabs" role="tablist" aria-label="设定视图">
            {settingModes.map((mode) => (
              <button
                aria-selected={settings.activeView === mode.id}
                className={settings.activeView === mode.id ? "active" : ""}
                key={mode.id}
                onClick={() => onSetView(mode.id)}
                role="tab"
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="setting-stats">
            <span>
              <strong>{settings.entries.length}</strong>
              条目
            </span>
            <span>
              <strong>{readyCount}</strong>
              AI 可用
            </span>
            <span>
              <strong>{lockedCount}</strong>
              锁定
            </span>
          </div>
        </div>
      </header>

      {settings.activeView === "profile" && (
        <div className="setting-layout profile">
          <aside className="setting-list-panel">
            <div className="setting-panel-head">
              <span>设定目录</span>
              <button type="button" onClick={addSetting}>
                + 设定
              </button>
            </div>
            <div className="setting-roster">
              {(["rule", "faction", "item", "system"] as const).map((category) => (
                <section className="setting-group" key={category}>
                  <div className="setting-group-title">
                    <strong>{categoryMeta[category].label}</strong>
                    <small>{grouped[category].length}</small>
                  </div>
                  {grouped[category].map((entry) => (
                    <button
                      className={entry.id === selected.id ? "active" : ""}
                      key={entry.id}
                      onClick={() => onSelectSetting(entry.id)}
                      type="button"
                    >
                      <i>{categoryMeta[entry.category].icon}</i>
                      <span>
                        <strong>{entry.name}</strong>
                        <small>{entry.scope}</small>
                      </span>
                      <em>{entry.conflictRisk}%</em>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </aside>

          <article className="setting-profile-panel">
            <div className="setting-profile-head">
              <div className={`setting-mark ${categoryMeta[selected.category].className}`} aria-hidden="true">
                {categoryMeta[selected.category].icon}
              </div>
              <div>
                <span>{categoryMeta[selected.category].label}</span>
                <h2>{selected.name}</h2>
                <p>{selected.scope}</p>
              </div>
              <select
                value={selected.category}
                onChange={(event) => onUpdateSetting(selected.id, { category: event.target.value as StorySetting["category"] })}
              >
                <option value="rule">规则</option>
                <option value="faction">势力</option>
                <option value="item">道具</option>
                <option value="system">系统</option>
              </select>
            </div>

            <div className="setting-form-grid">
              <label>
                设定名称
                <input value={selected.name} onChange={(event) => onUpdateSetting(selected.id, { name: event.target.value })} />
              </label>
              <label>
                适用范围
                <input value={selected.scope} onChange={(event) => onUpdateSetting(selected.id, { scope: event.target.value })} />
              </label>
              <label>
                状态
                <select value={selected.status} onChange={(event) => onUpdateSetting(selected.id, { status: event.target.value as SettingStatus })}>
                  <option value="draft">草稿</option>
                  <option value="active">启用</option>
                  <option value="locked">锁定</option>
                </select>
              </label>
              <label>
                冲突风险
                <input
                  max={100}
                  min={0}
                  type="number"
                  value={selected.conflictRisk}
                  onChange={(event) => onUpdateSetting(selected.id, { conflictRisk: Number(event.target.value) })}
                />
              </label>
              <label className="wide tall">
                核心规则
                <textarea value={selected.coreRule} onChange={(event) => onUpdateSetting(selected.id, { coreRule: event.target.value })} />
              </label>
              <label className="wide">
                使用限制
                <textarea value={selected.limits} onChange={(event) => onUpdateSetting(selected.id, { limits: event.target.value })} />
              </label>
              <label>
                影响角色
                <input
                  value={selected.impactCharacters}
                  onChange={(event) => onUpdateSetting(selected.id, { impactCharacters: event.target.value })}
                />
              </label>
              <label>
                关联章节
                <input value={selected.linkedChapters} onChange={(event) => onUpdateSetting(selected.id, { linkedChapters: event.target.value })} />
              </label>
              <label className="wide">
                备注
                <textarea value={selected.notes} onChange={(event) => onUpdateSetting(selected.id, { notes: event.target.value })} />
              </label>
              <label className="wide">
                标签
                <input value={selected.tags.join("、")} onChange={(event) => onUpdateSetting(selected.id, { tags: event.target.value.split(/[、,，]/) })} />
              </label>
            </div>

            <div className="setting-editor-actions">
              <button type="button" onClick={() => onStatus("设定 AI 润色接口已预留")}>
                AI 润色
              </button>
              <button type="button" onClick={() => onStatus("设定一致性检查接口已预留")}>
                一致性检查
              </button>
              <button className="primary" type="button" onClick={() => onStatus("设定档案已保存")}>
                保存设定
              </button>
            </div>
          </article>

          <aside className="setting-insight-panel">
            <div className="setting-panel-head">
              <span>一致性与 AI</span>
              <button type="button" onClick={() => onStatus("设定 AI 诊断接口已预留")}>
                诊断
              </button>
            </div>
            <div className="setting-focus-card">
              <strong>当前设定</strong>
              <p>{selected.notes || "设定会在这里作为正文生成、章节规划和提示词组合的可调用上下文。"}</p>
            </div>
            <div className="setting-risk-card">
              <span>冲突风险</span>
              <strong>{selected.conflictRisk}%</strong>
              <i style={{ width: `${selected.conflictRisk}%` }} />
            </div>
            <div className="setting-slot-list">
              <span>世界观引用槽</span>
              <span>主线影响槽</span>
              <span>角色影响槽</span>
              <span>正文禁用规则</span>
            </div>
          </aside>
        </div>
      )}

      {settings.activeView === "matrix" && (
        <div className="setting-layout matrix">
          <section className="setting-matrix-panel">
            <div className="setting-matrix-head">
              <span>规则矩阵</span>
              <button type="button" onClick={() => onStatus("矩阵筛选接口已预留")}>
                筛选
              </button>
            </div>
            <div className="setting-matrix-table">
              <div className="setting-matrix-row head">
                <span>设定</span>
                <span>范围</span>
                <span>风险</span>
                <span>章节</span>
                <span>AI</span>
              </div>
              {settings.entries.map((entry) => (
                <button
                  className={entry.id === selected.id ? "setting-matrix-row active" : "setting-matrix-row"}
                  key={entry.id}
                  onClick={() => onSelectSetting(entry.id)}
                  type="button"
                >
                  <span>
                    <i>{categoryMeta[entry.category].icon}</i>
                    {entry.name}
                  </span>
                  <span>{entry.scope}</span>
                  <span>{entry.conflictRisk}%</span>
                  <span>{entry.linkedChapters}</span>
                  <span>{entry.aiReady ? "可调用" : "待完善"}</span>
                </button>
              ))}
            </div>
          </section>

          <aside className="setting-matrix-side">
            <div className="setting-panel-head">
              <span>冲突检查</span>
              <button type="button" onClick={() => onStatus("冲突检查接口已预留")}>
                检查
              </button>
            </div>
            <div className="setting-focus-card">
              <strong>{selected.name}</strong>
              <p>{selected.limits || "这里会显示设定之间的矛盾、覆盖范围冲突和正文禁用项。"}</p>
            </div>
            <div className="setting-slot-list">
              <span>矛盾预警槽</span>
              <span>覆盖范围槽</span>
              <span>章节引用槽</span>
            </div>
          </aside>
        </div>
      )}

      {settings.activeView === "board" && (
        <div className="setting-layout board">
          {(["rule", "faction", "item", "system"] as const).map((category) => (
            <section className="setting-board-column" key={category}>
              <header>
                <h2>{categoryMeta[category].label}</h2>
                <strong>{grouped[category].length}</strong>
              </header>
              <div className="setting-card-stack">
                {grouped[category].map((entry) => (
                  <button
                    className={entry.id === selected.id ? "setting-board-card active" : "setting-board-card"}
                    key={entry.id}
                    onClick={() => onSelectSetting(entry.id)}
                    type="button"
                  >
                    <span>
                      <i>{categoryMeta[entry.category].icon}</i>
                      {entry.name}
                    </span>
                    <p>{entry.coreRule || "等待填写核心规则"}</p>
                    <small>
                      <SettingBadge status={entry.status} />
                      风险 {entry.conflictRisk}%
                    </small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
