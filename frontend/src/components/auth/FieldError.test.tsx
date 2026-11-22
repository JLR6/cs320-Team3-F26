import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldError } from './FieldError';

describe('FieldError', () => {
  // shows the message as an alert
  it('shows the message as an alert', () => {
    render(<FieldError id="email-error" message="Bad email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bad email');
  });
  // renders nothing without a message
  it('renders nothing without a message', () => {
    const { container } = render(<FieldError id="email-error" />);
    expect(container).toBeEmptyDOMElement();
  });
});
