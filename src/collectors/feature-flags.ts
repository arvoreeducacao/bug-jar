export class FeatureFlagCollector {
  collect(): Record<string, unknown> | null {
    const flags: Record<string, unknown> = {};
    let found = false;

    const posthog = (window as any).posthog;
    if (posthog?.getFeatureFlag) {
      try {
        const allFlags =
          posthog.getAllFlags?.() || posthog.getFeatureFlags?.() || {};
        flags["posthog"] = allFlags;
        found = true;
      } catch {
        /* ignore */
      }
    }

    const ld = (window as any).ldclient;
    if (ld?.allFlags) {
      try {
        flags["launchdarkly"] = ld.allFlags();
        found = true;
      } catch {
        /* ignore */
      }
    }

    const statsig = (window as any).statsig;
    if (statsig?.getExperiment || statsig?.checkGate) {
      try {
        flags["statsig"] = { detected: true };
        found = true;
      } catch {
        /* ignore */
      }
    }

    const unleash = (window as any).unleash;
    if (unleash?.getAllToggles) {
      try {
        flags["unleash"] = unleash.getAllToggles();
        found = true;
      } catch {
        /* ignore */
      }
    }

    return found ? flags : null;
  }
}
