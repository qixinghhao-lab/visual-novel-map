import { useMemo, type CSSProperties } from "react";
import type { CharacterState, CharacterView, StoryCharacter } from "../types/story";

type CharacterPatch = Partial<
  Pick<
    StoryCharacter,
    | "name"
    | "group"
    | "roleLabel"
    | "archetype"
    | "appearance"
    | "outerGoal"
    | "innerDesire"
    | "weakness"
    | "secret"
    | "relationshipSummary"
    | "arcStage"
    | "tags"
  >
>;

type CharacterWorkbenchProps = {
  characters: CharacterState;
  onSetView: (view: CharacterView) => void;
  onSelectCharacter: (id: string) => void;
  onUpdateCharacter: (id: string, patch: CharacterPatch) => void;
  onAddCharacter: () => string | undefined;
  onStatus: (message: string) => void;
};

const characterModes: Array<{
  id: CharacterView;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: "profile",
    label: "档案",
    title: "角色档案",
    description: "先把角色定位、目标、欲望、弱点、秘密和关系摘要整理清楚。",
  },
  {
    id: "network",
    label: "关系",
    title: "人物关系网",
    description: "查看人物之间的信任、冲突、隐瞒和利益连接。",
  },
  {
    id: "arc",
    label: "弧线",
    title: "角色弧线",
    description: "按关键阶段追踪角色变化，为章节和正文生成预留上下文。",
  },
];

const groupMeta: Record<StoryCharacter["group"], { label: string; className: string }> = {
  lead: { label: "主角", className: "lead" },
  support: { label: "配角", className: "support" },
  force: { label: "势力", className: "force" },
};

const relationMeta = {
  trust: { label: "信任", className: "trust" },
  conflict: { label: "冲突", className: "conflict" },
  secret: { label: "隐瞒", className: "secret" },
  interest: { label: "利益", className: "interest" },
};

function groupCharacters(roster: StoryCharacter[]) {
  return {
    lead: roster.filter((character) => character.group === "lead"),
    support: roster.filter((character) => character.group === "support"),
    force: roster.filter((character) => character.group === "force"),
  };
}

function initials(name: string) {
  return name.trim().slice(0, 1) || "?";
}

function countFilled(character: StoryCharacter) {
  const fields = [
    character.name,
    character.roleLabel,
    character.archetype,
    character.appearance,
    character.outerGoal,
    character.innerDesire,
    character.weakness,
    character.secret,
    character.relationshipSummary,
    character.arcStage,
  ];
  return Math.round((fields.filter((field) => field.trim()).length / fields.length) * 100);
}

function getRelationName(characters: CharacterState, id: string) {
  return characters.roster.find((character) => character.id === id)?.name ?? "未知角色";
}

export function CharacterWorkbench({
  characters,
  onSetView,
  onSelectCharacter,
  onUpdateCharacter,
  onAddCharacter,
  onStatus,
}: CharacterWorkbenchProps) {
  const grouped = useMemo(() => groupCharacters(characters.roster), [characters.roster]);
  const selected = characters.roster.find((character) => character.id === characters.selectedCharacterId) ?? characters.roster[0];
  const currentMode = characterModes.find((mode) => mode.id === characters.activeView) ?? characterModes[0];
  const selectedRelations = characters.relations.filter(
    (relation) => relation.fromId === selected?.id || relation.toId === selected?.id,
  );
  const completion = selected ? countFilled(selected) : 0;

  function addCharacter() {
    const id = onAddCharacter();
    if (id) {
      onSelectCharacter(id);
    }
  }

  if (!selected) {
    return (
      <section className="character-workbench empty">
        <div className="character-empty">
          <span>♙</span>
          <strong>还没有角色</strong>
          <p>先创建角色档案，再逐步接入人物关系、弧线和 AI 分析。</p>
          <button type="button" onClick={addCharacter}>
            新增角色
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`character-workbench view-${characters.activeView}`}>
      <header className="character-header">
        <div className="character-header-copy">
          <span className="character-eyebrow">角色工作台</span>
          <h1>{currentMode.title}</h1>
          <p>{currentMode.description}</p>
        </div>

        <div className="character-header-side">
          <div className="character-mode-tabs" role="tablist" aria-label="角色视图">
            {characterModes.map((mode) => (
              <button
                aria-selected={characters.activeView === mode.id}
                className={characters.activeView === mode.id ? "active" : ""}
                key={mode.id}
                onClick={() => onSetView(mode.id)}
                role="tab"
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="character-stats">
            <span>
              <strong>{characters.roster.length}</strong>
              角色
            </span>
            <span>
              <strong>{characters.relations.length}</strong>
              关系
            </span>
            <span>
              <strong>{completion}%</strong>
              完成度
            </span>
          </div>
        </div>
      </header>

      {characters.activeView === "profile" && (
        <div className="character-layout profile">
          <aside className="character-list-panel">
            <div className="character-panel-head">
              <span>角色列表</span>
              <button type="button" onClick={addCharacter}>
                + 角色
              </button>
            </div>
            <div className="character-roster">
              {(["lead", "support", "force"] as const).map((group) => (
                <section className="character-group" key={group}>
                  <div className="character-group-title">
                    <strong>{groupMeta[group].label}</strong>
                    <small>{grouped[group].length}</small>
                  </div>
                  {grouped[group].map((character) => (
                    <button
                      className={character.id === selected.id ? "active" : ""}
                      key={character.id}
                      onClick={() => onSelectCharacter(character.id)}
                      type="button"
                    >
                      <i>{initials(character.name)}</i>
                      <span>
                        <strong>{character.name}</strong>
                        <small>{character.roleLabel} · {character.appearance}</small>
                      </span>
                      <em>{countFilled(character)}%</em>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </aside>

          <article className="character-profile-panel">
            <div className="character-profile-head">
              <div className="character-avatar" aria-hidden="true">
                {initials(selected.name)}
              </div>
              <div>
                <span>{groupMeta[selected.group].label}</span>
                <h2>{selected.name}</h2>
                <p>{selected.archetype}</p>
              </div>
              <select
                value={selected.group}
                onChange={(event) => onUpdateCharacter(selected.id, { group: event.target.value as StoryCharacter["group"] })}
              >
                <option value="lead">主角</option>
                <option value="support">配角</option>
                <option value="force">势力</option>
              </select>
            </div>

            <div className="character-form-grid">
              <label>
                角色名称
                <input value={selected.name} onChange={(event) => onUpdateCharacter(selected.id, { name: event.target.value })} />
              </label>
              <label>
                角色定位
                <input value={selected.roleLabel} onChange={(event) => onUpdateCharacter(selected.id, { roleLabel: event.target.value })} />
              </label>
              <label>
                人物原型
                <input value={selected.archetype} onChange={(event) => onUpdateCharacter(selected.id, { archetype: event.target.value })} />
              </label>
              <label>
                出场章节
                <input value={selected.appearance} onChange={(event) => onUpdateCharacter(selected.id, { appearance: event.target.value })} />
              </label>
              <label className="wide">
                外在目标
                <textarea value={selected.outerGoal} onChange={(event) => onUpdateCharacter(selected.id, { outerGoal: event.target.value })} />
              </label>
              <label className="wide">
                内在欲望
                <textarea value={selected.innerDesire} onChange={(event) => onUpdateCharacter(selected.id, { innerDesire: event.target.value })} />
              </label>
              <label className="wide split">
                弱点
                <textarea value={selected.weakness} onChange={(event) => onUpdateCharacter(selected.id, { weakness: event.target.value })} />
              </label>
              <label className="wide split">
                秘密
                <textarea value={selected.secret} onChange={(event) => onUpdateCharacter(selected.id, { secret: event.target.value })} />
              </label>
              <label className="wide">
                关系摘要
                <textarea
                  value={selected.relationshipSummary}
                  onChange={(event) => onUpdateCharacter(selected.id, { relationshipSummary: event.target.value })}
                />
              </label>
              <label className="wide">
                标签
                <input value={selected.tags.join("、")} onChange={(event) => onUpdateCharacter(selected.id, { tags: event.target.value.split(/[、,，]/) })} />
              </label>
            </div>

            <div className="character-editor-actions">
              <button type="button" onClick={() => onStatus("角色 AI 润色接口已预留")}>
                AI 润色
              </button>
              <button type="button" onClick={() => onStatus("同步到故事线的角色接口已预留")}>
                同步故事线
              </button>
              <button className="primary" type="button" onClick={() => onStatus("角色档案已保存")}>
                保存角色
              </button>
            </div>
          </article>

          <aside className="character-insight-panel">
            <div className="character-panel-head">
              <span>关联与 AI</span>
              <button type="button" onClick={() => onStatus("角色 AI 诊断接口已预留")}>
                诊断
              </button>
            </div>
            <div className="character-focus-card">
              <strong>当前角色</strong>
              <p>{selected.arcStage || "角色阶段变化会在这里作为正文生成和章节规划的上下文。"}</p>
            </div>
            <div className="character-relation-mini">
              {selectedRelations.length > 0 ? (
                selectedRelations.map((relation) => {
                  const meta = relationMeta[relation.type];
                  const otherId = relation.fromId === selected.id ? relation.toId : relation.fromId;
                  return (
                    <button key={relation.id} type="button" onClick={() => onSelectCharacter(otherId)}>
                      <span className={meta.className}>{meta.label}</span>
                      <strong>{getRelationName(characters, otherId)}</strong>
                      <small>{relation.strength}%</small>
                    </button>
                  );
                })
              ) : (
                <p>还没有和当前角色相关的关系。</p>
              )}
            </div>
            <div className="character-slot-list">
              <span>世界观关联槽</span>
              <span>主线关联槽</span>
              <span>伏笔关联槽</span>
              <span>正文语气槽</span>
            </div>
          </aside>
        </div>
      )}

      {characters.activeView === "network" && (
        <div className="character-layout network">
          <section className="character-network-stage">
            <div className="character-network-map">
              {characters.roster.map((character, index) => (
                <button
                  className={`${character.id === selected.id ? "active" : ""} ${groupMeta[character.group].className}`}
                  key={character.id}
                  onClick={() => onSelectCharacter(character.id)}
                  style={{ "--node-index": index } as CSSProperties}
                  type="button"
                >
                  <i>{initials(character.name)}</i>
                  <strong>{character.name}</strong>
                  <small>{character.roleLabel}</small>
                </button>
              ))}
            </div>
            <div className="character-network-legend">
              {Object.values(relationMeta).map((meta) => (
                <span className={meta.className} key={meta.className}>
                  {meta.label}
                </span>
              ))}
            </div>
          </section>

          <aside className="character-network-side">
            <div className="character-panel-head">
              <span>关系卡</span>
              <button type="button" onClick={() => onStatus("新增人物关系接口已预留")}>
                + 关系
              </button>
            </div>
            <div className="character-relation-stack">
              {characters.relations.map((relation) => {
                const meta = relationMeta[relation.type];
                return (
                  <article key={relation.id}>
                    <span className={meta.className}>{meta.label}</span>
                    <h3>
                      {getRelationName(characters, relation.fromId)} / {getRelationName(characters, relation.toId)}
                    </h3>
                    <p>{relation.note}</p>
                    <div>
                      <i style={{ width: `${relation.strength}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {characters.activeView === "arc" && (
        <div className="character-layout arc">
          <aside className="character-arc-list">
            <div className="character-panel-head">
              <span>角色弧线</span>
              <button type="button" onClick={() => onStatus("角色弧线生成接口已预留")}>
                生成
              </button>
            </div>
            {characters.roster.map((character) => (
              <button
                className={character.id === selected.id ? "active" : ""}
                key={character.id}
                onClick={() => onSelectCharacter(character.id)}
                type="button"
              >
                <i>{initials(character.name)}</i>
                <span>
                  <strong>{character.name}</strong>
                  <small>{character.arcStage}</small>
                </span>
              </button>
            ))}
          </aside>

          <section className="character-arc-panel">
            <div className="character-arc-line">
              {["登场", "试探", "转折", "代价", "选择"].map((stage, index) => (
                <div className={index === 2 ? "active" : ""} key={stage}>
                  <i>{index + 1}</i>
                  <strong>{stage}</strong>
                  <p>{index === 2 ? selected.arcStage : "待填充阶段目标"}</p>
                </div>
              ))}
            </div>
            <label>
              当前弧线说明
              <textarea value={selected.arcStage} onChange={(event) => onUpdateCharacter(selected.id, { arcStage: event.target.value })} />
            </label>
          </section>

          <aside className="character-arc-insight">
            <div className="character-panel-head">
              <span>AI 建议</span>
              <button type="button" onClick={() => onStatus("角色弧线 AI 建议接口已预留")}>
                分析
              </button>
            </div>
            <div className="character-focus-card">
              <strong>弧线缺口</strong>
              <p>后续可根据章节节点、关系变化和正文内容自动判断角色成长是否断裂。</p>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
