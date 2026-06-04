import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WorldEntry, WorldLayer, WorldState } from "../types/story";

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

type WorldWorkbenchProps = {
  world: WorldState;
  onSetLayer: (layer: WorldLayer) => void;
  onSelectEntry: (id: string) => void;
  onUpdateEntry: (id: string, patch: WorldEntryPatch) => void;
  onStatus: (message: string) => void;
};

const layerMeta: Record<WorldLayer, { label: string; className: string }> = {
  terrain: { label: "地貌", className: "terrain" },
  factions: { label: "势力", className: "factions" },
  routes: { label: "路线", className: "routes" },
};

const kindMeta: Record<WorldEntry["kind"], { label: string; icon: string; color: string }> = {
  region: { label: "地区", icon: "域", color: "#f45b14" },
  faction: { label: "势力", icon: "势", color: "#76a56d" },
  rule: { label: "规则", icon: "规", color: "#9b82d8" },
  landmark: { label: "地标", icon: "标", color: "#5799cd" },
};

function groupWorldEntries(entries: WorldEntry[]) {
  return {
    region: entries.filter((entry) => entry.kind === "region"),
    faction: entries.filter((entry) => entry.kind === "faction"),
    rule: entries.filter((entry) => entry.kind === "rule"),
    landmark: entries.filter((entry) => entry.kind === "landmark"),
  };
}

function getEntryColor(entry: WorldEntry, activeLayer: WorldLayer, selected: boolean) {
  if (selected) {
    return "#f45b14";
  }

  if (entry.layer !== activeLayer) {
    return "#cfc4b7";
  }

  return kindMeta[entry.kind].color;
}

function latLngToVector3(latitude: number, longitude: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createWorldTexture(activeLayer: WorldLayer) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 1024;
  textureCanvas.height = 512;
  const context = textureCanvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(textureCanvas);
  }

  context.fillStyle = "#f4ece2";
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

  context.strokeStyle = "rgba(120, 103, 82, 0.12)";
  context.lineWidth = 1;
  for (let x = 64; x < textureCanvas.width; x += 96) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, textureCanvas.height);
    context.stroke();
  }
  for (let y = 64; y < textureCanvas.height; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(textureCanvas.width, y);
    context.stroke();
  }

  const landColor = activeLayer === "terrain" ? "#d8b693" : "#ded0bf";
  const secondaryLand = activeLayer === "factions" ? "#b6c8a7" : "#c8bea9";
  const routeColor = activeLayer === "routes" ? "#f45b14" : "rgba(244, 91, 20, 0.28)";

  const drawLand = (points: Array<[number, number]>, fill: string) => {
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) {
        context.moveTo(x, y);
        return;
      }
      context.lineTo(x, y);
    });
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = "rgba(108, 88, 68, 0.16)";
    context.stroke();
  };

  drawLand(
    [
      [106, 164],
      [168, 84],
      [276, 112],
      [318, 208],
      [244, 292],
      [136, 270],
    ],
    landColor,
  );
  drawLand(
    [
      [452, 86],
      [584, 112],
      [638, 232],
      [548, 322],
      [424, 286],
      [392, 172],
    ],
    secondaryLand,
  );
  drawLand(
    [
      [728, 184],
      [846, 124],
      [936, 204],
      [896, 334],
      [762, 352],
      [684, 268],
    ],
    landColor,
  );

  context.save();
  context.strokeStyle = routeColor;
  context.lineWidth = activeLayer === "routes" ? 4 : 2;
  context.setLineDash([16, 12]);
  context.beginPath();
  context.moveTo(178, 222);
  context.bezierCurveTo(330, 150, 468, 360, 622, 232);
  context.bezierCurveTo(714, 154, 808, 242, 902, 196);
  context.stroke();
  context.restore();

  context.fillStyle = "rgba(255, 253, 249, 0.7)";
  context.fillRect(0, 0, textureCanvas.width, 42);
  context.fillStyle = "rgba(244, 91, 20, 0.72)";
  context.fillRect(0, 42, textureCanvas.width, 2);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createArcMesh(from: THREE.Vector3, to: THREE.Vector3, color: string) {
  const middle = from.clone().add(to).normalize().multiplyScalar(2.86);
  const curve = new THREE.CatmullRomCurve3([from, middle, to]);
  const geometry = new THREE.TubeGeometry(curve, 48, 0.012, 8, false);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68 });
  return new THREE.Mesh(geometry, material);
}

function WorldGlobe({
  entries,
  selectedEntryId,
  activeLayer,
  onSelectEntry,
}: {
  entries: WorldEntry[];
  selectedEntryId: string;
  activeLayer: WorldLayer;
  onSelectEntry: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) {
      return undefined;
    }
    const stageElement = parent;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 7);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 5.2;
    controls.maxDistance = 8.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 1.45));
    const keyLight = new THREE.DirectionalLight(0xfff1df, 2.1);
    keyLight.position.set(4, 4, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xf45b14, 0.86);
    rimLight.position.set(-5, -1, 2);
    scene.add(rimLight);

    const globeTexture = createWorldTexture(activeLayer);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.18, 96, 64),
      new THREE.MeshStandardMaterial({
        map: globeTexture,
        color: "#fff7ee",
        roughness: 0.82,
        metalness: 0.02,
      }),
    );
    globeGroup.add(sphere);

    const grid = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(2.205, 32, 18)),
      new THREE.LineBasicMaterial({
        color: "#f45b14",
        transparent: true,
        opacity: activeLayer === "terrain" ? 0.12 : 0.08,
      }),
    );
    globeGroup.add(grid);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.34, 96, 64),
      new THREE.MeshBasicMaterial({
        color: "#fff1e8",
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
      }),
    );
    globeGroup.add(atmosphere);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#f45b14",
      transparent: true,
      opacity: 0.24,
    });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.68, 0.008, 12, 180), ringMaterial);
    ringA.rotation.x = THREE.MathUtils.degToRad(74);
    ringA.rotation.y = THREE.MathUtils.degToRad(8);
    globeGroup.add(ringA);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.74, 0.006, 12, 180), ringMaterial.clone());
    ringB.rotation.x = THREE.MathUtils.degToRad(96);
    ringB.rotation.z = THREE.MathUtils.degToRad(22);
    globeGroup.add(ringB);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const markerObjects: THREE.Mesh[] = [];

    entries.forEach((entry) => {
      const selected = entry.id === selectedEntryId;
      const color = getEntryColor(entry, activeLayer, selected);
      const surface = latLngToVector3(entry.latitude, entry.longitude, 2.2);
      const pinTop = latLngToVector3(entry.latitude, entry.longitude, selected ? 2.5 : 2.42);
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(selected ? 0.085 : 0.06, 24, 16),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: entry.layer === activeLayer || selected ? 1 : 0.42,
        }),
      );
      pin.position.copy(pinTop);
      pin.userData.entryId = entry.id;
      globeGroup.add(pin);
      markerObjects.push(pin);

      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([surface, pinTop]),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: entry.layer === activeLayer || selected ? 0.66 : 0.22,
        }),
      );
      globeGroup.add(stem);
    });

    if (activeLayer === "routes") {
      const origin = entries[0];
      const routeEntries = entries.filter((entry) => entry.layer === "routes");
      if (origin) {
        routeEntries.forEach((entry) => {
          const arc = createArcMesh(
            latLngToVector3(origin.latitude, origin.longitude, 2.24),
            latLngToVector3(entry.latitude, entry.longitude, 2.24),
            entry.id === selectedEntryId ? "#f45b14" : "#5799cd",
          );
          globeGroup.add(arc);
        });
      }
    }

    function resize() {
      const width = Math.max(stageElement.clientWidth, 320);
      const height = Math.max(stageElement.clientHeight, 320);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stageElement);
    resize();

    function handlePointerUp(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(markerObjects, false)[0];
      const entryId = hit?.object.userData.entryId;
      if (typeof entryId === "string") {
        onSelectEntry(entryId);
      }
    }

    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    let frameId = 0;
    const clock = new THREE.Clock();
    function animate() {
      const elapsed = clock.getElapsedTime();
      ringA.rotation.z = elapsed * 0.08;
      ringB.rotation.y = elapsed * -0.05;
      markerObjects.forEach((marker, index) => {
        const selected = marker.userData.entryId === selectedEntryId;
        const scale = selected ? 1 + Math.sin(elapsed * 3.2) * 0.12 : 1 + Math.sin(elapsed * 1.7 + index) * 0.04;
        marker.scale.setScalar(scale);
      });
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("map" in material && material.map) {
              material.map.dispose();
            }
            material.dispose();
          });
        }
      });
      renderer.dispose();
    };
  }, [activeLayer, entries, onSelectEntry, selectedEntryId]);

  return <canvas ref={canvasRef} className="world-globe-canvas" aria-label="世界观星球沙盘" />;
}

export function WorldWorkbench({ world, onSetLayer, onSelectEntry, onUpdateEntry, onStatus }: WorldWorkbenchProps) {
  const grouped = useMemo(() => groupWorldEntries(world.entries), [world.entries]);
  const selected = world.entries.find((entry) => entry.id === world.selectedEntryId) ?? world.entries[0];
  const activeLayerCount = world.entries.filter((entry) => entry.layer === world.activeLayer).length;
  const highRiskCount = world.entries.filter((entry) => entry.risk >= 40).length;

  if (!selected) {
    return (
      <section className="world-workbench empty">
        <div className="world-empty">
          <span>◎</span>
          <strong>还没有世界观条目</strong>
          <p>先建立地区、势力、规则和地标，后续再接入正文生成与一致性检查。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="world-workbench">
      <header className="world-header">
        <div className="world-header-copy">
          <span className="world-eyebrow">世界观工作台</span>
          <h1>世界观星球沙盘</h1>
          <p>把地理、势力、规则和关键地标放到同一个可旋转世界中，作为章节规划和正文生成的空间上下文。</p>
        </div>
        <div className="world-header-side">
          <div className="world-layer-tabs" role="tablist" aria-label="世界观图层">
            {(Object.keys(layerMeta) as WorldLayer[]).map((layer) => (
              <button
                aria-selected={world.activeLayer === layer}
                className={world.activeLayer === layer ? `active ${layerMeta[layer].className}` : ""}
                key={layer}
                onClick={() => onSetLayer(layer)}
                role="tab"
                type="button"
              >
                {layerMeta[layer].label}
              </button>
            ))}
          </div>
          <div className="world-stats">
            <span>
              <strong>{world.entries.length}</strong>
              条目
            </span>
            <span>
              <strong>{activeLayerCount}</strong>
              当前层
            </span>
            <span>
              <strong>{highRiskCount}</strong>
              高风险
            </span>
          </div>
        </div>
      </header>

      <div className="world-layout">
        <aside className="world-index-panel">
          <div className="world-panel-head">
            <span>世界索引</span>
            <button type="button" onClick={() => onStatus("新增世界观条目接口已预留")}>
              + 标注
            </button>
          </div>
          <div className="world-index-list">
            {(["region", "faction", "rule", "landmark"] as const).map((kind) => (
              <section className="world-index-group" key={kind}>
                <div className="world-index-title">
                  <strong>{kindMeta[kind].label}</strong>
                  <small>{grouped[kind].length}</small>
                </div>
                {grouped[kind].map((entry) => (
                  <button
                    className={entry.id === selected.id ? "active" : ""}
                    key={entry.id}
                    onClick={() => onSelectEntry(entry.id)}
                    type="button"
                  >
                    <i style={{ "--entry-color": kindMeta[entry.kind].color } as CSSProperties}>{kindMeta[entry.kind].icon}</i>
                    <span>
                      <strong>{entry.name}</strong>
                      <small>{layerMeta[entry.layer].label} / {entry.linkedChapters}</small>
                    </span>
                    <em>{entry.risk}%</em>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </aside>

        <section className="world-stage">
          <div className="world-stage-top">
            <div>
              <span>{layerMeta[world.activeLayer].label}图层</span>
              <strong>{selected.name}</strong>
            </div>
            <div className="world-mini-coordinates">
              <span>纬度 {selected.latitude}</span>
              <span>经度 {selected.longitude}</span>
            </div>
          </div>

          <div className="world-globe-shell">
            <WorldGlobe
              entries={world.entries}
              selectedEntryId={selected.id}
              activeLayer={world.activeLayer}
              onSelectEntry={onSelectEntry}
            />
            <div className="world-orbit-hud">
              <span>{kindMeta[selected.kind].label}</span>
              <strong>{selected.name}</strong>
              <p>{selected.summary}</p>
            </div>
          </div>

          <div className="world-stage-bottom">
            {selected.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>

        <aside className="world-detail-panel">
          <div className="world-panel-head">
            <span>条目资料</span>
            <button type="button" onClick={() => onStatus("世界观 AI 补全接口已预留")}>
              AI 补全
            </button>
          </div>

          <div className="world-detail-scroll">
            <div className="world-entry-card">
              <span>{kindMeta[selected.kind].label}</span>
              <h2>{selected.name}</h2>
              <p>{selected.summary}</p>
            </div>

            <div className="world-form-grid">
              <label>
                名称
                <input value={selected.name} onChange={(event) => onUpdateEntry(selected.id, { name: event.target.value })} />
              </label>
              <label>
                类型
                <select
                  value={selected.kind}
                  onChange={(event) => onUpdateEntry(selected.id, { kind: event.target.value as WorldEntry["kind"] })}
                >
                  <option value="region">地区</option>
                  <option value="faction">势力</option>
                  <option value="rule">规则</option>
                  <option value="landmark">地标</option>
                </select>
              </label>
              <label>
                纬度
                <input
                  max={85}
                  min={-85}
                  type="number"
                  value={selected.latitude}
                  onChange={(event) => onUpdateEntry(selected.id, { latitude: Number(event.target.value) })}
                />
              </label>
              <label>
                经度
                <input
                  max={180}
                  min={-180}
                  type="number"
                  value={selected.longitude}
                  onChange={(event) => onUpdateEntry(selected.id, { longitude: Number(event.target.value) })}
                />
              </label>
              <label className="wide">
                概要
                <textarea value={selected.summary} onChange={(event) => onUpdateEntry(selected.id, { summary: event.target.value })} />
              </label>
              <label className="wide tall">
                详细规则
                <textarea value={selected.detail} onChange={(event) => onUpdateEntry(selected.id, { detail: event.target.value })} />
              </label>
              <label className="wide">
                影响范围
                <textarea value={selected.influence} onChange={(event) => onUpdateEntry(selected.id, { influence: event.target.value })} />
              </label>
              <label>
                关联章节
                <input value={selected.linkedChapters} onChange={(event) => onUpdateEntry(selected.id, { linkedChapters: event.target.value })} />
              </label>
              <label>
                关联角色
                <input
                  value={selected.linkedCharacters}
                  onChange={(event) => onUpdateEntry(selected.id, { linkedCharacters: event.target.value })}
                />
              </label>
              <label className="wide">
                标签
                <input value={selected.tags.join("、")} onChange={(event) => onUpdateEntry(selected.id, { tags: event.target.value.split(/[、，,]/) })} />
              </label>
            </div>
          </div>

          <div className="world-detail-actions">
            <button type="button" onClick={() => onStatus("世界观一致性检查接口已预留")}>
              一致性检查
            </button>
            <button className="primary" type="button" onClick={() => onStatus("世界观资料已保存")}>
              保存世界观
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
