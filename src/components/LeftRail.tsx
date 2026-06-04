import type { FeatureDefinition, FeatureId } from "../features/leftNavigation";

type LeftRailProps = {
  features: FeatureDefinition[];
  activeFeature: FeatureId;
  onSelectFeature: (feature: FeatureDefinition) => void;
};

export function LeftRail({ features, activeFeature, onSelectFeature }: LeftRailProps) {
  return (
    <aside className="rail" aria-label="主导航">
      <div className="brand-mark">F</div>
      <nav className="nav-list">
        {features.map((feature) => (
          <button
            className={`nav-item${feature.id === activeFeature ? " active" : ""}`}
            key={feature.id}
            onClick={() => onSelectFeature(feature)}
            title={feature.description}
          >
            <span className="nav-icon" aria-hidden="true">
              {feature.icon}
            </span>
            <span>{feature.label}</span>
          </button>
        ))}
      </nav>
      <button className="collapse-rail" aria-label="收起导航">
        «
      </button>
    </aside>
  );
}
