import { branchMeta } from "./storyDefaults";
import type { BranchColor, StoryState, TimelinePoint } from "../types/story";

export const TIMELINE_SVG_TOP = 50;
export const TIMELINE_BASELINE_Y = 140;
export const EMOTION_STEP_Y = 10.5;
export const CURVE_TANGENT_SCALE = 0.68;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getChapterX(index: number, total: number) {
  return ((index + 1) / (total + 1)) * 100;
}

function getSegmentBounds(segmentIndex: number, totalChapters: number) {
  return {
    left: segmentIndex === 0 ? 0 : getChapterX(segmentIndex - 1, totalChapters),
    right: segmentIndex >= totalChapters ? 100 : getChapterX(segmentIndex, totalChapters),
  };
}

function xPercentToSvgXValue(xPercent: number) {
  return 45 + xPercent * 9.1;
}

function emotionToSvgY(emotion: number) {
  return TIMELINE_BASELINE_Y - emotion * EMOTION_STEP_Y;
}

function svgYToEmotion(y: number) {
  return (TIMELINE_BASELINE_Y - y) / EMOTION_STEP_Y;
}

function getCurveTangents(points: Array<{ x: number; y: number }>) {
  const slopes = points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];
    const distance = nextPoint.x - point.x;
    return distance > 0 ? (nextPoint.y - point.y) / distance : 0;
  });

  return points.map((_, index) => {
    if (index === 0) {
      return (slopes[0] ?? 0) * CURVE_TANGENT_SCALE;
    }

    if (index === points.length - 1) {
      return (slopes.at(-1) ?? 0) * CURVE_TANGENT_SCALE;
    }

    const previous = slopes[index - 1];
    const next = slopes[index];

    if (previous === 0 || next === 0 || previous * next <= 0) {
      return 0;
    }

    return ((2 * previous * next) / (previous + next)) * CURVE_TANGENT_SCALE;
  });
}

function getCubicValue(from: number, controlA: number, controlB: number, to: number, ratio: number) {
  const inverse = 1 - ratio;

  return inverse ** 3 * from + 3 * inverse ** 2 * ratio * controlA + 3 * inverse * ratio ** 2 * controlB + ratio ** 3 * to;
}

function getCurveEmotionAtX(points: TimelinePoint[], xPercent: number) {
  const svgPoints = points.map((point) => ({
    x: xPercentToSvgXValue(point.xPercent),
    y: emotionToSvgY(point.emotion),
  }));

  if (svgPoints.length < 2) {
    return 0;
  }

  const targetX = xPercentToSvgXValue(xPercent);
  const tangents = getCurveTangents(svgPoints);
  const foundIndex = svgPoints.findIndex((point, index) => {
    const nextPoint = svgPoints[index + 1];
    return nextPoint ? targetX >= point.x && targetX <= nextPoint.x : false;
  });
  const segmentIndex = foundIndex >= 0 ? foundIndex : targetX < svgPoints[0].x ? 0 : svgPoints.length - 2;
  const point = svgPoints[segmentIndex];
  const nextPoint = svgPoints[segmentIndex + 1];
  const distance = Math.max(nextPoint.x - point.x, 1);
  const ratio = clamp((targetX - point.x) / distance, 0, 1);
  const handleDistance = distance / 3;
  const controlA = point.y + tangents[segmentIndex] * handleDistance;
  const controlB = nextPoint.y - tangents[segmentIndex + 1] * handleDistance;

  return svgYToEmotion(getCubicValue(point.y, controlA, controlB, nextPoint.y, ratio));
}

export function buildTimelinePoints(story: StoryState, emotionOn: boolean): TimelinePoint[] {
  const chapterPoints: TimelinePoint[] = story.chapters.map((chapter, index) => ({
    id: chapter.id,
    kind: "chapter",
    label: `第${index + 1}章`,
    detail: chapter.name,
    xPercent: getChapterX(index, story.chapters.length),
    emotion: emotionOn ? chapter.emotion : 0,
    chapterIndex: index + 1,
  }));
  const emotionCurvePoints = [
    { id: "start", kind: "start", label: "起点", detail: "故事开始", xPercent: 0, emotion: 0 } satisfies TimelinePoint,
    ...chapterPoints,
    { id: "end", kind: "end", label: "终尾", detail: "故事落点", xPercent: 100, emotion: 0 } satisfies TimelinePoint,
  ];

  const logicGroups = new Map<number, typeof story.logicPoints>();

  story.logicPoints.forEach((logic) => {
    const group = logicGroups.get(logic.segmentIndex) ?? [];
    group.push(logic);
    logicGroups.set(logic.segmentIndex, group);
  });

  const logicX = new Map<string, number>();

  logicGroups.forEach((items, segmentIndex) => {
    const { left, right } = getSegmentBounds(segmentIndex, story.chapters.length);
    const span = right - left;

    items.forEach((logic, index) => {
      logicX.set(logic.id, left + (span * (index + 1)) / (items.length + 1));
    });
  });

  const logicPoints: TimelinePoint[] = story.logicPoints.map((logic) => {
    const xPercent = logicX.get(logic.id) ?? 50;

    return {
      id: logic.id,
      kind: "logic",
      label: "逻辑点",
      detail: logic.title,
      xPercent,
      emotion: emotionOn ? getCurveEmotionAtX(emotionCurvePoints, xPercent) : 0,
    };
  });

  return [
    { id: "start", kind: "start", label: "起点", detail: "故事开始", xPercent: 0, emotion: 0 } satisfies TimelinePoint,
    ...chapterPoints,
    ...logicPoints,
    { id: "end", kind: "end", label: "结尾", detail: "故事落点", xPercent: 100, emotion: 0 } satisfies TimelinePoint,
  ].sort((a, b) => a.xPercent - b.xPercent);
}

export function pointToSvg(point: TimelinePoint) {
  return {
    x: xPercentToSvgXValue(point.xPercent),
    y: emotionToSvgY(point.emotion),
  };
}

export function xPercentToCssLeft(xPercent: number) {
  return ((45 + xPercent * 9.1) / 1000) * 100;
}

export function pointToCssPosition(point: TimelinePoint) {
  const svgPoint = pointToSvg(point);

  return {
    left: `${xPercentToCssLeft(point.xPercent)}%`,
    top: `${50 + svgPoint.y}px`,
  };
}

export function getSegmentColor(story: StoryState, from: TimelinePoint, to: TimelinePoint): BranchColor | "orange" {
  const total = story.chapters.length;
  if (total === 0) {
    return "orange";
  }

  const midpoint = (from.xPercent + to.xPercent) / 2;
  const activeBranch = story.branches.find((branch) => {
    const left = getChapterX(Math.max(branch.startChapter - 1, 0), total);
    const right = getChapterX(Math.min(branch.endChapter - 1, total - 1), total);
    return midpoint >= left && midpoint <= right;
  });

  return activeBranch?.color ?? "orange";
}

export function getBranchLabel(type: keyof typeof branchMeta) {
  return branchMeta[type].label;
}
