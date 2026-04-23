declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: Record<string, string> }) => void) & {
      q?: unknown[];
      init?: (options?: Record<string, unknown>) => void;
      o?: Record<string, unknown>;
    };
  }
}

export {};
