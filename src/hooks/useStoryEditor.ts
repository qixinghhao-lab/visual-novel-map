import { useEffect, useMemo, useRef, useState } from "react";
import {
  branchMeta,
  createChapterNodeContent,
  createLogicPointContent,
  createSegmentContent,
  emptyStory,
} from "../domain/storyDefaults";
import { clamp, createId } from "../domain/timeline";
import { createWritingDraft, type WritingSegmentContext } from "../domain/writing";
import type {
  Branch,
  BranchType,
  CharacterView,
  ChapterNodeContent,
  Chapter,
  LogicPointContent,
  LogicPoint,
  OutlineChapter,
  OutlineView,
  PromptTemplate,
  SegmentContent,
  SettingView,
  StoryState,
  StoryCharacter,
  StorySetting,
  TextNote,
  TimelineSegmentSelection,
  Tool,
  WorldEntry,
  WorldLayer,
} from "../types/story";

const HISTORY_LIMIT = 60;
export const MIN_ZOOM_X = 0.55;
export const MAX_ZOOM_X = 240;
const ZOOM_ANIMATION_MS = 420;
const TIMELINE_WIDTH_RATIO = 0.88;
const TIMELINE_MIN_WIDTH = 760;
type BranchPatch = Partial<Pick<Branch, "name" | "type" | "color" | "startChapter" | "endChapter" | "note">>;
type PromptPatch = Partial<
  Pick<
    PromptTemplate,
    | "title"
    | "badge"
    | "version"
    | "model"
    | "binding"
    | "description"
    | "role"
    | "variables"
    | "rules"
    | "restrictions"
    | "outputFormat"
    | "systemPrompt"
    | "userPrompt"
  >
>;
type OutlineChapterPatch = Partial<
  Pick<OutlineChapter, "title" | "purpose" | "summary" | "conflict" | "wordTarget" | "status">
>;
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
type WorldEntryPatch = Partial<
  Pick<
    WorldEntry,
    | "name"
    | "kind"
    | "layer"
    | "latitude"
    | "longitude"
    | "summary"
    | "detail"
    | "influence"
    | "linkedChapters"
    | "linkedCharacters"
    | "risk"
    | "tags"
  >
>;

function getLogicPointContent(logic: LogicPoint): LogicPointContent {
  return logic.nodeContent ?? createLogicPointContent();
}

function getChapterNodeContent(chapter: Chapter): ChapterNodeContent {
  return chapter.nodeContent ?? createChapterNodeContent();
}

function getSegmentKey(selection: TimelineSegmentSelection) {
  return `${selection.fromId}->${selection.toId}`;
}

function getSegmentContent(story: StoryState, selection: TimelineSegmentSelection): SegmentContent {
  return story.segmentContents[getSegmentKey(selection)] ?? createSegmentContent();
}

function polishDraft(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function easeOutQuart(value: number) {
  return 1 - (1 - value) ** 4;
}

function formatZoomLabel(zoom: number) {
  if (zoom < 10) {
    return `${Math.round(zoom * 100)}%`;
  }

  if (zoom < 100) {
    return `${zoom.toFixed(1)}x`;
  }

  return `${Math.round(zoom)}x`;
}

function cleanBranchPatch(branch: Branch, totalChapters: number): Branch {
  const maxChapter = Math.max(totalChapters, 1);
  const startChapter = clamp(Math.round(branch.startChapter) || 1, 1, maxChapter);
  const endChapter = clamp(Math.round(branch.endChapter) || startChapter, startChapter, maxChapter);

  return {
    ...branch,
    name: branch.name.trim() || "未命名支线",
    startChapter,
    endChapter,
    note: branch.note.slice(0, 200),
  };
}

function getBridgeNodeSummary(story: StoryState, id: string) {
  if (id === "start") {
    return "故事开端";
  }

  if (id === "end") {
    return story.ending.trim() || "故事最终落点";
  }

  const chapterIndex = story.chapters.findIndex((chapter) => chapter.id === id);
  if (chapterIndex >= 0) {
    const chapter = story.chapters[chapterIndex];
    const content = getChapterNodeContent(chapter);
    const details = [content.previousEnding, content.nextOpening].map((item) => item.trim()).filter(Boolean);
    return details.length > 0 ? details.join(" / ") : `第 ${chapterIndex + 1} 章：${chapter.name}`;
  }

  const logic = story.logicPoints.find((item) => item.id === id);
  if (logic) {
    const content = getLogicPointContent(logic);
    return content.plot.trim() || logic.title;
  }

  return "未命名节点";
}

function createSegmentDraft(story: StoryState, selection: TimelineSegmentSelection, requirement: string) {
  const from = getBridgeNodeSummary(story, selection.fromId);
  const to = getBridgeNodeSummary(story, selection.toId);
  const instruction = requirement.trim()
    ? `同时满足你的生成要求：${requirement.trim()}。`
    : "保持节奏自然，减少突兀跳转。";

  return `承接「${from}」，这一段正文需要先稳定前一节点造成的情绪和信息，再用连续行动、对话或发现推进因果，逐步过渡到「${to}」。${instruction}这里会作为 AI 生成接口的入参预览，后续接入世界观、人设和正文上下文后替换为真实生成结果。`;
}

function hasLegacyStarterStory(story: StoryState) {
  const legacyPlace = "\u65e7\u57ce";
  const legacyLead = "\u767d\u8f9e";
  const legacyBranch = `${legacyPlace}\u8c03\u67e5\u7ebf`;

  return (
    story.outline.volumes.some((volume) => volume.id === "outline-volume-1" && volume.title.includes(legacyPlace)) ||
    story.characters.roster.some((character) => character.id === "character-1" && character.name === legacyLead) ||
    story.settings.entries.some((setting) => setting.id === "setting-1" && setting.name.includes(legacyPlace)) ||
    story.world.entries.some((entry) => entry.id === "world-1" && entry.name.includes(legacyPlace)) ||
    story.branches.some((branch) => branch.name.includes(legacyBranch))
  );
}

function getTimelineGrowth(story: StoryState) {
  const splitPointCount = story.chapters.length + story.logicPoints.length;
  let growth = 1;

  for (let segmentCount = 2; segmentCount <= splitPointCount + 1; segmentCount += 1) {
    growth += 1 / (segmentCount * 2);
  }

  return growth;
}

function getTimelineWidth(viewportWidth: number, zoom: number, growth: number) {
  return Math.max(viewportWidth * TIMELINE_WIDTH_RATIO * zoom * growth, TIMELINE_MIN_WIDTH);
}

function nextPromptVersion(version: string) {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return "v1.0.0";
  }

  const [, major, minor, patch] = match;
  return `v${major}.${minor}.${Number(patch) + 1}`;
}

function insertLogicPoint(
  logicPoints: LogicPoint[],
  logic: LogicPoint,
  selection: TimelineSegmentSelection | null,
) {
  if (!selection || selection.chapterSegmentIndex !== logic.segmentIndex) {
    return [...logicPoints, logic];
  }

  const toIndex = logicPoints.findIndex((item) => item.id === selection.toId);
  if (toIndex >= 0) {
    return [...logicPoints.slice(0, toIndex), logic, ...logicPoints.slice(toIndex)];
  }

  const fromIndex = logicPoints.findIndex((item) => item.id === selection.fromId);
  if (fromIndex >= 0) {
    return [...logicPoints.slice(0, fromIndex + 1), logic, ...logicPoints.slice(fromIndex + 1)];
  }

  return [...logicPoints, logic];
}

export function useStoryEditor() {
  const [story, setStory] = useState<StoryState>(emptyStory);
  const [history, setHistory] = useState<StoryState[]>([]);
  const [future, setFuture] = useState<StoryState[]>([]);
  const [tool, setTool] = useState<Tool>("pan");
  const [zoomX, setZoomX] = useState(1);
  const [panX, setPanXState] = useState(0);
  const [selectedId, setSelectedId] = useState("start");
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [selectedPathSegment, setSelectedPathSegment] = useState<TimelineSegmentSelection | null>(null);
  const [status, setStatus] = useState("尚未添加内容");
  const zoomTargetRef = useRef(1);
  const panTargetRef = useRef(0);
  const zoomAnimationRef = useRef<number | null>(null);

  const zoomLabel = formatZoomLabel(zoomX);
  const timelineGrowth = useMemo(() => getTimelineGrowth(story), [story]);
  const windowLabel =
    story.chapters.length === 0
      ? "章节 0 / 0"
      : `章节 1-${story.chapters.length} / ${story.chapters.length}`;

  const timelineStyle = useMemo(
    () => ({
      width: `${88 * timelineGrowth * zoomX}%`,
      transform: `translate(calc(-50% + ${panX}px), -50%)`,
    }),
    [panX, timelineGrowth, zoomX],
  );

  function commit(updater: (previous: StoryState) => StoryState, message?: string) {
    setStory((previous) => {
      setHistory((items) => [...items, previous].slice(-HISTORY_LIMIT));
      setFuture([]);
      return updater(previous);
    });

    if (message) {
      setStatus(message);
    }
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) {
      setStatus("没有可撤销的操作");
      return;
    }

    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [story, ...items].slice(0, HISTORY_LIMIT));
    setStory(previous);
    setSelectedPathSegment(null);
    setStatus("已撤销");
  }

  function redo() {
    const next = future[0];
    if (!next) {
      setStatus("没有可重做的操作");
      return;
    }

    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, story].slice(-HISTORY_LIMIT));
    setStory(next);
    setSelectedPathSegment(null);
    setStatus("已重做");
  }

  useEffect(() => {
    return () => {
      if (zoomAnimationRef.current !== null) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setStory((previous) => (hasLegacyStarterStory(previous) ? emptyStory : previous));
  }, []);

  function setPanX(nextPanX: number) {
    panTargetRef.current = nextPanX;
    setPanXState(nextPanX);
  }

  function setZoom(nextZoom: number, options?: { immediate?: boolean }) {
    const targetZoom = clamp(nextZoom, MIN_ZOOM_X, MAX_ZOOM_X);
    zoomTargetRef.current = targetZoom;

    if (zoomAnimationRef.current !== null) {
      cancelAnimationFrame(zoomAnimationRef.current);
      zoomAnimationRef.current = null;
    }

    if (options?.immediate) {
      setZoomX(targetZoom);
      return;
    }

    const startZoom = zoomX;
    const startTime = performance.now();

    function tick(now: number) {
      const progress = clamp((now - startTime) / ZOOM_ANIMATION_MS, 0, 1);
      const eased = easeOutQuart(progress);
      setZoomX(startZoom + (targetZoom - startZoom) * eased);

      if (progress < 1) {
        zoomAnimationRef.current = requestAnimationFrame(tick);
        return;
      }

      setZoomX(targetZoom);
      zoomAnimationRef.current = null;
    }

    zoomAnimationRef.current = requestAnimationFrame(tick);
  }

  function zoomBy(ratio: number) {
    setZoom(zoomTargetRef.current * ratio);
  }

  function zoomByAt(ratio: number, anchorX: number, viewportWidth: number) {
    const currentZoom = zoomTargetRef.current;
    const targetZoom = clamp(currentZoom * ratio, MIN_ZOOM_X, MAX_ZOOM_X);
    const currentWidth = getTimelineWidth(viewportWidth, currentZoom, timelineGrowth);
    const targetWidth = getTimelineWidth(viewportWidth, targetZoom, timelineGrowth);
    const widthRatio = targetWidth / currentWidth;
    const currentPan = panTargetRef.current;

    setPanX(anchorX - (anchorX - currentPan) * widthRatio);
    setZoom(targetZoom, { immediate: true });
  }

  function resetView() {
    setZoom(1);
    setPanX(0);
    setStatus("视图已恢复");
  }

  function addChapter() {
    const nextIndex = story.chapters.length + 1;
    const chapter: Chapter = {
      id: createId("chapter"),
      name: nextIndex === 1 ? "第一章" : `第${nextIndex}章`,
      emotion: 0,
      nodeContent: createChapterNodeContent(),
    };

    commit((previous) => ({ ...previous, chapters: [...previous.chapters, chapter] }), `已添加第 ${nextIndex} 章`);
    setSelectedId(chapter.id);
    setSelectedSegmentIndex(null);
    setSelectedPathSegment(null);
    return chapter.id;
  }

  function addLogicPoint() {
    if (story.chapters.length === 0) {
      setStatus("请先添加章节节点");
      return undefined;
    }

    const logic: LogicPoint = {
      id: createId("logic"),
      segmentIndex: clamp(selectedSegmentIndex ?? story.chapters.length - 1, 0, story.chapters.length),
      title: "新的逻辑点",
      emotion: 0,
      nodeContent: createLogicPointContent(),
    };

    commit(
      (previous) => ({
        ...previous,
        logicPoints: insertLogicPoint(previous.logicPoints, logic, selectedPathSegment),
      }),
      "已添加逻辑点",
    );
    setSelectedId(logic.id);
    setSelectedSegmentIndex(logic.segmentIndex);
    setSelectedPathSegment(null);
    return logic.id;
  }

  function addBranch(type: BranchType = "medium") {
    if (story.chapters.length < 2) {
      setStatus("至少需要两个章节节点才能创建支线");
      return undefined;
    }

    const meta = branchMeta[type];
    const startChapter = Math.max(1, story.chapters.length - 1);
    const branch: Branch = {
      id: createId("branch"),
      name: `新的${meta.label}支线`,
      type,
      color: meta.color,
      startChapter,
      endChapter: Math.min(story.chapters.length, startChapter + meta.range),
      note: "",
    };

    commit((previous) => ({ ...previous, branches: [...previous.branches, branch] }), `已添加${meta.label}支线`);
    setSelectedId(branch.id);
    return branch.id;
  }

  function addTextNote() {
    const note: TextNote = {
      id: createId("text"),
      x: 50,
      y: 34,
      text: "新文本",
    };

    commit((previous) => ({ ...previous, textNotes: [...previous.textNotes, note] }), "已添加文本标记");
    setSelectedId(note.id);
    setSelectedSegmentIndex(null);
    setSelectedPathSegment(null);
    return note.id;
  }

  function updateSegmentContent(selection: TimelineSegmentSelection, patch: Partial<SegmentContent>) {
    setStory((previous) => {
      const key = getSegmentKey(selection);
      const current = getSegmentContent(previous, selection);

      return {
        ...previous,
        segmentContents: {
          ...previous.segmentContents,
          [key]: { ...current, ...patch },
        },
      };
    });
  }

  function generateSegmentContent(selection: TimelineSegmentSelection, useRequirement: boolean) {
    setStory((previous) => {
      const key = getSegmentKey(selection);
      const current = getSegmentContent(previous, selection);
      const generated = createSegmentDraft(previous, selection, useRequirement ? current.requirement : "");

      return {
        ...previous,
        segmentContents: {
          ...previous.segmentContents,
          [key]: { ...current, generated },
        },
      };
    });
    setStatus(useRequirement ? "已根据要求重新生成阶段正文" : "已生成阶段正文");
  }

  function confirmSegmentContent(selection: TimelineSegmentSelection) {
    const content = getSegmentContent(story, selection);
    const generated = content.generated.trim();

    if (!generated) {
      setStatus("请先生成或填写阶段正文");
      return;
    }

    const confirmed = [...content.confirmed, generated].slice(-20);
    updateSegmentContent(selection, {
      generated,
      confirmed,
      historyIndex: confirmed.length - 1,
    });
    setStatus("阶段正文已确定");
  }

  function navigateSegmentContent(selection: TimelineSegmentSelection, delta: number) {
    const content = getSegmentContent(story, selection);

    if (content.confirmed.length === 0) {
      setStatus("还没有已确定的阶段正文");
      return;
    }

    const currentIndex = content.historyIndex >= 0 ? content.historyIndex : content.confirmed.length - 1;
    const historyIndex = clamp(currentIndex + delta, 0, content.confirmed.length - 1);

    if (historyIndex === content.historyIndex) {
      setStatus("没有可切换的阶段正文");
      return;
    }

    updateSegmentContent(selection, {
      generated: content.confirmed[historyIndex],
      historyIndex,
    });
  }

  function updateWritingSegmentContent(key: string, patch: Partial<SegmentContent>) {
    setStory((previous) => {
      const current = previous.segmentContents[key] ?? createSegmentContent();

      return {
        ...previous,
        segmentContents: {
          ...previous.segmentContents,
          [key]: { ...current, ...patch },
        },
      };
    });
  }

  function generateWritingSegmentContent(key: string, context: WritingSegmentContext, useRequirement: boolean) {
    setStory((previous) => {
      const current = previous.segmentContents[key] ?? createSegmentContent();
      const generated = createWritingDraft({ ...context, requirement: current.requirement || context.requirement }, useRequirement);

      return {
        ...previous,
        segmentContents: {
          ...previous.segmentContents,
          [key]: { ...current, generated },
        },
      };
    });
    setStatus(useRequirement ? "已按修改要求生成章节正文" : "已生成章节正文草稿");
  }

  function confirmWritingSegmentContent(key: string) {
    const content = story.segmentContents[key] ?? createSegmentContent();
    const generated = content.generated.trim();

    if (!generated) {
      setStatus("请先填写或生成章节正文");
      return;
    }

    const confirmed = [...content.confirmed, generated].slice(-20);
    updateWritingSegmentContent(key, {
      generated,
      confirmed,
      historyIndex: confirmed.length - 1,
    });
    setStatus("章节正文已确认");
  }

  function updateLogicPointContent(id: string, patch: Partial<LogicPointContent>) {
    setStory((previous) => ({
      ...previous,
      logicPoints: previous.logicPoints.map((logic) =>
        logic.id === id ? { ...logic, nodeContent: { ...getLogicPointContent(logic), ...patch } } : logic,
      ),
    }));
  }

  function polishLogicPointContent(id: string) {
    const logic = story.logicPoints.find((item) => item.id === id);
    const content = logic ? getLogicPointContent(logic) : createLogicPointContent();
    const polish = polishDraft(content.plot);

    if (!polish) {
      setStatus("请先填写剧情节点");
      return;
    }

    updateLogicPointContent(id, { polish });
    setStatus("AI 润色接口已预留，当前先整理为精简版本");
  }

  function confirmLogicPointContent(id: string) {
    const logic = story.logicPoints.find((item) => item.id === id);
    const content = logic ? getLogicPointContent(logic) : createLogicPointContent();
    const plot = content.plot.trim();

    if (!plot) {
      setStatus("请先填写剧情节点");
      return;
    }

    const confirmed = [...content.confirmed, plot].slice(-20);
    updateLogicPointContent(id, {
      plot,
      confirmed,
      historyIndex: confirmed.length - 1,
    });
    setStatus("剧情节点已确定");
  }

  function navigateLogicPointContent(id: string, delta: number) {
    const logic = story.logicPoints.find((item) => item.id === id);
    const content = logic ? getLogicPointContent(logic) : createLogicPointContent();

    if (content.confirmed.length === 0) {
      setStatus("还没有已确定内容");
      return;
    }

    const currentIndex = content.historyIndex >= 0 ? content.historyIndex : content.confirmed.length - 1;
    const historyIndex = clamp(currentIndex + delta, 0, content.confirmed.length - 1);

    if (historyIndex === content.historyIndex) {
      setStatus("没有可切换的确定内容");
      return;
    }

    updateLogicPointContent(id, {
      plot: content.confirmed[historyIndex],
      historyIndex,
    });
  }

  function updateChapterNodeContent(id: string, patch: Partial<ChapterNodeContent>) {
    setStory((previous) => ({
      ...previous,
      chapters: previous.chapters.map((chapter) =>
        chapter.id === id ? { ...chapter, nodeContent: { ...getChapterNodeContent(chapter), ...patch } } : chapter,
      ),
    }));
  }

  function polishChapterNodeContent(id: string) {
    const chapter = story.chapters.find((item) => item.id === id);
    const content = chapter ? getChapterNodeContent(chapter) : createChapterNodeContent();
    const previousEndingPolish = polishDraft(content.previousEnding);
    const nextOpeningPolish = polishDraft(content.nextOpening);

    if (!previousEndingPolish && !nextOpeningPolish) {
      setStatus("请先填写章节节点内容");
      return;
    }

    updateChapterNodeContent(id, {
      previousEndingPolish,
      nextOpeningPolish,
    });
    setStatus("AI 润色接口已预留，当前先整理为精简版本");
  }

  function confirmChapterNodeContent(id: string) {
    const chapter = story.chapters.find((item) => item.id === id);
    const content = chapter ? getChapterNodeContent(chapter) : createChapterNodeContent();
    const previousEnding = content.previousEnding.trim();
    const nextOpening = content.nextOpening.trim();

    if (!previousEnding && !nextOpening) {
      setStatus("请先填写章节节点内容");
      return;
    }

    const confirmed = [...content.confirmed, { previousEnding, nextOpening }].slice(-20);
    updateChapterNodeContent(id, {
      previousEnding,
      nextOpening,
      confirmed,
      historyIndex: confirmed.length - 1,
    });
    setStatus("章节节点已确定");
  }

  function navigateChapterNodeContent(id: string, delta: number) {
    const chapter = story.chapters.find((item) => item.id === id);
    const content = chapter ? getChapterNodeContent(chapter) : createChapterNodeContent();

    if (content.confirmed.length === 0) {
      setStatus("还没有已确定内容");
      return;
    }

    const currentIndex = content.historyIndex >= 0 ? content.historyIndex : content.confirmed.length - 1;
    const historyIndex = clamp(currentIndex + delta, 0, content.confirmed.length - 1);

    if (historyIndex === content.historyIndex) {
      setStatus("没有可切换的确定内容");
      return;
    }

    const confirmed = content.confirmed[historyIndex];
    updateChapterNodeContent(id, {
      previousEnding: confirmed.previousEnding,
      nextOpening: confirmed.nextOpening,
      historyIndex,
    });
  }

  function updateNodeEmotion(id: string, emotion: number) {
    setStory((previous) => ({
      ...previous,
      chapters: previous.chapters.map((chapter) => (chapter.id === id ? { ...chapter, emotion } : chapter)),
    }));
  }

  function updateMainLine(mainLineName: string, ending: string) {
    commit(
      (previous) => ({
        ...previous,
        mainLineName: mainLineName.trim() || "未命名主线",
        ending: ending.trim(),
      }),
      "主线信息已保存",
    );
  }

  function updateBranch(id: string, patch: BranchPatch) {
    commit(
      (previous) => ({
        ...previous,
        branches: previous.branches.map((branch) =>
          branch.id === id ? cleanBranchPatch({ ...branch, ...patch }, previous.chapters.length) : branch,
        ),
      }),
      "支线信息已保存",
    );
  }

  function duplicateBranch(id: string) {
    const branch = story.branches.find((item) => item.id === id);
    if (!branch) {
      setStatus("未找到可复制的支线");
      return;
    }

    const copy: Branch = {
      ...branch,
      id: createId("branch"),
      name: `${branch.name} 副本`,
    };

    commit((previous) => ({ ...previous, branches: [...previous.branches, copy] }), "已复制支线");
    setSelectedId(copy.id);
  }

  function deleteBranch(id: string) {
    commit((previous) => ({ ...previous, branches: previous.branches.filter((branch) => branch.id !== id) }), "已删除支线");

    if (selectedId === id) {
      setSelectedId("start");
    }
  }

  function setOutlineView(view: OutlineView) {
    setStory((previous) => ({
      ...previous,
      outline: {
        ...previous.outline,
        activeView: view,
      },
    }));
    setStatus("大纲视图已切换");
  }

  function selectOutlineChapter(id: string) {
    setStory((previous) => ({
      ...previous,
      outline: {
        ...previous.outline,
        selectedChapterId: id,
      },
    }));
  }

  function updateOutlineChapter(id: string, patch: OutlineChapterPatch) {
    setStory((previous) => ({
      ...previous,
      outline: {
        ...previous.outline,
        volumes: previous.outline.volumes.map((volume) => ({
          ...volume,
          chapters: volume.chapters.map((chapter) =>
            chapter.id === id
              ? {
                  ...chapter,
                  ...patch,
                  wordTarget:
                    patch.wordTarget === undefined ? chapter.wordTarget : clamp(Math.round(patch.wordTarget) || 0, 500, 10000),
                }
              : chapter,
          ),
        })),
      },
    }));
  }

  function addOutlineChapter(volumeId?: string) {
    const targetVolume = story.outline.volumes.find((volume) => volume.id === volumeId) ?? story.outline.volumes[0];
    if (!targetVolume) {
      return undefined;
    }

    const chapterCount = story.outline.volumes.reduce((total, volume) => total + volume.chapters.length, 0) + 1;
    const chapter: OutlineChapter = {
      id: createId("outline-chapter"),
      title: `第${chapterCount}章 · 未命名章节`,
      purpose: "",
      summary: "",
      conflict: "",
      wordTarget: 2000,
      status: "idea",
    };

    commit(
      (previous) => ({
        ...previous,
        outline: {
          ...previous.outline,
          selectedChapterId: chapter.id,
          volumes: previous.outline.volumes.map((volume) =>
            volume.id === targetVolume.id ? { ...volume, chapters: [...volume.chapters, chapter] } : volume,
          ),
        },
      }),
      "已添加大纲章节",
    );

    return chapter.id;
  }

  function addOutlineVolume() {
    const nextIndex = story.outline.volumes.length + 1;
    const volume = {
      id: createId("outline-volume"),
      title: `第${nextIndex}卷 · 新卷`,
      range: "待定",
      goal: "记录本卷的核心目标、转折和推进节奏。",
      chapters: [],
    };

    commit(
      (previous) => ({
        ...previous,
        outline: {
          ...previous.outline,
          volumes: [...previous.outline.volumes, volume],
        },
      }),
      "已添加大纲分卷",
    );

    return volume.id;
  }

  function setCharacterView(view: CharacterView) {
    setStory((previous) => ({
      ...previous,
      characters: {
        ...previous.characters,
        activeView: view,
      },
    }));
    setStatus("角色视图已切换");
  }

  function selectCharacter(id: string) {
    setStory((previous) => ({
      ...previous,
      characters: {
        ...previous.characters,
        selectedCharacterId: id,
      },
    }));
  }

  function updateCharacter(id: string, patch: CharacterPatch) {
    setStory((previous) => ({
      ...previous,
      characters: {
        ...previous.characters,
        roster: previous.characters.roster.map((character) =>
          character.id === id
            ? {
                ...character,
                ...patch,
                tags: patch.tags?.map((tag) => tag.trim()).filter(Boolean) ?? character.tags,
              }
            : character,
        ),
      },
    }));
  }

  function addCharacter() {
    const nextIndex = story.characters.roster.length + 1;
    const character: StoryCharacter = {
      id: createId("character"),
      name: `新角色 ${nextIndex}`,
      group: "support",
      roleLabel: "配角",
      archetype: "待定义",
      appearance: "待定",
      outerGoal: "",
      innerDesire: "",
      weakness: "",
      secret: "",
      relationshipSummary: "",
      arcStage: "",
      tags: ["待完善"],
    };

    commit(
      (previous) => ({
        ...previous,
        characters: {
          ...previous.characters,
          selectedCharacterId: character.id,
          roster: [...previous.characters.roster, character],
        },
      }),
      "已添加角色",
    );

    return character.id;
  }

  function setSettingView(view: SettingView) {
    setStory((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        activeView: view,
      },
    }));
    setStatus("设定视图已切换");
  }

  function selectSetting(id: string) {
    setStory((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        selectedSettingId: id,
      },
    }));
  }

  function updateSetting(id: string, patch: SettingPatch) {
    setStory((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        entries: previous.settings.entries.map((setting) =>
          setting.id === id
            ? {
                ...setting,
                ...patch,
                conflictRisk:
                  patch.conflictRisk === undefined ? setting.conflictRisk : clamp(Math.round(patch.conflictRisk) || 0, 0, 100),
                tags: patch.tags?.map((tag) => tag.trim()).filter(Boolean) ?? setting.tags,
              }
            : setting,
        ),
      },
    }));
  }

  function addSetting() {
    const nextIndex = story.settings.entries.length + 1;
    const setting: StorySetting = {
      id: createId("setting"),
      name: `新设定 ${nextIndex}`,
      category: "rule",
      status: "draft",
      scope: "待定",
      coreRule: "",
      limits: "",
      impactCharacters: "",
      linkedChapters: "",
      notes: "",
      conflictRisk: 0,
      aiReady: false,
      tags: ["待完善"],
    };

    commit(
      (previous) => ({
        ...previous,
        settings: {
          ...previous.settings,
          selectedSettingId: setting.id,
          entries: [...previous.settings.entries, setting],
        },
      }),
      "已添加设定",
    );

    return setting.id;
  }

  function setWorldLayer(layer: WorldLayer) {
    setStory((previous) => ({
      ...previous,
      world: {
        ...previous.world,
        activeLayer: layer,
      },
    }));
    setStatus("世界观图层已切换");
  }

  function selectWorldEntry(id: string) {
    setStory((previous) => ({
      ...previous,
      world: {
        ...previous.world,
        selectedEntryId: id,
      },
    }));
  }

  function updateWorldEntry(id: string, patch: WorldEntryPatch) {
    setStory((previous) => ({
      ...previous,
      world: {
        ...previous.world,
        entries: previous.world.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...patch,
                latitude: patch.latitude === undefined ? entry.latitude : clamp(Math.round(patch.latitude) || 0, -85, 85),
                longitude: patch.longitude === undefined ? entry.longitude : clamp(Math.round(patch.longitude) || 0, -180, 180),
                risk: patch.risk === undefined ? entry.risk : clamp(Math.round(patch.risk) || 0, 0, 100),
                tags: patch.tags?.map((tag) => tag.trim()).filter(Boolean) ?? entry.tags,
              }
            : entry,
        ),
      },
    }));
  }

  function updatePromptTemplate(id: string, patch: PromptPatch) {
    setStory((previous) => ({
      ...previous,
      prompts: previous.prompts.map((template) =>
        template.id === id ? { ...template, ...patch, updatedAt: "刚刚" } : template,
      ),
    }));
  }

  function restorePromptTemplate(id: string) {
    setStory((previous) => ({
      ...previous,
      prompts: previous.prompts.map((template) =>
        template.id === id
          ? {
              ...template,
              systemPrompt: template.defaultSystemPrompt,
              userPrompt: template.defaultUserPrompt,
              updatedAt: "刚刚",
            }
          : template,
      ),
    }));
    setStatus("提示词已恢复为默认版本");
  }

  function duplicatePromptTemplate(id: string) {
    const copyId = createId("prompt");

    setStory((previous) => {
      const template = previous.prompts.find((item) => item.id === id);
      if (!template) {
        return previous;
      }

      return {
        ...previous,
        prompts: [
          ...previous.prompts,
          {
            ...template,
            id: copyId,
            title: `${template.title} · 副本`,
            badge: "自定义版本",
            version: nextPromptVersion(template.version),
            updatedAt: "刚刚",
          },
        ],
      };
    });
    setStatus("已复制为新的提示词版本");
    return copyId;
  }

  function savePromptTemplate(id: string) {
    const template = story.prompts.find((item) => item.id === id);
    setStatus(`${template?.title ?? "提示词模板"}已保存`);
  }

  return {
    story,
    tool,
    zoomX,
    zoomLabel,
    timelineStyle,
    timelineGrowth,
    panX,
    selectedId,
    selectedSegmentIndex,
    selectedPathSegment,
    status,
    windowLabel,
    setTool,
    setPanX,
    setStatus,
    setSelectedId,
    setSelectedSegmentIndex,
    setSelectedPathSegment,
    setZoom,
    zoomBy,
    zoomByAt,
    resetView,
    undo,
    redo,
    addChapter,
    addLogicPoint,
    addBranch,
    addTextNote,
    updateSegmentContent,
    generateSegmentContent,
    confirmSegmentContent,
    navigateSegmentContent,
    updateWritingSegmentContent,
    generateWritingSegmentContent,
    confirmWritingSegmentContent,
    updateLogicPointContent,
    polishLogicPointContent,
    confirmLogicPointContent,
    navigateLogicPointContent,
    updateChapterNodeContent,
    polishChapterNodeContent,
    confirmChapterNodeContent,
    navigateChapterNodeContent,
    updateNodeEmotion,
    updateMainLine,
    updateBranch,
    duplicateBranch,
    deleteBranch,
    setOutlineView,
    selectOutlineChapter,
    updateOutlineChapter,
    addOutlineChapter,
    addOutlineVolume,
    setCharacterView,
    selectCharacter,
    updateCharacter,
    addCharacter,
    setSettingView,
    selectSetting,
    updateSetting,
    addSetting,
    setWorldLayer,
    selectWorldEntry,
    updateWorldEntry,
    updatePromptTemplate,
    restorePromptTemplate,
    duplicatePromptTemplate,
    savePromptTemplate,
  };
}
