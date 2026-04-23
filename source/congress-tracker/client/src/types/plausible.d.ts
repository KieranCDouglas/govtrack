declare global {
  interface Window {
    umami?: {
      track: (event: string, props?: Record<string, string>) => void;
    };
  }
}

export {};
