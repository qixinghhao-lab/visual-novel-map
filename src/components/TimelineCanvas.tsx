import { branchMeta, emotionLayers } from "../domain/storyDefaults";
import {
  CURVE_TANGENT_SCALE,
  EMOTION_STEP_Y,
  clamp,
  getChapterX,
  getSegmentColor,
  pointToCssPosition,
  pointToSvg,
  TIMELINE_BASELINE_Y,
  TIMELINE_SVG_TOP,
} from "../domain/timeline";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject, type WheelEvent } from "react";
import { NodeInfoPopover, type NodeInfoActions } from "./NodeInfoPopover";
import { SegmentInfoPopover, type SegmentInfoActions } from "./SegmentInfoPopover";
import type {
  StoryState,
  TimelinePoint,
  TimelineSegmentSelection,
} from "../types/story";

const MINIMAP_LEFT = 42;
const MINIMAP_RIGHT = 958;
const MINIMAP_WIDTH = MINIMAP_RIGHT - MINIMAP_LEFT;
const LOGIC_REVEAL_ZOOM_X = 1.35;
const TIMELINE_WIDTH_RATIO = 0.88;
const TIMELINE_MIN_WIDTH = 760;
const TIMELINE_LINE_RATIO = 0.91;
const TIMELINE_VIEWPORT_EDGE_INSET = 48;

type LogicRenderMeta = {
  density: number;
  index: number;
  total: number;
};

type TimelineCanvasProps = {
  story: StoryState;
  timelinePoints: TimelinePoint[];
  timelineStyle: CSSProperties;
  timelineGrowth: number;
  emotionOn: boolean;
  showOverview: boolean;
  showTicks: boolean;
  nodePopoverOpen: boolean;
  segmentPopoverOpen: boolean;
  selectedId: string;
  selectedPathSegment: TimelineSegmentSelection | null;
  zoomX: number;
  panX: number;
  zoomLabel: string;
  canvasRef: RefObject<HTMLElement | null>;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerEnd: (event: PointerEvent<HTMLElement>) => void;
  onWheel: (event: WheelEvent<HTMLElement>) => void;
  onNodePointerDown: (id: string, event: PointerEvent<HTMLButtonElement>) => void;
  onSegmentPointerDown: (selection: TimelineSegmentSelection, event: PointerEvent<SVGPathElement>) => void;
  onBranchPointerDown: (id: string, event: PointerEvent<SVGPathElement>) => void;
  nodeInfoActions: NodeInfoActions;
  segmentInfoActions: SegmentInfoActions;
  onPanXChange: (panX: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
};

export function TimelineCanvas({
  story,
  timelinePoints,
  timelineStyle,
  timelineGrowth,
  emotionOn,
  showOverview,
  showTicks,
  nodePopoverOpen,
  segmentPopoverOpen,
  selectedId,
  selectedPathSegment,
  zoomX,
  panX,
  zoomLabel,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onWheel,
  onNodePointerDown,
  onSegmentPointerDown,
  onBranchPointerDown,
  nodeInfoActions,
  segmentInfoActions,
  onPanXChange,
  onZoomIn,
  onZoomOut,
  onResetView,
}: TimelineCanvasProps) {
  return (
    <section
      ref={canvasRef}
      className="empty-canvas"
      aria-label="故事主线画布"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
    >
      <div className="timeline-content" style={timelineStyle}>
        {emotionOn && <EmotionGuides />}
        <TimelinePath
          story={story}
          timelinePoints={timelinePoints}
          selectedPathSegment={selectedPathSegment}
          onSegmentPointerDown={onSegmentPointerDown}
        />
        <TimelineBranches story={story} selectedId={selectedId} onBranchPointerDown={onBranchPointerDown} />
        <TimelineNodes
          story={story}
          timelinePoints={timelinePoints}
          emotionOn={emotionOn}
          selectedId={selectedId}
          timelineGrowth={timelineGrowth}
          zoomX={zoomX}
          onNodePointerDown={onNodePointerDown}
        />
        <NodeInfoPopover
          open={nodePopoverOpen}
          story={story}
          selectedId={selectedId}
          timelinePoints={timelinePoints}
          {...nodeInfoActions}
        />
        <SegmentInfoPopover
          open={segmentPopoverOpen}
          selectedPathSegment={selectedPathSegment}
          story={story}
          timelinePoints={timelinePoints}
          {...segmentInfoActions}
        />
        {showTicks && <TimelineTicks totalChapters={story.chapters.length} />}
      </div>

      {showOverview && (
        <TimelineMinimap
          detailed
          panX={panX}
          canvasRef={canvasRef}
          selectedId={selectedId}
          story={story}
          timelinePoints={timelinePoints}
          timelineGrowth={timelineGrowth}
          onPanXChange={onPanXChange}
          zoomX={zoomX}
        />
      )}

      <div className="zoom-box canvas-zoom" onPointerDown={(event) => event.stopPropagation()}>
        <button aria-label="缩小" onClick={onZoomOut}>
          −
        </button>
        <span>{zoomLabel}</span>
        <button aria-label="放大" onClick={onZoomIn}>
          +
        </button>
        <button aria-label="恢复视图" onClick={onResetView}>
          ↗
        </button>
      </div>
    </section>
  );
}

function EmotionGuides() {
  return (
    <div className="snap-guides" aria-hidden="true">
      {emotionLayers.map((layer) => (
        <div
          className={`snap-line ${layer > 0 ? "warm" : layer < 0 ? "cool" : "neutral"}`}
          key={layer}
          style={{ top: `${TIMELINE_SVG_TOP + TIMELINE_BASELINE_Y - layer * EMOTION_STEP_Y}px` }}
        >
          <span>{layer > 0 ? `+${layer}` : layer}</span>
        </div>
      ))}
    </div>
  );
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

function TimelinePath({
  story,
  timelinePoints,
  selectedPathSegment,
  onSegmentPointerDown,
}: Pick<
  TimelineCanvasProps,
  "story" | "timelinePoints" | "selectedPathSegment" | "onSegmentPointerDown"
>) {
  const emotionCurvePoints = getEmotionCurvePoints(timelinePoints);
  const { continuousPath } = getTimelineGeometry(emotionCurvePoints);
  const { segmentLocators, segmentPaths } = getTimelineGeometry(timelinePoints);
  const selectedSegmentIndex = selectedPathSegment
    ? timelinePoints
        .slice(0, -1)
        .findIndex((point, index) => selectedPathSegment.fromId === point.id && selectedPathSegment.toId === timelinePoints[index + 1].id)
    : -1;
  const selectedLocator = selectedSegmentIndex >= 0 ? segmentLocators[selectedSegmentIndex] : null;
  const selectedSegmentNumber =
    selectedSegmentIndex >= 0 ? getSegmentMarkerLabel(story, timelinePoints, selectedSegmentIndex) : null;

  return (
    <>
      <svg className="timeline-svg" viewBox="0 0 1000 280" preserveAspectRatio="none" role="img" aria-label="主阅读路径">
        {continuousPath && (
          <g className="curve-segment orange curve-ribbon-base">
            <path className="curve-bed" d={continuousPath} />
            <path className="curve-lower-edge" d={continuousPath} />
            <path className="curve-line" d={continuousPath} />
            <path className="curve-top-highlight" d={continuousPath} />
            <path className="curve-growth-sheen" d={continuousPath} key={`growth-${timelinePoints.length}`} />
          </g>
      )}
        {timelinePoints.slice(0, -1).map((point, index) => {
          const nextPoint = timelinePoints[index + 1];
          const segmentIndex = getStorySegmentIndex(story, point, nextPoint);
          const selection = {
            chapterSegmentIndex: segmentIndex,
            fromId: point.id,
            toId: nextPoint.id,
          };
          const selected = selectedPathSegment?.fromId === point.id && selectedPathSegment.toId === nextPoint.id;
          const color = getSegmentColor(story, point, nextPoint);
          const path = segmentPaths[index] ?? "";

          if (!path) {
            return null;
          }

          return (
            <g className={`curve-hit-segment ${color}${selected ? " selected" : ""}`} key={`${point.id}-${nextPoint.id}`}>
              {selected && (
                <g className={`curve-segment ${color} selected curve-selection-overlay`}>
                  <path className="curve-bed" d={path} />
                  <path className="curve-lower-edge" d={path} />
                  <path className="curve-line" d={path} />
                  <path className="curve-top-highlight" d={path} />
                  <path className="curve-selection-sheen" d={path} />
                </g>
              )}
              <path className="curve-hit" d={path} onPointerDown={(event) => onSegmentPointerDown(selection, event)} />
            </g>
          );
        })}
      </svg>
      {selectedLocator && selectedSegmentNumber && (
        <div
          className={`timeline-segment-marker${selectedSegmentNumber.length >= 4 ? " compact" : ""}`}
          style={{
            left: `${(selectedLocator.x / 1000) * 100}%`,
            top: `${TIMELINE_SVG_TOP + selectedLocator.y - 20}px`,
          }}
        >
          {selectedSegmentNumber}
        </div>
      )}
    </>
  );
}

function getEmotionCurvePoints(points: TimelinePoint[]) {
  return points.filter((point) => point.kind !== "logic");
}

function getBranchX(chapterNumber: number, totalChapters: number) {
  if (totalChapters <= 0) {
    return 45;
  }

  return 45 + getChapterX(clamp(chapterNumber - 1, 0, totalChapters - 1), totalChapters) * 9.1;
}

function getBranchGeometry(startX: number, endX: number, index: number) {
  const layer = index % 4;
  const y = TIMELINE_BASELINE_Y + 44 + layer * 18;
  const span = Math.max(endX - startX, 38);
  const depth = Math.min(30 + span * 0.035, 54);
  const controlInset = Math.max(span * 0.22, 28);

  return {
    labelX: startX + span / 2,
    labelY: y + depth * 0.52,
    path: `M ${startX} ${TIMELINE_BASELINE_Y + 2} C ${startX + controlInset} ${y + depth}, ${endX - controlInset} ${y + depth}, ${endX} ${TIMELINE_BASELINE_Y + 2}`,
  };
}

function TimelineBranches({
  story,
  selectedId,
  onBranchPointerDown,
}: Pick<TimelineCanvasProps, "story" | "selectedId" | "onBranchPointerDown">) {
  if (story.branches.length === 0 || story.chapters.length < 2) {
    return null;
  }

  return (
    <>
      <svg className="branch-svg" viewBox="0 0 1000 280" preserveAspectRatio="none" aria-label="支线层">
        {story.branches.map((branch, index) => {
          const startX = getBranchX(branch.startChapter, story.chapters.length);
          const endX = Math.max(getBranchX(branch.endChapter, story.chapters.length), startX + 38);
          const geometry = getBranchGeometry(startX, Math.min(endX, 955), index);
          const selected = selectedId === branch.id;

          return (
            <g className={`branch-curve ${branch.color}${selected ? " selected" : ""}`} key={branch.id}>
              <path className="branch-bed" d={geometry.path} />
              <path className="branch-line" d={geometry.path} />
              <path className="branch-highlight" d={geometry.path} />
              {selected && <path className="branch-sheen" d={geometry.path} />}
              <path className="branch-hit" d={geometry.path} onPointerDown={(event) => onBranchPointerDown(branch.id, event)} />
            </g>
          );
        })}
      </svg>
      {story.branches.map((branch, index) => {
        const startX = getBranchX(branch.startChapter, story.chapters.length);
        const endX = Math.max(getBranchX(branch.endChapter, story.chapters.length), startX + 38);
        const geometry = getBranchGeometry(startX, Math.min(endX, 955), index);

        return (
          <div
            className={`branch-pill ${branch.color}${selectedId === branch.id ? " selected" : ""}`}
            key={branch.id}
            style={{
              left: `${(geometry.labelX / 1000) * 100}%`,
              top: `${TIMELINE_SVG_TOP + geometry.labelY}px`,
            }}
          >
            <span>{branchMeta[branch.type].label}</span>
            <strong>{branch.name}</strong>
          </div>
        );
      })}
    </>
  );
}

function getSegmentMarkerLabel(story: StoryState, timelinePoints: TimelinePoint[], selectedSegmentIndex: number) {
  const point = timelinePoints[selectedSegmentIndex];
  const nextPoint = timelinePoints[selectedSegmentIndex + 1];
  const storySegmentIndex = getStorySegmentIndex(story, point, nextPoint);
  const hasLogicSplit = story.logicPoints.some((logic) => logic.segmentIndex === storySegmentIndex);

  if (!hasLogicSplit) {
    return String(storySegmentIndex + 1);
  }

  const subsegmentIndex =
    timelinePoints.slice(0, selectedSegmentIndex + 1).reduce((count, currentPoint, index) => {
      const currentNextPoint = timelinePoints[index + 1];

      if (!currentNextPoint) {
        return count;
      }

      return getStorySegmentIndex(story, currentPoint, currentNextPoint) === storySegmentIndex ? count + 1 : count;
    }, 0) || 1;

  return `${storySegmentIndex + 1}.${subsegmentIndex}`;
}

function getTimelineGeometry(points: TimelinePoint[]) {
  const svgPoints = points.map(pointToSvg);

  if (svgPoints.length < 2) {
    return {
      angleById: new Map<string, number>(),
      continuousPath: "",
      segmentLocators: [] as { x: number; y: number }[],
      segmentPaths: [] as string[],
    };
  }

  const slopes = svgPoints.slice(0, -1).map((point, index) => {
    const nextPoint = svgPoints[index + 1];
    const distance = nextPoint.x - point.x;
    return distance > 0 ? (nextPoint.y - point.y) / distance : 0;
  });
  const tangents = svgPoints.map((_, index) => {
    if (index === 0) {
      return slopes[0] * CURVE_TANGENT_SCALE;
    }

    if (index === svgPoints.length - 1) {
      return slopes.at(-1)! * CURVE_TANGENT_SCALE;
    }

    const previous = slopes[index - 1];
    const next = slopes[index];

    if (previous === 0 || next === 0 || previous * next <= 0) {
      return 0;
    }

    return ((2 * previous * next) / (previous + next)) * CURVE_TANGENT_SCALE;
  });
  const commands: string[] = [];
  const segmentLocators: { x: number; y: number }[] = [];
  const segmentPaths = svgPoints.slice(0, -1).map((point, index) => {
    const nextPoint = svgPoints[index + 1];
    const distance = Math.max(nextPoint.x - point.x, 0);

    if (distance <= 0) {
      segmentLocators.push(point);
      return "";
    }

    const handleDistance = distance / 3;
    const controlA = {
      x: point.x + handleDistance,
      y: point.y + tangents[index] * handleDistance,
    };
    const controlB = {
      x: nextPoint.x - handleDistance,
      y: nextPoint.y - tangents[index + 1] * handleDistance,
    };
    const command = `C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${nextPoint.x} ${nextPoint.y}`;
    commands.push(command);
    segmentLocators.push(getCubicBezierPoint(point, controlA, controlB, nextPoint, 0.5));
    return `M ${point.x} ${point.y} ${command}`;
  });
  const angleById = new Map(
    points.map((point, index) => [point.id, (Math.atan(tangents[index]) * 180) / Math.PI] as const),
  );

  return {
    angleById,
    continuousPath: commands.length > 0 ? `M ${svgPoints[0].x} ${svgPoints[0].y} ${commands.join(" ")}` : "",
    segmentLocators,
    segmentPaths,
  };
}

function getCubicBezierPoint(
  from: { x: number; y: number },
  controlA: { x: number; y: number },
  controlB: { x: number; y: number },
  to: { x: number; y: number },
  ratio: number,
) {
  const inverse = 1 - ratio;

  return {
    x:
      inverse ** 3 * from.x +
      3 * inverse ** 2 * ratio * controlA.x +
      3 * inverse * ratio ** 2 * controlB.x +
      ratio ** 3 * to.x,
    y:
      inverse ** 3 * from.y +
      3 * inverse ** 2 * ratio * controlA.y +
      3 * inverse * ratio ** 2 * controlB.y +
      ratio ** 3 * to.y,
  };
}

function TimelineNodes({
  story,
  timelinePoints,
  emotionOn,
  selectedId,
  timelineGrowth,
  zoomX,
  onNodePointerDown,
}: Pick<
  TimelineCanvasProps,
  "story" | "timelinePoints" | "emotionOn" | "selectedId" | "timelineGrowth" | "zoomX" | "onNodePointerDown"
>) {
  const effectiveZoomX = zoomX * timelineGrowth;
  const visualDensity = getVisualDensity(story, effectiveZoomX);
  const logicMetaById = getLogicMetaById(story, effectiveZoomX);
  const { angleById } = getTimelineGeometry(timelinePoints);

  return (
    <div className="timeline-node-layer" aria-label="节点层">
      {timelinePoints.map((point) => {
        const selected = selectedId === point.id;
        if (!shouldRenderNode(point, selected, story.chapters.length, visualDensity, logicMetaById, zoomX)) {
          return null;
        }

        const logicMeta = point.kind === "logic" ? logicMetaById.get(point.id) : undefined;
        const nodeDensity = point.kind === "logic" ? (logicMeta?.density ?? 0) : visualDensity;
        const nodeText = getNodeText(point, nodeDensity);
        const densityClass = getNodeDensityClass(point, nodeDensity);
        const style = {
          ...pointToCssPosition(point),
          "--node-angle": `${angleById.get(point.id) ?? 0}deg`,
          "--node-size": `${getNodeSize(point, nodeDensity, selected)}px`,
        } as CSSProperties;

        return (
          <button
            aria-label={`${point.label} ${point.detail}`}
            aria-pressed={selected}
            className={`timeline-node ${point.kind} ${densityClass} ${getNodeTextClass(nodeText)}${selected ? " selected" : ""}${emotionOn && point.kind === "chapter" ? " emotion-draggable" : ""}`}
            key={point.id}
            onPointerDown={(event) => onNodePointerDown(point.id, event)}
            style={style}
            type="button"
          >
            {nodeText && <span className="timeline-node-text">{nodeText}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TimelineTicks({ totalChapters }: { totalChapters: number }) {
  const tickCount = Math.min(Math.max(totalChapters > 0 ? totalChapters + 2 : 24, 24), 120);
  const majorEvery = Math.max(Math.round((tickCount - 1) / 8), 1);
  const labels = getRulerLabels(totalChapters);

  return (
    <div className="timeline-ruler" aria-hidden="true">
      <div className="timeline-ruler-axis" />
      <div className="timeline-ruler-ticks">
      {Array.from({ length: tickCount }).map((_, index) => (
          <i className={index % majorEvery === 0 || index === tickCount - 1 ? "major" : ""} key={index} />
      ))}
      </div>
      {labels.map((label) => (
        <span className="timeline-ruler-label" key={label.text} style={{ left: `${label.percent}%` }}>
          {label.text}
        </span>
      ))}
    </div>
  );
}

function getRulerLabels(totalChapters: number) {
  if (totalChapters <= 0) {
    return [
      { percent: 0, text: "起点" },
      { percent: 50, text: "中段" },
      { percent: 100, text: "结尾" },
    ];
  }

  const chapterIndexes = Array.from(new Set([1, Math.max(1, Math.round(totalChapters / 2)), totalChapters]));

  return chapterIndexes.map((chapterIndex) => ({
    percent: getChapterX(chapterIndex - 1, totalChapters),
    text: String(chapterIndex),
  }));
}

function getVisualDensity(story: StoryState, zoomX: number) {
  return story.chapters.length / Math.max(zoomX ** 1.35, 0.8);
}

function getLogicMetaById(story: StoryState, zoomX: number) {
  const metaById = new Map<string, LogicRenderMeta>();
  const groups = new Map<number, typeof story.logicPoints>();

  story.logicPoints.forEach((logic) => {
    const group = groups.get(logic.segmentIndex) ?? [];
    group.push(logic);
    groups.set(logic.segmentIndex, group);
  });

  groups.forEach((items, segmentIndex) => {
    const left = segmentIndex === 0 ? 0 : getChapterX(segmentIndex - 1, story.chapters.length);
    const right =
      segmentIndex >= story.chapters.length ? 100 : getChapterX(segmentIndex, story.chapters.length);
    const segmentRatio = Math.max((right - left) / 100, 0.04);
    const density = items.length / Math.max(zoomX ** 1.2 * segmentRatio, 0.12);

    items.forEach((logic, index) => {
      metaById.set(logic.id, { density, index, total: items.length });
    });
  });

  return metaById;
}

function getNodeSize(point: TimelinePoint, density: number, selected: boolean) {
  if (point.kind === "start" || point.kind === "end") {
    return 30;
  }

  if (point.kind === "logic") {
    if (selected) {
      if (density > 140) {
        return 8.4;
      }

      if (density > 72) {
        return 9.2;
      }

      if (density > 34) {
        return 10;
      }

      return 10.8;
    }

    if (density > 140) {
      return 5.8;
    }

    if (density > 72) {
      return 6.6;
    }

    if (density > 34) {
      return 7.4;
    }

    return 8.4;
  }

  if (selected) {
    return 18;
  }

  if (density > 140) {
    return 7.6;
  }

  if (density > 72) {
    return 8.8;
  }

  if (density > 34) {
    return 10.6;
  }

  if (density > 20) {
    return 12.6;
  }

  return 15;
}

function getNodeRenderMode(density: number) {
  if (density > 140) {
    return "pin";
  }

  if (density > 34) {
    return "tick";
  }

  return "";
}

function getChapterRenderStep(density: number) {
  if (density <= 20) {
    return 1;
  }

  if (density <= 34) {
    return 4;
  }

  if (density <= 72) {
    return 10;
  }

  if (density <= 140) {
    return 20;
  }

  return Math.min(Math.ceil(density / 18) * 5, 80);
}

function getLogicRenderStep(density: number) {
  if (density <= 24) {
    return 1;
  }

  if (density <= 56) {
    return 4;
  }

  if (density <= 120) {
    return 8;
  }

  if (density <= 220) {
    return 16;
  }

  return Math.min(Math.ceil(density / 22) * 4, 48);
}

function shouldRenderNode(
  point: TimelinePoint,
  selected: boolean,
  totalChapters: number,
  chapterDensity: number,
  logicMetaById: Map<string, LogicRenderMeta>,
  zoomX: number,
) {
  if (point.kind === "start" || point.kind === "end") {
    return true;
  }

  if (point.kind === "logic") {
    if (zoomX < LOGIC_REVEAL_ZOOM_X) {
      return false;
    }

    const meta = logicMetaById.get(point.id);
    if (!meta) {
      return false;
    }

    const step = getLogicRenderStep(meta.density);
    if (step === 1) {
      return true;
    }

    if (meta.index === 0 || meta.index === meta.total - 1) {
      return false;
    }

    return (meta.index + Math.floor(step / 2)) % step === 0;
  }

  if (point.kind !== "chapter") {
    return selected;
  }

  if (!point.chapterIndex) {
    return false;
  }

  const step = getChapterRenderStep(chapterDensity);
  if (shouldHideEdgeChapter(point, totalChapters, step)) {
    return false;
  }

  return step === 1 || point.chapterIndex % step === 0;
}

function shouldHideEdgeChapter(point: TimelinePoint, totalChapters: number, renderStep: number) {
  if (point.kind !== "chapter" || !point.chapterIndex) {
    return false;
  }

  if (renderStep > 1 && (point.xPercent < 3.5 || point.xPercent > 96.5)) {
    return true;
  }

  if (totalChapters < 48) {
    return false;
  }

  return point.xPercent < 2.8 || point.xPercent > 97.2;
}

function getNodeText(point: TimelinePoint, density: number) {
  if (point.kind !== "chapter" || !point.chapterIndex || density > 72) {
    return "";
  }

  return String(point.chapterIndex);
}

function getNodeTextClass(text: string) {
  if (text.length >= 4) {
    return "digits-4";
  }

  if (text.length === 3) {
    return "digits-3";
  }

  if (text.length === 2) {
    return "digits-2";
  }

  return "";
}

function getNodeDensityClass(point: TimelinePoint, density: number) {
  if (point.kind !== "chapter" && point.kind !== "logic") {
    return "";
  }

  const renderMode = getNodeRenderMode(density);
  if (renderMode) {
    return ` ${renderMode}`;
  }

  if (density > 20) {
    return " compact";
  }

  return "";
}

function clampMinimapCenter(centerPercent: number, visiblePercent: number) {
  return Math.min(Math.max(centerPercent, visiblePercent / 2), 100 - visiblePercent / 2);
}

function clampSvgViewportX(viewportX: number, viewportWidth: number) {
  return Math.min(Math.max(viewportX, MINIMAP_LEFT), MINIMAP_RIGHT - viewportWidth);
}

function TimelineMinimap({
  canvasRef,
  detailed,
  panX,
  selectedId,
  story,
  timelinePoints,
  timelineGrowth,
  onPanXChange,
  zoomX,
}: {
  canvasRef: RefObject<HTMLElement | null>;
  detailed: boolean;
  panX: number;
  selectedId: string;
  story: StoryState;
  timelinePoints: TimelinePoint[];
  timelineGrowth: number;
  onPanXChange: (panX: number) => void;
  zoomX: number;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ grabOffsetSvg: number } | null>(null);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [markerAspect, setMarkerAspect] = useState(1);
  const overviewIndexes = getOverviewChapterIndexes(story.chapters.length);
  const miniPoints = timelinePoints.map((point) => ({
    ...point,
    miniX: MINIMAP_LEFT + (point.xPercent / 100) * MINIMAP_WIDTH,
    miniY: 36 - point.emotion * 2.8,
  }));
  const pathPoints = miniPoints
    .filter((point) => point.kind !== "logic")
    .map((point) => `${point.miniX},${point.miniY}`)
    .join(" ");
  const effectiveZoomX = zoomX * timelineGrowth;
  const canvasWidth = canvasRef.current?.getBoundingClientRect().width ?? 0;
  const contentWidth = Math.max(canvasWidth * TIMELINE_WIDTH_RATIO * effectiveZoomX, TIMELINE_MIN_WIDTH);
  const linePixelWidth = Math.max(contentWidth * TIMELINE_LINE_RATIO, 1);
  const visibleCanvasWidth = Math.max(canvasWidth - TIMELINE_VIEWPORT_EDGE_INSET * 2, canvasWidth * 0.5, 1);
  const visiblePercent =
    canvasWidth > 0
      ? Math.min(Math.max((visibleCanvasWidth / linePixelWidth) * 100, 12), 100)
      : Math.min(Math.max(100 / Math.max(effectiveZoomX, 1), 12), 54);
  const viewportCenter = clampMinimapCenter(50 - (panX / linePixelWidth) * 100, visiblePercent);
  const viewportX = MINIMAP_LEFT + ((viewportCenter - visiblePercent / 2) / 100) * MINIMAP_WIDTH;
  const viewportWidth = (visiblePercent / 100) * MINIMAP_WIDTH;
  const axisMidpoint = story.chapters.length > 0 ? Math.max(1, Math.round(story.chapters.length / 2)) : "中段";

  useEffect(() => {
    const trackElement = trackRef.current;
    if (!trackElement) {
      return;
    }
    const measureTarget = trackElement;

    function updateMarkerAspect() {
      const rect = measureTarget.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      setMarkerAspect(Math.min(Math.max((58 * 1000) / (rect.width * 82), 0.18), 1));
    }

    updateMarkerAspect();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateMarkerAspect);
      return () => window.removeEventListener("resize", updateMarkerAspect);
    }

    const observer = new ResizeObserver(updateMarkerAspect);
    observer.observe(measureTarget);
    return () => observer.disconnect();
  }, []);

  function centerPercentToPan(centerPercent: number) {
    return (50 - centerPercent) * (linePixelWidth / 100);
  }

  function clientXToSvgX(clientX: number) {
    const track = trackRef.current;
    if (!track) {
      return MINIMAP_LEFT;
    }

    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return MINIMAP_LEFT;
    }

    return ((clientX - rect.left) / rect.width) * 1000;
  }

  function handleViewportPointerDown(event: PointerEvent<SVGGElement>) {
    event.stopPropagation();
    const track = trackRef.current;
    if (!track) {
      return;
    }

    dragRef.current = {
      grabOffsetSvg: clientXToSvgX(event.clientX) - viewportX,
    };
    setIsDraggingWindow(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleViewportPointerMove(event: PointerEvent<SVGGElement>) {
    if (!dragRef.current) {
      return;
    }

    event.stopPropagation();
    const nextViewportX = clampSvgViewportX(clientXToSvgX(event.clientX) - dragRef.current.grabOffsetSvg, viewportWidth);
    const nextCenterPercent = ((nextViewportX + viewportWidth / 2 - MINIMAP_LEFT) / MINIMAP_WIDTH) * 100;
    onPanXChange(centerPercentToPan(nextCenterPercent));
  }

  function handleViewportPointerEnd(event: PointerEvent<SVGGElement>) {
    dragRef.current = null;
    setIsDraggingWindow(false);
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section
      className={`story-minimap${detailed ? " detailed" : ""}`}
      aria-label="全书缩略总览"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="minimap-copy">
        <strong>全书总览</strong>
        <span>共 {story.chapters.length} 章</span>
      </div>
      <div className="minimap-track" ref={trackRef}>
        <svg viewBox="0 0 1000 82" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="miniTrackFade" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(244, 91, 20, 0)" />
              <stop offset="10%" stopColor="rgba(244, 91, 20, 0.18)" />
              <stop offset="50%" stopColor="rgba(244, 91, 20, 0.36)" />
              <stop offset="90%" stopColor="rgba(244, 91, 20, 0.18)" />
              <stop offset="100%" stopColor="rgba(244, 91, 20, 0)" />
            </linearGradient>
            <linearGradient id="miniWindowFill" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 253, 249, 0.7)" />
              <stop offset="100%" stopColor="rgba(255, 246, 239, 0.34)" />
            </linearGradient>
          </defs>
          <rect className="mini-track-wash" height="46" rx="11" width={MINIMAP_WIDTH} x={MINIMAP_LEFT} y="14" />
          <line className="mini-baseline-bed" x1={MINIMAP_LEFT} x2={MINIMAP_RIGHT} y1="36" y2="36" />
          <line className="mini-baseline" x1={MINIMAP_LEFT} x2={MINIMAP_RIGHT} y1="36" y2="36" />
          <line className="mini-axis-line" x1={MINIMAP_LEFT} x2={MINIMAP_RIGHT} y1="64" y2="64" />
          <polyline className="mini-storyline-bed" points={pathPoints} />
          <polyline className="mini-storyline" points={pathPoints} />
          <polyline className="mini-storyline-highlight" points={pathPoints} />
          {overviewIndexes.map((index) => {
            const radius = detailed ? 2.4 : 1.8;

            return (
              <ellipse
                className="mini-chapter-dot"
                cx={MINIMAP_LEFT + (getChapterX(index, story.chapters.length) / 100) * MINIMAP_WIDTH}
                cy="36"
                key={index}
                rx={radius * markerAspect}
                ry={radius}
              />
            );
          })}
          {miniPoints
            .filter((point) => point.kind !== "start" && point.kind !== "end")
            .map((point) => {
              const radius = point.id === selectedId ? 3.8 : 2.5;

              return (
                <ellipse
                  className={`mini-point ${point.kind}${point.id === selectedId ? " selected" : ""}`}
                  cx={point.miniX}
                  cy={point.miniY}
                  key={point.id}
                  rx={radius * markerAspect}
                  ry={radius}
                />
              );
            })}
          <g
            className={`mini-window-grip${isDraggingWindow ? " dragging" : ""}`}
            onPointerCancel={handleViewportPointerEnd}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerEnd}
          >
            <rect className="mini-window-shadow" height="58" rx="12" width={viewportWidth} x={viewportX} y="7" />
            <rect className="mini-window-fill" height="54" rx="10" width={viewportWidth} x={viewportX} y="9" />
            <line className="mini-window-handle" x1={viewportX + 9} x2={viewportX + 9} y1="19" y2="53" />
            <line className="mini-window-handle light" x1={viewportX + 14} x2={viewportX + 14} y1="23" y2="49" />
            <line
              className="mini-window-handle"
              x1={viewportX + viewportWidth - 9}
              x2={viewportX + viewportWidth - 9}
              y1="19"
              y2="53"
            />
            <line
              className="mini-window-handle light"
              x1={viewportX + viewportWidth - 14}
              x2={viewportX + viewportWidth - 14}
              y1="23"
              y2="49"
            />
          </g>
          {miniPoints
            .filter((point) => point.kind === "start" || point.kind === "end")
            .map((point) => {
              const radius = 5.4;

              return (
                <ellipse
                  className={`mini-point ${point.kind} endpoint${point.id === selectedId ? " selected" : ""}`}
                  cx={point.miniX}
                  cy={point.miniY}
                  key={point.id}
                  rx={radius * markerAspect}
                  ry={radius}
                />
              );
            })}
        </svg>
        <div className="minimap-axis">
          <span>起点</span>
          {detailed && <span>{axisMidpoint}</span>}
          <span>结尾</span>
        </div>
      </div>
    </section>
  );
}

function getOverviewChapterIndexes(total: number) {
  if (total <= 120) {
    return Array.from({ length: total }, (_, index) => index);
  }

  const step = Math.ceil(total / 120);
  return Array.from({ length: Math.ceil(total / step) }, (_, index) => index * step).filter((index) => index < total);
}
