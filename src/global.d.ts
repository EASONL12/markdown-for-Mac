import type { PlainMarkApi } from "./shared/types/plainmarkApi";

declare global {
  interface Window {
    plainmark?: PlainMarkApi;
  }
}

export {};
