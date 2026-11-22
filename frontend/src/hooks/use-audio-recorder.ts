'use client';

// Records audio from the user's microphone with the browser's MediaRecorder API.
// MDN: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API
//
// Usage:
//   const recorder = useAudioRecorder({ onRecorded: blob => setAudio(blob) });
//   recorder.start(); ... recorder.stop();
import { useCallback, useEffect, useRef, useState } from 'react';

// 5 minutes keeps recordings well under the 10 MB upload limit.
export const MAX_RECORDING_SECONDS = 5 * 60;

// Chrome/Firefox record webm; Safari only records mp4. Use the first one supported.
const PREFERRED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4'];

export function pickRecordingType(): string | undefined {
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

type Options = {
  onRecorded: (audio: Blob) => void;
  maxSeconds?: number;
};

export function useAudioRecorder({
  onRecorded,
  maxSeconds = MAX_RECORDING_SECONDS,
}: Options) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep the latest callback without restarting anything when the parent re-renders.
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  // Turn off the microphone (the browser's "recording" indicator) and the timer.
  const release = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        "Recording isn't supported in this browser. Try uploading a file instead.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      // Shows the browser's microphone permission prompt the first time.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        'Microphone access was blocked. Allow it in your browser settings, or upload a file.',
      );
      return;
    }

    const mimeType = pickRecordingType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      release();
      setIsRecording(false);
      // recorder.mimeType includes codecs (e.g. "audio/webm;codecs=opus"); the backend accepts that.
      onRecordedRef.current(
        new Blob(chunks, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        }),
      );
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setIsRecording(true);

    // Count up each second and stop automatically at the limit. The count lives in a local
    // variable (not a state updater) so stopping never happens in the middle of a render.
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= maxSeconds) recorder.stop();
    }, 1000);
  }, [maxSeconds, release]);

  // If the component disappears mid-recording (e.g. the dialog closes), free the microphone.
  useEffect(() => release, [release]);

  return { isRecording, seconds, error, start, stop };
}

// 75 -> "1:15"
export function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}
