// A fake MediaRecorder + microphone for tests (jsdom has neither).
// installFakeRecorder() stubs the globals and returns handles to control and inspect them.
import { vi } from 'vitest';

export class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static supported = new Set(['audio/webm']);
  static isTypeSupported = (type: string) =>
    FakeMediaRecorder.supported.has(type);

  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(
    public stream: unknown,
    options?: { mimeType?: string },
  ) {
    this.mimeType = options?.mimeType ? `${options.mimeType};codecs=opus` : '';
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  // Like a real recorder: emit the recorded data, then fire onstop.
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['sound'], { type: this.mimeType }),
    });
    this.ondataavailable?.({ data: new Blob([]) }); // empty chunks should be ignored
    this.onstop?.();
  }
}

export function installFakeRecorder() {
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.supported = new Set(['audio/webm']);
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const getUserMedia = vi.fn().mockResolvedValue(stream);

  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });

  return { track, getUserMedia, recorders: FakeMediaRecorder.instances };
}

export function removeFakeMicrophone() {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
}
