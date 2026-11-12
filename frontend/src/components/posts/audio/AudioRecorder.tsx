'use client';

// Lets the author attach an optional audio clip to a post: record from the microphone,
// or upload an existing file. Controlled component: the parent owns the Blob.
//
// In the post form:
//   const [audio, setAudio] = useState<Blob | null>(null);
//   <AudioRecorder value={audio} onChange={setAudio} />
//   ...after the post is created: if (audio) await uploadPostAudio(post.id, audio);
import { Mic, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  formatSeconds,
  useAudioRecorder,
  MAX_RECORDING_SECONDS,
} from '@/hooks/use-audio-recorder';
import { audioFileError } from '@/lib/api/post-audio';

type Props = {
  value: Blob | null;
  onChange: (audio: Blob | null) => void;
  disabled?: boolean;
};

// Plays the attached clip before it's uploaded. The effect makes a temporary "blob:" URL
// and puts it straight on the <audio> element (no state needed), then frees it when the
// clip changes or the preview goes away.
function AudioPreview({ blob }: { blob: Blob }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (audioRef.current) audioRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return (
    <audio
      ref={audioRef}
      controls
      aria-label="Audio preview"
      className="h-9 w-full"
    />
  );
}

export function AudioRecorder({ value, onChange, disabled = false }: Props) {
  const inputId = useId();
  const [fileError, setFileError] = useState<string | null>(null);
  const recorder = useAudioRecorder({ onRecorded: onChange });

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again still fires onChange
    if (!file) return;
    const problem = audioFileError(file);
    setFileError(problem);
    if (!problem) onChange(file);
  }

  const error = recorder.error ?? fileError;

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        // Clip attached: preview it, or remove it.
        <div className="flex items-center gap-2">
          <AudioPreview blob={value} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove audio"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <Trash2 />
          </Button>
        </div>
      ) : recorder.isRecording ? (
        // Recording: show elapsed time and a stop button.
        <div className="flex items-center gap-2 text-sm">
          <span
            className="size-2 animate-pulse rounded-full bg-destructive"
            aria-hidden
          />
          <span role="timer" aria-live="off">
            Recording {formatSeconds(recorder.seconds)} /{' '}
            {formatSeconds(MAX_RECORDING_SECONDS)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={recorder.stop}
          >
            <Square /> Stop
          </Button>
        </div>
      ) : (
        // Nothing attached yet: record or upload.
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setFileError(null);
              void recorder.start();
            }}
          >
            <Mic /> Record audio
          </Button>
          <label
            htmlFor={inputId}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium hover:bg-muted has-disabled:pointer-events-none has-disabled:opacity-50"
          >
            <Upload className="size-3.5" /> Upload audio file
            <input
              id={inputId}
              type="file"
              accept="audio/*"
              className="sr-only"
              disabled={disabled}
              onChange={handleFile}
            />
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
