// Tests for AudioRecorder: recording, uploading a file, previewing and removing a clip.
// MediaRecorder, the microphone and blob URLs are faked because jsdom has none of them.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeRecorder } from '../../../../test/fake-media-recorder';
import { AudioRecorder } from './AudioRecorder';

// A parent that owns the clip, like the post form will.
function Harness({ onChange = vi.fn(), disabled = false }) {
  const [audio, setAudio] = useState<Blob | null>(null);
  return (
    <AudioRecorder
      value={audio}
      disabled={disabled}
      onChange={(next) => {
        onChange(next);
        setAudio(next);
      }}
    />
  );
}

describe('AudioRecorder', () => {
  beforeEach(() => {
    installFakeRecorder();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    // jsdom doesn't define these, so remove our fakes after each test.
    delete (URL as Partial<typeof URL>).createObjectURL;
    delete (URL as Partial<typeof URL>).revokeObjectURL;
  });

  it('records a clip, previews it, and can remove it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /record audio/i }));
    expect(screen.getByRole('timer')).toHaveTextContent(
      'Recording 0:00 / 5:00',
    );

    await user.click(screen.getByRole('button', { name: /stop/i }));
    expect(onChange).toHaveBeenCalledWith(expect.any(Blob));
    expect(screen.getByLabelText('Audio preview')).toHaveAttribute(
      'src',
      'blob:preview',
    );

    await user.click(screen.getByRole('button', { name: 'Remove audio' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByLabelText('Audio preview')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('accepts an uploaded audio file', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<Harness onChange={onChange} />);

    const file = new File(['sound'], 'answer.mp3', { type: 'audio/mpeg' });
    await user.upload(container.querySelector('input[type="file"]')!, file);

    expect(onChange).toHaveBeenCalledWith(file);
    expect(screen.getByLabelText('Audio preview')).toBeInTheDocument();
  });

  it('rejects a file that is not audio and explains why', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<Harness onChange={onChange} />);

    const image = new File(['png'], 'pic.png', { type: 'image/png' });
    await user.upload(container.querySelector('input[type="file"]')!, image);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/choose an audio file/);
  });

  it('ignores an empty file selection', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the recorder error, e.g. when the microphone is blocked', async () => {
    const fake = installFakeRecorder();
    fake.getUserMedia.mockRejectedValueOnce(new Error('denied'));
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /record audio/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /Microphone access was blocked/,
    );
  });

  it('disables recording and uploading while the form is busy', () => {
    const { container } = render(<Harness disabled />);
    expect(
      screen.getByRole('button', { name: /record audio/i }),
    ).toBeDisabled();
    expect(container.querySelector('input[type="file"]')).toBeDisabled();
  });
});
