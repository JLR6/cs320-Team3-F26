// Tests for AudioPlayer: plays a post's audio from its public URL, or renders nothing.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AudioPlayer } from './AudioPlayer';

vi.mock('@/lib/api/post-audio', () => ({
  getPostAudioUrl: (path: string) =>
    `https://storage.example/PostAudio/${path}`,
}));

describe('AudioPlayer', () => {
  it('plays the post audio from its public URL without preloading it', () => {
    render(<AudioPlayer audioPath="u/p-1.webm" />);
    const audio = screen.getByLabelText('Post audio');
    expect(audio).toHaveAttribute(
      'src',
      'https://storage.example/PostAudio/u/p-1.webm',
    );
    expect(audio).toHaveAttribute('preload', 'none');
    expect(audio).toHaveAttribute('controls');
  });

  it('accepts a custom class name', () => {
    render(<AudioPlayer audioPath="u/p-1.webm" className="w-40" />);
    expect(screen.getByLabelText('Post audio')).toHaveClass('w-40');
  });

  it.each([null, undefined, ''])(
    'renders nothing when audioPath is %s',
    (audioPath) => {
      const { container } = render(<AudioPlayer audioPath={audioPath} />);
      expect(container).toBeEmptyDOMElement();
    },
  );
});
