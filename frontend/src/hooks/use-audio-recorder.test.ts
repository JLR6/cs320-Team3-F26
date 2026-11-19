// Tests for useAudioRecorder with a fake MediaRecorder and microphone (jsdom has neither).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeMediaRecorder,
  installFakeRecorder,
  removeFakeMicrophone,
} from '../../test/fake-media-recorder';
import {
  formatSeconds,
  pickRecordingType,
  useAudioRecorder,
} from './use-audio-recorder';

describe('useAudioRecorder', () => {
  let fake: ReturnType<typeof installFakeRecorder>;

  beforeEach(() => {
    fake = installFakeRecorder();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records, then hands the clip to onRecorded and releases the microphone', async () => {
    const onRecorded = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecorded }));

    await act(() => result.current.start());
    expect(fake.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.isRecording).toBe(true);
    expect(fake.recorders[0].mimeType).toBe('audio/webm;codecs=opus');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.seconds).toBe(3);

    act(() => result.current.stop());
    expect(result.current.isRecording).toBe(false);
    expect(fake.track.stop).toHaveBeenCalled();

    const clip = onRecorded.mock.calls[0][0] as Blob;
    expect(clip.type).toBe('audio/webm;codecs=opus');
    expect(clip.size).toBe(5); // only the non-empty "sound" chunk
  });

  it('stops automatically at the time limit', async () => {
    const onRecorded = vi.fn();
    const { result } = renderHook(() =>
      useAudioRecorder({ onRecorded, maxSeconds: 2 }),
    );

    await act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isRecording).toBe(false);
    expect(onRecorded).toHaveBeenCalledOnce();
  });

  it('ignores stop when not recording', () => {
    const onRecorded = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecorded }));
    act(() => result.current.stop());
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('falls back to the browser default type when none is supported', async () => {
    FakeMediaRecorder.supported = new Set();
    const onRecorded = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecorded }));

    await act(() => result.current.start());
    act(() => result.current.stop());

    expect((onRecorded.mock.calls[0][0] as Blob).type).toBe('audio/webm');
  });

  it('explains when the microphone is blocked', async () => {
    fake.getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    const { result } = renderHook(() =>
      useAudioRecorder({ onRecorded: vi.fn() }),
    );

    await act(() => result.current.start());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toMatch(/Microphone access was blocked/);
  });

  it('explains when the browser cannot record', async () => {
    removeFakeMicrophone();
    const { result } = renderHook(() =>
      useAudioRecorder({ onRecorded: vi.fn() }),
    );

    await act(() => result.current.start());

    expect(result.current.error).toMatch(/isn't supported in this browser/);
  });

  it('frees the microphone if the component unmounts while recording', async () => {
    const { result, unmount } = renderHook(() =>
      useAudioRecorder({ onRecorded: vi.fn() }),
    );
    await act(() => result.current.start());
    unmount();
    expect(fake.track.stop).toHaveBeenCalled();
  });
});

describe('pickRecordingType', () => {
  it('prefers webm, then ogg, then mp4 (Safari)', () => {
    installFakeRecorder();
    FakeMediaRecorder.supported = new Set(['audio/ogg', 'audio/mp4']);
    expect(pickRecordingType()).toBe('audio/ogg');
    FakeMediaRecorder.supported = new Set(['audio/mp4']);
    expect(pickRecordingType()).toBe('audio/mp4');
  });
});

describe('formatSeconds', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [75, '1:15'],
    [300, '5:00'],
  ])('%i -> %s', (seconds, text) => {
    expect(formatSeconds(seconds)).toBe(text);
  });
});
