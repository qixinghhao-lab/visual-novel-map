import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import { createSegmentContent } from "../domain/storyDefaults";
import { getChapterX, pointToSvg, TIMELINE_SVG_TOP } from "../domain/timeline";
import type { SegmentContent, StoryState, TimelinePoint, TimelineSegmentSelection } from "../types/story";

export type SegmentInfoActions = {
  onUpdateSegmentContent: (selection: TimelineSegmentSelection, patch: Partial<SegmentContent>) => void;
  onGenerateSegmentContent: (selection: TimelineSegmentSelection, useRequirement: boolean) => void;
  onConfirmSegmentContent: (selection: TimelineSegmentSelection) => void;
  onNavigateSegmentContent: (selection: TimelineSegmentSelection, delta: number) => void;
};

type SegmentInfoPopoverProps = SegmentInfoActions & {
  open: boolean;
  selectedPathSegment: TimelineSegmentSelection | null;
  story: StoryState;
  timelinePoints: TimelinePoint[];
};

export function SegmentInfoPopover({
  open,
  selectedPathSegment,
  story,
  timelinePoints,
  onUpdateSegmentContent,
  onGenerateSegmentContent,
  onConfirmSegmentContent,
  onNavigateSegmentContent,
}: SegmentInfoPopoverProps) {
  if (!open || !selectedPathSegment) {
    return null;
  }

  const segmentIndex = getSelectedSegmentIndex(timelinePoints, selectedPathSegment);
  const from = timelinePoints[segmentIndex];
  const to = timelinePoints[segmentIndex + 1];

  if (segmentIndex < 0 || !from || !to) {
    return null;
  }

  const key = getSegmentKey(selectedPathSegment);
  const content = story.segmentContents[key] ?? createSegmentContent();
  const displayIndex = content.confirmed.length > 0 && content.historyIndex >= 0 ? content.historyIndex + 1 : 0;

  function stopPointer(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  function stopWheel(event: WheelEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      className="node-info-popover segment"
      onPointerDown={stopPointer}
      onWheel={stopWheel}
      style={getSegmentPopoverStyle(from, to)}
    >
      <header className="node-popover-header segment-header">
        <span>阶段正文</span>
        <strong>{getSegmentLabel(story, timelinePoints, segmentIndex)}</strong>
      </header>

      <label className="node-popover-field">
        <span>AI 生成正文</span>
        <textarea
          className="node-popover-textarea segment-main"
          onChange={(event) => onUpdateSegmentContent(selectedPathSegment, { generated: event.target.value })}
          placeholder="AI 会结合世界观、人设、前后节点剧情，生成承接这一段的正文信息"
          value={content.generated}
        />
      </label>

      <label className="node-popover-field">
        <span>生成要求（可选）</span>
        <textarea
          className="node-popover-textarea segment-requirement"
          onChange={(event) => onUpdateSegmentContent(selectedPathSegment, { requirement: event.target.value })}
          placeholder="输入这次重新生成的侧重点"
          value={content.requirement}
        />
      </label>

      <div className="segment-popover-actions">
        <button className="node-popover-polish" onClick={() => onGenerateSegmentContent(selectedPathSegment, false)} type="button">
          AI生成
        </button>
        <button className="node-popover-polish regenerate" onClick={() => onGenerateSegmentContent(selectedPathSegment, true)} type="button">
          重新生成
        </button>
        <div className="node-history-controls" aria-label="已确定阶段正文历史">
          <button disabled={displayIndex <= 1} onClick={() => onNavigateSegmentContent(selectedPathSegment, -1)} type="button">
            ‹
          </button>
          <span>
            {displayIndex} / {content.confirmed.length}
          </span>
          <button
            disabled={displayIndex >= content.confirmed.length}
            onClick={() => onNavigateSegmentContent(selectedPathSegment, 1)}
            type="button"
          >
            ›
          </button>
        </div>
        <button className="node-popover-confirm" onClick={() => onConfirmSegmentContent(selectedPathSegment)} type="button">
          确定
        </button>
      </div>
    </div>
  );
}

function getSegmentKey(selection: TimelineSegmentSelection) {
  return `${selection.fromId}->${selection.toId}`;
}

function getSelectedSegmentIndex(timelinePoints: TimelinePoint[], selection: TimelineSegmentSelection) {
  return timelinePoints
    .slice(0, -1)
    .findIndex((point, index) => selection.fromId === point.id && selection.toId === timelinePoints[index + 1].id);
}

function getSegmentPopoverStyle(from: TimelinePoint, to: TimelinePoint) {
  const fromPoint = pointToSvg(from);
  const toPoint = pointToSvg(to);

  return {
    left: `${(((fromPoint.x + toPoint.x) / 2) / 1000) * 100}%`,
    top: `${TIMELINE_SVG_TOP + (fromPoint.y + toPoint.y) / 2}px`,
    "--popover-gap": "32px",
  } as CSSProperties;
}

function getStorySegmentIndex(story: StoryState, from: TimelinePoint, to: TimelinePoint) {
  if (story.chapters.length === 0) {
    return 0;
  }

  const midpoint = (from.xPercent + to.xPercent) / 2;

  for (let index = 0; index < story.chapters.length; index += 1) {
    if (midpoint < getChapterX(index, story.chapters.length)) {
      return index;
    }
  }

  return story.chapters.length;
}

function hasLogicPointInsideSegment(from: TimelinePoint, to: TimelinePoint) {
  return from.kind === "logic" || to.kind === "logic";
}

function getSegmentLabel(story: StoryState, timelinePoints: TimelinePoint[], selectedSegmentIndex: number) {
  const from = timelinePoints[selectedSegmentIndex];
  const to = timelinePoints[selectedSegmentIndex + 1];
  const chapterIndex = getStorySegmentIndex(story, from, to);

  if (!hasLogicPointInsideSegment(from, to)) {
    return `第${chapterIndex + 1}章`;
  }

  const subsegmentIndex =
    timelinePoints.slice(0, selectedSegmentIndex + 1).reduce((count, currentPoint, index) => {
      const currentNextPoint = timelinePoints[index + 1];

      if (!currentNextPoint) {
        return count;
      }

      return getStorySegmentIndex(story, currentPoint, currentNextPoint) === chapterIndex ? count + 1 : count;
    }, 0) || 1;

  return `第${chapterIndex + 1}.${subsegmentIndex}段`;
}
