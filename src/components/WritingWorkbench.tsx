import { useEffect, useMemo, useState } from "react";
import { createSegmentContent } from "../domain/storyDefaults";
import {
  buildWritingSections,
  countChars,
  createPolishDraft,
  createRewriteDraft,
  getLogicMarkerForParagraph,
  replaceParagraph,
  splitParagraphs,
  type WritingSegmentContext,
} from "../domain/writing";
import type { SegmentContent, StoryState } from "../types/story";

type WritingWorkbenchProps = {
  story: StoryState;
  onUpdateWritingSegmentContent: (key: string, patch: Partial<SegmentContent>) => void;
  onGenerateWritingSegmentContent: (key: string, context: WritingSegmentContext, useRequirement: boolean) => void;
  onConfirmWritingSegmentContent: (key: string) => void;
  onStatus: (message: string) => void;
};

export function WritingWorkbench({
  story,
  onUpdateWritingSegmentContent,
  onGenerateWritingSegmentContent,
  onConfirmWritingSegmentContent,
  onStatus,
}: WritingWorkbenchProps) {
  const sections = useMemo(() => buildWritingSections(story), [story]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState(0);
  const [aiDraft, setAiDraft] = useState("");

  const selectedSection = sections.find((section) => section.key === selectedKey) ?? sections[0];
  const selectedContent = selectedSection ? story.segmentContents[selectedSection.key] ?? createSegmentContent() : createSegmentContent();
  const manuscriptText = selectedContent.generated || selectedSection?.fallbackText || "";
  const paragraphs = splitParagraphs(manuscriptText);
  const selectedParagraph = paragraphs[selectedParagraphIndex] ?? paragraphs[0] ?? "";
  const totalWords = sections.reduce((total, section) => total + countChars(story.segmentContents[section.key]?.generated || section.fallbackText), 0);
  const confirmedCount = sections.filter((section) => (story.segmentContents[section.key]?.confirmed.length ?? 0) > 0).length;

  useEffect(() => {
    if (!selectedKey && sections[0]) {
      setSelectedKey(sections[0].key);
    }
  }, [sections, selectedKey]);

  useEffect(() => {
    setSelectedParagraphIndex(0);
    setAiDraft("");
  }, [selectedKey]);

  if (!selectedSection) {
    return (
      <section className="writing-workbench empty">
        <div className="writing-empty">
          <span>✎</span>
          <strong>还没有可写章节</strong>
          <p>先在故事线或大纲里创建章节，写作页会自动生成章节正文队列。</p>
        </div>
      </section>
    );
  }

  function updateManuscript(nextText: string) {
    onUpdateWritingSegmentContent(selectedSection.key, { generated: nextText });
  }

  function updateParagraph(index: number, nextParagraph: string) {
    updateManuscript(replaceParagraph(manuscriptText, index, nextParagraph));
  }

  function runPolishFor(paragraph: string) {
    setAiDraft(createPolishDraft(paragraph));
    onStatus("已生成选中段落的润色预览");
  }

  function runRewrite() {
    setAiDraft(createRewriteDraft(selectedParagraph, selectedContent.requirement, selectedSection));
    onStatus("已按修改要求生成段落改写预览");
  }

  function applyDraft() {
    if (!aiDraft.trim()) {
      onStatus("请先生成润色或改写结果");
      return;
    }

    updateParagraph(selectedParagraphIndex, aiDraft.trim());
    setAiDraft("");
    onStatus("已替换选中段落");
  }

  function generateWholeSection(useRequirement: boolean) {
    onGenerateWritingSegmentContent(
      selectedSection.key,
      {
        title: selectedSection.title,
        fromLabel: selectedSection.fromLabel,
        toLabel: selectedSection.toLabel,
        logicMarkers: selectedSection.logicMarkers,
        requirement: selectedContent.requirement,
      },
      useRequirement,
    );
  }

  return (
    <section className="writing-workbench">
      <header className="writing-header">
        <div className="writing-header-copy">
          <span className="writing-eyebrow">写作工作台</span>
          <h1>章节正文编辑</h1>
          <p>按章节点区间组织正文，章节内部标记逻辑点，选中任意段落即可让 AI 润色或按要求改写。</p>
        </div>
        <div className="writing-header-side">
          <div className="writing-stats">
            <span>
              <strong>{sections.length}</strong>
              章节
            </span>
            <span>
              <strong>{confirmedCount}</strong>
              已确认
            </span>
            <span>
              <strong>{totalWords}</strong>
              字
            </span>
          </div>
          <div className="writing-quick-actions">
            <button type="button" onClick={() => generateWholeSection(false)}>
              生成本章
            </button>
            <button type="button" onClick={() => onConfirmWritingSegmentContent(selectedSection.key)}>
              保存章节
            </button>
          </div>
        </div>
      </header>

      <div className="writing-layout">
        <aside className="writing-chapter-panel">
          <div className="writing-panel-head">
            <span>章节区间</span>
            <button type="button" onClick={() => onStatus("新增章节请先从故事线或大纲添加")}>
              + 章节
            </button>
          </div>
          <div className="writing-chapter-list">
            {sections.map((section) => (
              <button
                className={section.key === selectedSection.key ? "active" : ""}
                key={section.key}
                onClick={() => setSelectedKey(section.key)}
                type="button"
              >
                <i>{section.index + 1}</i>
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.subtitle}</small>
                </span>
                <em>{countChars(story.segmentContents[section.key]?.generated || section.fallbackText)}</em>
              </button>
            ))}
          </div>
        </aside>

        <article className="writing-editor-panel">
          <div className="writing-editor-head">
            <div>
              <span>{selectedSection.statusLabel}</span>
              <h2>{selectedSection.title}</h2>
              <p>
                {selectedSection.fromLabel} → {selectedSection.toLabel}
              </p>
            </div>
            <div className="writing-progress">
              <strong>{countChars(manuscriptText)}</strong>
              <span>/ {selectedSection.wordTarget} 字</span>
            </div>
          </div>

          <div className="writing-logic-strip">
            <span>逻辑点</span>
            {selectedSection.logicMarkers.length > 0 ? (
              selectedSection.logicMarkers.map((marker, index) => (
                <button key={`${marker}-${index}`} type="button" onClick={() => setSelectedParagraphIndex(Math.min(index + 1, paragraphs.length - 1))}>
                  {index + 1}. {marker}
                </button>
              ))
            ) : (
              <button type="button" onClick={() => onStatus("当前章节还没有逻辑点")}>
                待添加逻辑点
              </button>
            )}
          </div>

          <div className="writing-manuscript">
            {paragraphs.map((paragraph, index) => {
              const marker = getLogicMarkerForParagraph(selectedSection, index);
              return (
                <section className={index === selectedParagraphIndex ? "writing-paragraph active" : "writing-paragraph"} key={`${selectedSection.key}-${index}`}>
                  {marker && (
                    <button className="writing-logic-anchor" type="button" onClick={() => setSelectedParagraphIndex(index)}>
                      {marker}
                    </button>
                  )}
                  <textarea
                    value={paragraph}
                    onChange={(event) => updateParagraph(index, event.target.value)}
                    onFocus={() => setSelectedParagraphIndex(index)}
                  />
                  <button
                    className="writing-paragraph-ai"
                    type="button"
                    onClick={() => {
                      setSelectedParagraphIndex(index);
                      runPolishFor(paragraph);
                    }}
                  >
                    AI 润色
                  </button>
                </section>
              );
            })}
          </div>
        </article>

        <aside className="writing-ai-panel">
          <div className="writing-panel-head">
            <span>AI 改写</span>
            <button type="button" onClick={() => generateWholeSection(true)}>
              重写本章
            </button>
          </div>

          <div className="writing-ai-scroll">
            <label className="writing-ai-field">
              <span>当前选中段落</span>
              <textarea readOnly value={selectedParagraph} />
            </label>
            <label className="writing-ai-field">
              <span>修改要求</span>
              <textarea
                placeholder="例如：更克制一点，减少解释，增加动作细节。"
                value={selectedContent.requirement}
                onChange={(event) => onUpdateWritingSegmentContent(selectedSection.key, { requirement: event.target.value })}
              />
            </label>
            <div className="writing-ai-buttons">
              <button type="button" onClick={() => runPolishFor(selectedParagraph)}>
                AI 润色
              </button>
              <button type="button" onClick={runRewrite}>
                按要求改写
              </button>
            </div>
            <label className="writing-ai-field result">
              <span>生成结果</span>
              <textarea
                placeholder="润色或改写结果会出现在这里，可以手动修改后确认替换。"
                value={aiDraft}
                onChange={(event) => setAiDraft(event.target.value)}
              />
            </label>
          </div>

          <div className="writing-ai-actions">
            <button type="button" onClick={() => setAiDraft("")}>
              清空
            </button>
            <button className="primary" type="button" onClick={applyDraft}>
              确认替换
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
