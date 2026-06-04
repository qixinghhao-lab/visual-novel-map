import type { LogicPoint, OutlineChapter, SegmentContent, StoryState } from "../types/story";

export type WritingSegmentContext = {
  title: string;
  fromLabel: string;
  toLabel: string;
  logicMarkers: string[];
  requirement: string;
};

export type WritingSection = {
  key: string;
  index: number;
  title: string;
  subtitle: string;
  fromLabel: string;
  toLabel: string;
  wordTarget: number;
  statusLabel: string;
  logicMarkers: string[];
  fallbackText: string;
};

type OutlineChapterEntry = OutlineChapter & {
  volumeTitle: string;
  volumeRange: string;
};

function flattenOutlineChapters(story: StoryState): OutlineChapterEntry[] {
  return story.outline.volumes.flatMap((volume) =>
    volume.chapters.map((chapter) => ({
      ...chapter,
      volumeTitle: volume.title,
      volumeRange: volume.range,
    })),
  );
}

function formatChapterTitle(index: number, chapter?: { name: string }) {
  return `第 ${index + 1} 章${chapter?.name ? ` · ${chapter.name}` : ""}`;
}

function getLogicSummary(logic: LogicPoint) {
  const plot = logic.nodeContent?.plot?.trim();
  return plot || logic.title || "未命名逻辑点";
}

function createFallbackFromOutline(chapter: OutlineChapterEntry) {
  const parts = [
    chapter.summary,
    chapter.purpose ? `本章目的：${chapter.purpose}` : "",
    chapter.conflict ? `主要冲突：${chapter.conflict}` : "",
  ].filter(Boolean);

  return parts.join("\n\n") || "这里开始写本章正文。";
}

function createFallbackFromTimeline(section: WritingSection) {
  const logicLine =
    section.logicMarkers.length > 0
      ? `本章内部需要经过：${section.logicMarkers.join("、")}。`
      : "本章内部还没有明确逻辑点，可以先写主线推进。";

  return `承接“${section.fromLabel}”，本章需要把剧情自然推进到“${section.toLabel}”。\n\n${logicLine}\n\n在这里写正文。`;
}

export function buildWritingSections(story: StoryState): WritingSection[] {
  if (story.chapters.length > 0) {
    return story.chapters.map((chapter, index) => {
      const fromId = index === 0 ? "start" : story.chapters[index - 1].id;
      const toId = chapter.id;
      const logicMarkers = story.logicPoints.filter((logic) => logic.segmentIndex === index).map(getLogicSummary);
      const section: WritingSection = {
        key: `${fromId}->${toId}`,
        index,
        title: formatChapterTitle(index, chapter),
        subtitle: `${index === 0 ? "故事起点" : story.chapters[index - 1].name} -> ${chapter.name}`,
        fromLabel: index === 0 ? "故事起点" : story.chapters[index - 1].name,
        toLabel: chapter.name,
        wordTarget: 2000,
        statusLabel: "故事线",
        logicMarkers,
        fallbackText: "",
      };

      return { ...section, fallbackText: createFallbackFromTimeline(section) };
    });
  }

  return flattenOutlineChapters(story).map((chapter, index) => {
    const logicMarkers = [chapter.purpose, chapter.conflict].filter(Boolean);
    return {
      key: `outline:${chapter.id}`,
      index,
      title: chapter.title,
      subtitle: `${chapter.volumeTitle} / ${chapter.volumeRange}`,
      fromLabel: index === 0 ? "故事起点" : `第 ${index} 章结尾`,
      toLabel: chapter.title,
      wordTarget: chapter.wordTarget,
      statusLabel: chapter.status === "ready" ? "就绪" : chapter.status === "draft" ? "草稿" : "想法",
      logicMarkers,
      fallbackText: createFallbackFromOutline(chapter),
    };
  });
}

export function splitParagraphs(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return ["这里开始写正文。"];
  }

  return normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function replaceParagraph(text: string, paragraphIndex: number, nextParagraph: string) {
  const paragraphs = splitParagraphs(text);
  paragraphs[paragraphIndex] = nextParagraph;
  return paragraphs.join("\n\n");
}

export function countChars(text: string) {
  return text.replace(/\s/g, "").length;
}

export function createPolishDraft(paragraph: string) {
  const source = paragraph.trim() || "这里需要补写正文。";
  return `${source.replace(/\s+/g, " ")}\n\n这版会保留原有信息，把句子关系整理得更顺、节奏更稳。后续接入真实 AI 后，这里会输出更自然的润色稿。`;
}

export function createRewriteDraft(paragraph: string, instruction: string, section: WritingSection) {
  const request = instruction.trim() || "让这一段更清晰、更顺滑、更有人味儿";
  const source = paragraph.trim() || "这里需要补写正文。";

  return `按“${request}”改写：\n\n${source.replace(/\s+/g, " ")}\n\n改写时会承接“${section.fromLabel}”，并继续推向“${section.toLabel}”。后续接入真实 AI 后，会直接基于选中段落生成可替换正文。`;
}

export function createWritingDraft(context: WritingSegmentContext, useRequirement: boolean) {
  const logicLine =
    context.logicMarkers.length > 0
      ? `章节内需要依次照顾：${context.logicMarkers.join("、")}。`
      : "章节内暂无明确逻辑点，需要先保持起承转合清楚。";
  const requirement =
    useRequirement && context.requirement.trim()
      ? `本次改写要求：${context.requirement.trim()}。`
      : "本次先保持信息准确、语气顺滑、推进自然。";

  return `承接“${context.fromLabel}”，这一段正文需要先稳定上一节点留下的情绪和信息，再用具体动作、对话或发现推进到“${context.toLabel}”。${logicLine}\n\n${requirement}\n\n这里会作为写作页的 AI 改写结果预览。后续接入真实模型后，会结合世界观、角色、人设、前后节点和用户要求，直接生成可替换的正文段落。`;
}

export function getLogicMarkerForParagraph(section: WritingSection, paragraphIndex: number) {
  if (section.logicMarkers.length === 0) {
    return undefined;
  }

  if (paragraphIndex === 0) {
    return "章节点承接";
  }

  return section.logicMarkers[(paragraphIndex - 1) % section.logicMarkers.length];
}

export function getSegmentContentByKey(segmentContents: Record<string, SegmentContent>, key: string) {
  return segmentContents[key];
}
