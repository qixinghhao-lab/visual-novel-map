import { Suspense, lazy, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { CanvasControls } from "./components/CanvasControls";
import { CharacterWorkbench } from "./components/CharacterWorkbench";
import { InfoPanel } from "./components/InfoPanel";
import { LeftRail } from "./components/LeftRail";
import { OutlineWorkbench } from "./components/OutlineWorkbench";
import { PromptWorkbench } from "./components/PromptWorkbench";
import { SettingWorkbench } from "./components/SettingWorkbench";
import { TimelineCanvas } from "./components/TimelineCanvas";
import { TopBar } from "./components/TopBar";
import { WritingWorkbench } from "./components/WritingWorkbench";
import { leftNavigationFeatures, type FeatureDefinition, type FeatureId } from "./features/leftNavigation";
import { useStoryEditor } from "./hooks/useStoryEditor";
import {
  buildTimelinePoints,
  clamp,
  EMOTION_STEP_Y,
  TIMELINE_BASELINE_Y,
  TIMELINE_SVG_TOP,
} from "./domain/timeline";
import type { InfoTab, SelectionDetailContext, StoryState, TimelinePoint, TimelineSegmentSelection, Tool } from "./types/story";

const WorldWorkbench = lazy(() => import("./components/WorldWorkbench").then((module) => ({ default: module.WorldWorkbench })));

const MIN_EMOTION = -5;
const MAX_EMOTION = 5;
const EMOTION_SNAP_RESISTANCE = 0.68;

function getResistantEmotionLevel(rawLevel: number, currentLevel: number) {
  let nextLevel = currentLevel;

  while (rawLevel > nextLevel + EMOTION_SNAP_RESISTANCE && nextLevel < MAX_EMOTION) {
    nextLevel += 1;
  }

  while (rawLevel < nextLevel - EMOTION_SNAP_RESISTANCE && nextLevel > MIN_EMOTION) {
    nextLevel -= 1;
  }

  return clamp(nextLevel, MIN_EMOTION, MAX_EMOTION);
}

function getWheelZoomSensitivity(zoom: number) {
  if (zoom >= 40) {
    return 0.00018;
  }

  if (zoom >= 12) {
    return 0.00028;
  }

  if (zoom >= 4) {
    return 0.00038;
  }

  return 0.00055;
}

function getButtonZoomRatio(zoom: number) {
  if (zoom >= 40) {
    return 1.018;
  }

  if (zoom >= 12) {
    return 1.028;
  }

  if (zoom >= 4) {
    return 1.045;
  }

  if (zoom >= 2) {
    return 1.065;
  }

  return 1.09;
}

function getPointDisplayName(point?: TimelinePoint) {
  if (!point) {
    return "未知节点";
  }

  if (point.kind === "chapter" && point.chapterIndex) {
    return `第 ${point.chapterIndex} 章`;
  }

  if (point.kind === "logic") {
    return "逻辑点";
  }

  return point.label;
}

function getSelectionDetailContext(
  story: StoryState,
  timelinePoints: TimelinePoint[],
  selectedId: string,
  selectedPathSegment: TimelineSegmentSelection | null,
): SelectionDetailContext | undefined {
  if (selectedPathSegment) {
    const from = timelinePoints.find((point) => point.id === selectedPathSegment.fromId);
    const to = timelinePoints.find((point) => point.id === selectedPathSegment.toId);

    return {
      kind: "segment",
      badge: "区间资料",
      title: `第 ${selectedPathSegment.chapterSegmentIndex + 1} 段主线区间`,
      subtitle: `${getPointDisplayName(from)} → ${getPointDisplayName(to)}`,
      meta: [
        { label: "起点", value: getPointDisplayName(from) },
        { label: "终点", value: getPointDisplayName(to) },
        { label: "状态", value: "接口预留" },
      ],
    };
  }

  const chapterIndex = story.chapters.findIndex((chapter) => chapter.id === selectedId);
  if (chapterIndex >= 0) {
    const chapter = story.chapters[chapterIndex];

    return {
      kind: "chapter",
      badge: "章节资料",
      title: `第 ${chapterIndex + 1} 章`,
      subtitle: chapter.name,
      meta: [
        { label: "章节序号", value: String(chapterIndex + 1) },
        { label: "情绪层", value: String(chapter.emotion) },
        { label: "状态", value: "接口预留" },
      ],
    };
  }

  const logicPoint = story.logicPoints.find((logic) => logic.id === selectedId);
  if (logicPoint) {
    return {
      kind: "logic",
      badge: "逻辑点资料",
      title: logicPoint.title,
      subtitle: `第 ${logicPoint.segmentIndex + 1} 段主线内`,
      meta: [
        { label: "所在区间", value: String(logicPoint.segmentIndex + 1) },
        { label: "情绪层", value: String(logicPoint.emotion) },
        { label: "状态", value: "接口预留" },
      ],
    };
  }

  return undefined;
}

function App() {
  const editor = useStoryEditor();
  const [activeFeature, setActiveFeature] = useState<FeatureId>("storyline");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTab, setInfoTab] = useState<InfoTab>("summary");
  const [displayOpen, setDisplayOpen] = useState(false);
  const [emotionOn, setEmotionOn] = useState(false);
  const [showOverview, setShowOverview] = useState(true);
  const [showTicks, setShowTicks] = useState(true);
  const [nodePopoverOpen, setNodePopoverOpen] = useState(false);
  const [segmentPopoverOpen, setSegmentPopoverOpen] = useState(false);
  const canvasRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ startX: number; startPanX: number } | null>(null);
  const nodeDragRef = useRef<{ id: string; level: number } | null>(null);

  const timelinePoints = useMemo(() => buildTimelinePoints(editor.story, emotionOn), [editor.story, emotionOn]);
  const selectionDetailContext = useMemo(
    () => getSelectionDetailContext(editor.story, timelinePoints, editor.selectedId, editor.selectedPathSegment),
    [editor.selectedId, editor.selectedPathSegment, editor.story, timelinePoints],
  );
  const selectedBranch = editor.story.branches.find((branch) => branch.id === editor.selectedId) ?? editor.story.branches.at(-1);
  const nodeInfoActions = {
    onUpdateLogicPointContent: editor.updateLogicPointContent,
    onPolishLogicPointContent: editor.polishLogicPointContent,
    onConfirmLogicPointContent: editor.confirmLogicPointContent,
    onNavigateLogicPointContent: editor.navigateLogicPointContent,
    onUpdateChapterNodeContent: editor.updateChapterNodeContent,
    onPolishChapterNodeContent: editor.polishChapterNodeContent,
    onConfirmChapterNodeContent: editor.confirmChapterNodeContent,
    onNavigateChapterNodeContent: editor.navigateChapterNodeContent,
  };
  const segmentInfoActions = {
    onUpdateSegmentContent: editor.updateSegmentContent,
    onGenerateSegmentContent: editor.generateSegmentContent,
    onConfirmSegmentContent: editor.confirmSegmentContent,
    onNavigateSegmentContent: editor.navigateSegmentContent,
  };

  function selectFeature(feature: FeatureDefinition) {
    setActiveFeature(feature.id);
    editor.setStatus(feature.status === "ready" ? feature.description : `${feature.label}功能已预留接口，后续实现`);
  }

  function addChapter() {
    if (editor.addChapter()) {
      setNodePopoverOpen(true);
      setSegmentPopoverOpen(false);
    }
  }

  function addLogicPoint() {
    if (editor.addLogicPoint()) {
      setNodePopoverOpen(true);
      setSegmentPopoverOpen(false);
    }
  }

  function addBranch() {
    if (editor.addBranch("medium")) {
      setNodePopoverOpen(false);
      setSegmentPopoverOpen(false);
      setInfoTab("branch");
    }
  }

  function toggleTicks() {
    const nextValue = !showTicks;
    setShowTicks(nextValue);
    setDisplayOpen(false);
    editor.setStatus(nextValue ? "辅助刻度已开启" : "辅助刻度已关闭");
  }

  function toggleOverview() {
    const nextValue = !showOverview;
    setShowOverview(nextValue);
    setDisplayOpen(false);
    editor.setStatus(nextValue ? "全书总览已开启" : "全书总览已关闭");
  }

  function resetCanvasView() {
    setDisplayOpen(false);
    editor.resetView();
  }

  function handleToolClick(tool: Tool) {
    editor.setTool(tool);

    if (tool === "chapter") {
      addChapter();
      return;
    }

    if (tool === "logic") {
      addLogicPoint();
      return;
    }

    if (tool === "branch") {
      addBranch();
      return;
    }

    if (tool === "text") {
      editor.addTextNote();
      return;
    }

    if (tool === "frame") {
      resetCanvasView();
      return;
    }

    editor.setStatus(tool === "pan" ? "拖动画布可横向移动" : "点击节点可选中");
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorX = event.clientX - rect.left - rect.width / 2;
    const sensitivity = getWheelZoomSensitivity(editor.zoomX);
    editor.zoomByAt(Math.exp(-event.deltaY * sensitivity), anchorX, rect.width);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button === 0) {
      setNodePopoverOpen(false);
      setSegmentPopoverOpen(false);
      setDisplayOpen(false);
    }

    if (event.button !== 0 || editor.tool === "select" || nodeDragRef.current) {
      return;
    }

    dragRef.current = {
      startX: event.clientX,
      startPanX: editor.panX,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (nodeDragRef.current && emotionOn && canvasRef.current) {
      const timelineContent = canvasRef.current.querySelector<HTMLElement>(".timeline-content");
      if (!timelineContent) {
        return;
      }

      const baselineY = timelineContent.getBoundingClientRect().top + TIMELINE_SVG_TOP + TIMELINE_BASELINE_Y;
      const rawLevel = (baselineY - event.clientY) / EMOTION_STEP_Y;
      const level = getResistantEmotionLevel(rawLevel, nodeDragRef.current.level);

      if (level !== nodeDragRef.current.level) {
        nodeDragRef.current.level = level;
        editor.updateNodeEmotion(nodeDragRef.current.id, level);
      }

      return;
    }

    if (dragRef.current) {
      editor.setPanX(dragRef.current.startPanX + event.clientX - dragRef.current.startX);
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    dragRef.current = null;
    nodeDragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleSegmentPointerDown(selection: TimelineSegmentSelection, event: PointerEvent<SVGPathElement>) {
    event.stopPropagation();
    setNodePopoverOpen(false);
    setSegmentPopoverOpen(true);
    editor.setSelectedSegmentIndex(selection.chapterSegmentIndex);
    editor.setSelectedPathSegment(selection);
    editor.setSelectedId(`segment-${selection.fromId}-${selection.toId}`);
    editor.setStatus("已选中主线区间，可添加逻辑点");
    setInfoTab("main");
  }

  function handleBranchPointerDown(id: string, event: PointerEvent<SVGPathElement>) {
    event.stopPropagation();
    setNodePopoverOpen(false);
    setSegmentPopoverOpen(false);
    editor.setSelectedId(id);
    editor.setSelectedSegmentIndex(null);
    editor.setSelectedPathSegment(null);
    editor.setStatus("已选中支线，可在右侧支线栏编辑");
    setInfoTab("branch");
  }

  function handleNodePointerDown(id: string, event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const logicPoint = editor.story.logicPoints.find((item) => item.id === id);
    const point = timelinePoints.find((item) => item.id === id);
    editor.setSelectedId(id);
    editor.setSelectedSegmentIndex(logicPoint?.segmentIndex ?? null);
    editor.setSelectedPathSegment(null);
    setSegmentPopoverOpen(false);
    setNodePopoverOpen(point?.kind === "chapter" || point?.kind === "logic");

    if (emotionOn && point?.kind === "chapter") {
      nodeDragRef.current = { id, level: point?.emotion ?? 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
      editor.setStatus("纵向拖动节点可吸附到情绪线");
      return;
    }

    editor.setStatus("已选中节点");
  }

  return (
    <div className="app-shell">
      <LeftRail features={leftNavigationFeatures} activeFeature={activeFeature} onSelectFeature={selectFeature} />
      <main className="workspace">
        <TopBar
          status={editor.status}
          tool={editor.tool}
          onToolClick={handleToolClick}
          onAiAssist={() => editor.setStatus("AI 分析入口已预留，后续接入当前结构、节点和正文上下文")}
          onUndo={editor.undo}
          onRedo={editor.redo}
          onResetView={resetCanvasView}
        />

        <section
          className={`board${
            activeFeature === "prompts"
              ? " prompt-board"
              : activeFeature === "outline"
                ? " outline-board"
                : activeFeature === "characters"
                  ? " character-board"
                  : activeFeature === "settings"
                    ? " setting-board"
                    : activeFeature === "world"
                      ? " world-board"
                      : activeFeature === "writing"
                        ? " writing-board"
                        : " initial-board"
          }`}
        >
          {activeFeature === "prompts" ? (
            <PromptWorkbench
              prompts={editor.story.prompts}
              onUpdatePromptTemplate={editor.updatePromptTemplate}
              onRestorePromptTemplate={editor.restorePromptTemplate}
              onDuplicatePromptTemplate={editor.duplicatePromptTemplate}
              onSavePromptTemplate={editor.savePromptTemplate}
              onStatus={editor.setStatus}
            />
          ) : activeFeature === "outline" ? (
            <OutlineWorkbench
              outline={editor.story.outline}
              onSetView={editor.setOutlineView}
              onSelectChapter={editor.selectOutlineChapter}
              onUpdateChapter={editor.updateOutlineChapter}
              onAddChapter={editor.addOutlineChapter}
              onAddVolume={editor.addOutlineVolume}
              onStatus={editor.setStatus}
            />
          ) : activeFeature === "characters" ? (
            <CharacterWorkbench
              characters={editor.story.characters}
              onSetView={editor.setCharacterView}
              onSelectCharacter={editor.selectCharacter}
              onUpdateCharacter={editor.updateCharacter}
              onAddCharacter={editor.addCharacter}
              onStatus={editor.setStatus}
            />
          ) : activeFeature === "settings" ? (
            <SettingWorkbench
              settings={editor.story.settings}
              onSetView={editor.setSettingView}
              onSelectSetting={editor.selectSetting}
              onUpdateSetting={editor.updateSetting}
              onAddSetting={editor.addSetting}
              onStatus={editor.setStatus}
            />
          ) : activeFeature === "world" ? (
            <Suspense
              fallback={
                <section className="world-workbench empty">
                  <div className="world-empty">
                    <span>◎</span>
                    <strong>世界观加载中</strong>
                    <p>正在准备 3D 星球沙盘。</p>
                  </div>
                </section>
              }
            >
              <WorldWorkbench
                world={editor.story.world}
                onSetLayer={editor.setWorldLayer}
                onSelectEntry={editor.selectWorldEntry}
                onUpdateEntry={editor.updateWorldEntry}
                onStatus={editor.setStatus}
              />
            </Suspense>
          ) : activeFeature === "writing" ? (
            <WritingWorkbench
              story={editor.story}
              onUpdateWritingSegmentContent={editor.updateWritingSegmentContent}
              onGenerateWritingSegmentContent={editor.generateWritingSegmentContent}
              onConfirmWritingSegmentContent={editor.confirmWritingSegmentContent}
              onStatus={editor.setStatus}
            />
          ) : (
            <>
          <div className="canvas-area">
            <CanvasControls
              displayOpen={displayOpen}
              emotionOn={emotionOn}
              showOverview={showOverview}
              showTicks={showTicks}
              windowLabel={editor.windowLabel}
              onToggleDisplay={() => setDisplayOpen((value) => !value)}
              onToggleEmotion={() => setEmotionOn((value) => !value)}
              onToggleOverview={toggleOverview}
              onToggleTicks={toggleTicks}
              onMoveWindow={(delta) => editor.setPanX(editor.panX + delta)}
              onResetView={resetCanvasView}
            />

            <TimelineCanvas
              story={editor.story}
              timelinePoints={timelinePoints}
              timelineStyle={editor.timelineStyle}
              timelineGrowth={editor.timelineGrowth}
              emotionOn={emotionOn}
              showOverview={showOverview}
              showTicks={showTicks}
              nodePopoverOpen={nodePopoverOpen}
              segmentPopoverOpen={segmentPopoverOpen}
              selectedId={editor.selectedId}
              selectedPathSegment={editor.selectedPathSegment}
              zoomX={editor.zoomX}
              panX={editor.panX}
              zoomLabel={editor.zoomLabel}
              canvasRef={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerEnd={handlePointerEnd}
              onWheel={handleWheel}
              onNodePointerDown={handleNodePointerDown}
              onSegmentPointerDown={handleSegmentPointerDown}
              onBranchPointerDown={handleBranchPointerDown}
              nodeInfoActions={nodeInfoActions}
              segmentInfoActions={segmentInfoActions}
              onPanXChange={editor.setPanX}
              onZoomIn={() => editor.zoomBy(getButtonZoomRatio(editor.zoomX))}
              onZoomOut={() => editor.zoomBy(1 / getButtonZoomRatio(editor.zoomX))}
              onResetView={resetCanvasView}
            />
          </div>

          <InfoPanel
            open={infoOpen}
            tab={infoTab}
            story={editor.story}
            selectionDetailContext={selectionDetailContext}
            selectedBranch={selectedBranch}
            onOpen={() => setInfoOpen(true)}
            onClose={() => setInfoOpen(false)}
            onTabChange={setInfoTab}
            onAddChapter={addChapter}
            onAddBranch={addBranch}
            onSaveMainLine={editor.updateMainLine}
            onSaveBranch={editor.updateBranch}
            onDuplicateBranch={editor.duplicateBranch}
            onDeleteBranch={editor.deleteBranch}
          />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
