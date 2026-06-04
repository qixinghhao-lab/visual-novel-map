import { useMemo, useState } from "react";
import { promptCategories } from "../domain/promptTemplates";
import type { PromptTemplate } from "../types/story";

type PromptWorkbenchProps = {
  prompts: PromptTemplate[];
  onUpdatePromptTemplate: (id: string, patch: Partial<PromptTemplate>) => void;
  onRestorePromptTemplate: (id: string) => void;
  onDuplicatePromptTemplate: (id: string) => string | undefined;
  onSavePromptTemplate: (id: string) => void;
  onStatus: (message: string) => void;
};

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value: string[]) {
  return value.join("\n");
}

function formatList(value: string[]) {
  return value.map((item, index) => `${index + 1}. ${item.replace(/^\d+\.\s*/, "")}`).join("\n");
}

function parseList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);
}

function getVariableKey(variable: string) {
  const keys: Record<string, string> = {
    世界观: "worldview",
    人物设定: "characters",
    前置节点: "previous_summary",
    后置节点: "current_node",
    阶段要求: "stage_goal",
    用户要求: "user_requirements",
  };

  return keys[variable] ?? variable.toLowerCase().replace(/\s+/g, "_");
}

function getPreviewVariableLabel(variable: string) {
  const labels: Record<string, string> = {
    世界观: "世界观",
    人物设定: "人物",
    前置节点: "前情概要",
    后置节点: "当前节点",
    阶段要求: "后续目标",
    用户要求: "用户要求",
  };

  return labels[variable] ?? variable;
}

function buildAssembledPrompt(template: PromptTemplate) {
  return [
    `【系统提示词】\n${template.systemPrompt}`,
    `【用户提示词】\n请基于以下信息生成「第{{chapter}}章，第{{section}}阶段」的正文内容。`,
    `【输入信息】\n${template.variables.map((item) => `${getPreviewVariableLabel(item)}：{{${getVariableKey(item)}}}`).join("\n")}`,
    `【生成规则】\n${template.rules.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `【禁止事项】\n${template.restrictions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `【输出格式】\n${template.outputFormat}`,
  ].join("\n\n");
}

function countText(value: string) {
  return value.trim().length;
}

const initialTestCharacter = "人物示例：填写主角、配角或势力的定位、目标和当前状态。";
const initialTestSummary = "前情示例：概括上一节点已经发生的动作、信息和未完成问题。";
const initialTestWorld = "世界观示例：填写本段正文必须遵守的规则、限制或环境条件。";

function createTestDraft(character: string, summary: string, world: string) {
  return [
    "这里会展示一次试运行结果。当前版本不会预设任何剧情，只用你填写的项目资料组合正文生成上下文。",
    `人物上下文：${character}`,
    `前情概要：${summary}`,
    `世界观约束：${world}`,
    "正式接入 AI 后，生成结果会替换成可直接编辑的正文或结构建议。你也可以把这段当成提示词效果的检查区域。",
  ].join("\n\n");
}

export function PromptWorkbench({
  prompts,
  onUpdatePromptTemplate,
  onRestorePromptTemplate,
  onDuplicatePromptTemplate,
  onSavePromptTemplate,
  onStatus,
}: PromptWorkbenchProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState(prompts[0]?.id ?? "");
  const [testCharacter, setTestCharacter] = useState(initialTestCharacter);
  const [testSummary, setTestSummary] = useState(initialTestSummary);
  const [testWorld, setTestWorld] = useState(initialTestWorld);
  const [moreVariablesOpen, setMoreVariablesOpen] = useState(false);
  const [testOutput, setTestOutput] = useState(() => createTestDraft(initialTestCharacter, initialTestSummary, initialTestWorld));
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId) ?? prompts[0];
  const category = promptCategories.find((item) => item.id === selectedPrompt?.categoryId);
  const assembledPrompt = useMemo(
    () => (selectedPrompt ? buildAssembledPrompt(selectedPrompt) : ""),
    [selectedPrompt],
  );

  if (!selectedPrompt) {
    return (
      <section className="prompt-workbench empty">
        <div className="prompt-empty-state">还没有提示词模板</div>
      </section>
    );
  }

  function updatePrompt(patch: Partial<PromptTemplate>) {
    onUpdatePromptTemplate(selectedPrompt.id, patch);
  }

  function runPrompt() {
    setTestOutput(createTestDraft(testCharacter, testSummary, testWorld));
    onStatus("提示词试运行接口已预留");
  }

  function resetTestRun() {
    setTestCharacter(initialTestCharacter);
    setTestSummary(initialTestSummary);
    setTestWorld(initialTestWorld);
    setTestOutput(createTestDraft(initialTestCharacter, initialTestSummary, initialTestWorld));
  }

  function duplicatePrompt() {
    const copyId = onDuplicatePromptTemplate(selectedPrompt.id);
    if (copyId) {
      setSelectedPromptId(copyId);
    }
  }

  return (
    <section className={`prompt-workbench${categoriesOpen ? " categories-open" : " categories-hidden"}`}>
      {categoriesOpen ? (
        <aside className="prompt-category-panel">
          <div className="prompt-category-head">
            <span>提示词分类</span>
            <button type="button" onClick={() => setCategoriesOpen(false)} aria-label="隐藏提示词分类">
              ‹
            </button>
          </div>
          <div className="prompt-category-list">
            {promptCategories.map((item) => {
              const categoryPrompts = prompts.filter((prompt) => prompt.categoryId === item.id);
              return (
                <div className="prompt-category-group" key={item.id}>
                  <button
                    className={item.id === selectedPrompt.categoryId ? "selected" : ""}
                    type="button"
                    onClick={() => {
                      const first = categoryPrompts[0];
                      if (first) {
                        setSelectedPromptId(first.id);
                      }
                    }}
                  >
                    <strong>{item.label}</strong>
                    <small>{categoryPrompts.length} 个模板</small>
                  </button>
                  {item.id === selectedPrompt.categoryId && (
                    <div className="prompt-template-list">
                      {categoryPrompts.map((prompt) => (
                        <button
                          className={prompt.id === selectedPrompt.id ? "active" : ""}
                          key={prompt.id}
                          onClick={() => setSelectedPromptId(prompt.id)}
                          type="button"
                        >
                          {prompt.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      ) : (
        <button className="prompt-category-tab" type="button" onClick={() => setCategoriesOpen(true)}>
          <span>提示词分类</span>
          <i aria-hidden="true">›</i>
        </button>
      )}

      <div className="prompt-editor-column">
        <div className="prompt-page-head">
          <div>
            <h1>{selectedPrompt.title}</h1>
          </div>
        </div>

        <div className="prompt-stack">
          <label className="prompt-edit-field role">
            <span>角色定位</span>
            <textarea value={selectedPrompt.role} onChange={(event) => updatePrompt({ role: event.target.value })} />
            <small>{countText(selectedPrompt.role)}/200</small>
          </label>
          <label className="prompt-edit-field variables">
            <span>
              输入变量
              <button
                type="button"
                onClick={() => updatePrompt({ variables: [...selectedPrompt.variables, "新变量"] })}
              >
                + 添加变量
              </button>
            </span>
            <div className="prompt-variable-row">
              {selectedPrompt.variables.map((variable) => (
                <i key={variable}>{variable}</i>
              ))}
            </div>
          </label>
          <label className="prompt-edit-field rules">
            <span>生成规则</span>
            <textarea value={formatList(selectedPrompt.rules)} onChange={(event) => updatePrompt({ rules: parseList(event.target.value) })} />
            <small>{countText(joinLines(selectedPrompt.rules))}/400</small>
          </label>
          <label className="prompt-edit-field restrictions">
            <span>禁止事项</span>
            <textarea
              value={formatList(selectedPrompt.restrictions)}
              onChange={(event) => updatePrompt({ restrictions: parseList(event.target.value) })}
            />
            <small>{countText(joinLines(selectedPrompt.restrictions))}/300</small>
          </label>
          <label className="prompt-edit-field output">
            <span>输出格式</span>
            <textarea
              className="compact"
              value={selectedPrompt.outputFormat}
              onChange={(event) => updatePrompt({ outputFormat: event.target.value })}
            />
            <small>{countText(selectedPrompt.outputFormat)}/200</small>
          </label>
        </div>

        <div className="prompt-editor-actions">
          <button type="button" onClick={() => onRestorePromptTemplate(selectedPrompt.id)}>
            重置为默认
          </button>
          <button type="button" onClick={duplicatePrompt}>
            保存为新版本
          </button>
          <button className="primary" type="button" onClick={() => onSavePromptTemplate(selectedPrompt.id)}>
            保存修改
          </button>
        </div>
      </div>

      {!categoriesOpen && (
        <div className="prompt-preview-column">
          <div className="prompt-preview-head">
            <h2>组合后的完整提示词</h2>
            <button type="button">变量（{selectedPrompt.variables.length}）</button>
          </div>
          <pre>{assembledPrompt}</pre>
          <div className="prompt-preview-meta">
            <span>Tokens 1024</span>
            <span>变量 {selectedPrompt.variables.length}</span>
            <button
              aria-label="复制组合后的完整提示词"
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(assembledPrompt);
                onStatus("已复制组合后的完整提示词");
              }}
            >
              ⧉
            </button>
          </div>
        </div>
      )}

      <div className="prompt-run-column">
        <div className="prompt-run-head">
          <h2>试运行</h2>
          <button type="button" onClick={resetTestRun}>
            ↻ 重置
          </button>
        </div>

        <div className="prompt-test-card">
          <strong>输入变量</strong>
          <label>
            人物
            <input value={testCharacter} onChange={(event) => setTestCharacter(event.target.value)} />
            <small>{countText(testCharacter)}/200</small>
          </label>
          <label>
            前情概要
            <input value={testSummary} onChange={(event) => setTestSummary(event.target.value)} />
            <small>{countText(testSummary)}/200</small>
          </label>
          <label>
            世界观约束
            <input value={testWorld} onChange={(event) => setTestWorld(event.target.value)} />
            <small>{countText(testWorld)}/200</small>
          </label>
          <button className="prompt-more-variables" type="button" onClick={() => setMoreVariablesOpen((value) => !value)}>
            {moreVariablesOpen ? "⌃ 收起更多变量" : "⌄ 展开更多变量（共3个）"}
          </button>
          {moreVariablesOpen && (
            <div className="prompt-extra-variables">
              <input aria-label="当前节点" defaultValue="当前节点：填写当前剧情必须达到的动作、信息或情绪变化。" />
              <input aria-label="后续目标" defaultValue="后续目标：填写下一段需要自然抵达的位置或结果。" />
              <input aria-label="用户要求" defaultValue="用户要求：填写本次生成的风格、节奏或禁用项。" />
            </div>
          )}
        </div>

        <div className="prompt-result-wrap">
          <div className="prompt-result-title">
            <span>生成结果（评估）</span>
            <button type="button" onClick={runPrompt}>
              ↻ 重新生成
            </button>
          </div>
          <article className="prompt-result-card">
            <strong>当前版本 {selectedPrompt.version}（测试）</strong>
            <p>{testOutput}</p>
            <div className="prompt-result-actions">
              <span>
                评分：<b>82</b>
              </span>
              <em>版本对比</em>
              <button aria-label="结果有帮助" type="button">
                ♡
              </button>
              <button aria-label="结果无帮助" type="button">
                ♢
              </button>
            </div>
          </article>
        </div>

        <div className="prompt-run-footer">
          <select value={selectedPrompt.model} onChange={(event) => updatePrompt({ model: event.target.value })}>
            <option>GPT-4o</option>
            <option>GPT-5</option>
            <option>自定义模型</option>
          </select>
          <button type="button" onClick={() => onStatus("参数设置接口已预留")}>
            参数设置
          </button>
          <button className="primary" type="button" onClick={runPrompt}>
            ▷ 运行
          </button>
        </div>
      </div>
    </section>
  );
}
