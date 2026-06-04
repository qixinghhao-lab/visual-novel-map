import type { CSSProperties, PointerEvent, ReactNode, WheelEvent } from "react";
import { createChapterNodeContent, createLogicPointContent } from "../domain/storyDefaults";
import { pointToCssPosition } from "../domain/timeline";
import type { ChapterNodeContent, LogicPointContent, StoryState, TimelinePoint } from "../types/story";

export type NodeInfoActions = {
  onUpdateLogicPointContent: (id: string, patch: Partial<LogicPointContent>) => void;
  onPolishLogicPointContent: (id: string) => void;
  onConfirmLogicPointContent: (id: string) => void;
  onNavigateLogicPointContent: (id: string, delta: number) => void;
  onUpdateChapterNodeContent: (id: string, patch: Partial<ChapterNodeContent>) => void;
  onPolishChapterNodeContent: (id: string) => void;
  onConfirmChapterNodeContent: (id: string) => void;
  onNavigateChapterNodeContent: (id: string, delta: number) => void;
};

type NodeInfoPopoverProps = NodeInfoActions & {
  open: boolean;
  story: StoryState;
  selectedId: string;
  timelinePoints: TimelinePoint[];
};

export function NodeInfoPopover({
  open,
  story,
  selectedId,
  timelinePoints,
  onUpdateLogicPointContent,
  onPolishLogicPointContent,
  onConfirmLogicPointContent,
  onNavigateLogicPointContent,
  onUpdateChapterNodeContent,
  onPolishChapterNodeContent,
  onConfirmChapterNodeContent,
  onNavigateChapterNodeContent,
}: NodeInfoPopoverProps) {
  const point = timelinePoints.find((item) => item.id === selectedId);

  if (!open || !point || (point.kind !== "chapter" && point.kind !== "logic")) {
    return null;
  }

  const popoverStyle = getPopoverStyle(point);

  if (point.kind === "logic") {
    const logic = story.logicPoints.find((item) => item.id === selectedId);
    if (!logic) {
      return null;
    }

    const content = logic.nodeContent ?? createLogicPointContent();

    return (
      <PopoverFrame className="logic" style={popoverStyle}>
        <PopoverHeader badge="剧情节点" title="逻辑点" />
        <label className="node-popover-field">
          <span>剧情节点</span>
          <textarea
            className="node-popover-textarea main"
            onChange={(event) => onUpdateLogicPointContent(logic.id, { plot: event.target.value })}
            placeholder="输入这个逻辑点必须达到的剧情内容"
            value={content.plot}
          />
        </label>
        <label className="node-popover-field">
          <span>AI 润色</span>
          <textarea
            className="node-popover-textarea polish"
            onChange={(event) => onUpdateLogicPointContent(logic.id, { polish: event.target.value })}
            placeholder="润色结果会出现在这里"
            value={content.polish}
          />
        </label>
        <PopoverActions
          confirmedCount={content.confirmed.length}
          historyIndex={content.historyIndex}
          onConfirm={() => onConfirmLogicPointContent(logic.id)}
          onNext={() => onNavigateLogicPointContent(logic.id, 1)}
          onPolish={() => onPolishLogicPointContent(logic.id)}
          onPrev={() => onNavigateLogicPointContent(logic.id, -1)}
        />
      </PopoverFrame>
    );
  }

  const chapter = story.chapters.find((item) => item.id === selectedId);
  if (!chapter) {
    return null;
  }

  const content = chapter.nodeContent ?? createChapterNodeContent();

  return (
    <PopoverFrame className="chapter" style={popoverStyle}>
      <PopoverHeader badge="章节节点" title={point.label} />
      <label className="node-popover-field">
        <span>上一章结尾点</span>
        <textarea
          className="node-popover-textarea compact-main"
          onChange={(event) => onUpdateChapterNodeContent(chapter.id, { previousEnding: event.target.value })}
          placeholder="输入上一章最后要途经的剧情点"
          value={content.previousEnding}
        />
      </label>
      <label className="node-popover-field">
        <span>AI 润色</span>
        <textarea
          className="node-popover-textarea polish"
          onChange={(event) =>
            onUpdateChapterNodeContent(chapter.id, { previousEndingPolish: event.target.value })
          }
          placeholder="润色结果"
          value={content.previousEndingPolish}
        />
      </label>
      <label className="node-popover-field">
        <span>下一章开头</span>
        <textarea
          className="node-popover-textarea compact-main"
          onChange={(event) => onUpdateChapterNodeContent(chapter.id, { nextOpening: event.target.value })}
          placeholder="输入下一章开头要承接的剧情点"
          value={content.nextOpening}
        />
      </label>
      <label className="node-popover-field">
        <span>AI 润色</span>
        <textarea
          className="node-popover-textarea polish"
          onChange={(event) => onUpdateChapterNodeContent(chapter.id, { nextOpeningPolish: event.target.value })}
          placeholder="润色结果"
          value={content.nextOpeningPolish}
        />
      </label>
      <PopoverActions
        confirmedCount={content.confirmed.length}
        historyIndex={content.historyIndex}
        onConfirm={() => onConfirmChapterNodeContent(chapter.id)}
        onNext={() => onNavigateChapterNodeContent(chapter.id, 1)}
        onPolish={() => onPolishChapterNodeContent(chapter.id)}
        onPrev={() => onNavigateChapterNodeContent(chapter.id, -1)}
      />
    </PopoverFrame>
  );
}

function getPopoverStyle(point: TimelinePoint) {
  const gap = point.emotion < 0 ? Math.min(52 + Math.abs(point.emotion) * 9, 94) : 34;
  return {
    ...pointToCssPosition(point),
    "--popover-gap": `${gap}px`,
  } as CSSProperties;
}

function PopoverFrame({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className: string;
  style: CSSProperties;
}) {
  function stopPointer(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  function stopWheel(event: WheelEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      className={`node-info-popover ${className}`}
      onPointerDown={stopPointer}
      onWheel={stopWheel}
      style={style}
    >
      {children}
    </div>
  );
}

function PopoverHeader({ badge, title }: { badge: string; title: string }) {
  return (
    <header className="node-popover-header">
      <span>{badge}</span>
      <strong>{title}</strong>
    </header>
  );
}

function PopoverActions({
  confirmedCount,
  historyIndex,
  onConfirm,
  onNext,
  onPolish,
  onPrev,
}: {
  confirmedCount: number;
  historyIndex: number;
  onConfirm: () => void;
  onNext: () => void;
  onPolish: () => void;
  onPrev: () => void;
}) {
  const displayIndex = confirmedCount > 0 && historyIndex >= 0 ? historyIndex + 1 : 0;

  return (
    <div className="node-popover-actions">
      <button className="node-popover-polish" onClick={onPolish} type="button">
        润色
      </button>
      <div className="node-history-controls" aria-label="确定内容历史">
        <button disabled={displayIndex <= 1} onClick={onPrev} type="button">
          ‹
        </button>
        <span>
          {displayIndex} / {confirmedCount}
        </span>
        <button disabled={displayIndex >= confirmedCount} onClick={onNext} type="button">
          ›
        </button>
      </div>
      <button className="node-popover-confirm" onClick={onConfirm} type="button">
        确定
      </button>
    </div>
  );
}
