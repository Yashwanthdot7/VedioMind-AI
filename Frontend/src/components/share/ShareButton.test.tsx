import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from './ShareButton';
import { setSharing } from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  setSharing: vi.fn(),
  shareUrl: (slug: string) => `https://videomind.test/?s=${slug}`,
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') } }));

describe('ShareButton', () => {
  it('turns the class link on, shows link and QR code, and can turn it off again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(setSharing).mockResolvedValueOnce({ isPublic: true, shareSlug: 'Ab3dEf9hIk' });
    render(<ShareButton kind="lesson" id="L1" title="Volcanoes" isPublic={false} shareSlug={null} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Share with class' }));
    expect(screen.getByText(/The link is off/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Anyone with the link/ }));
    expect(setSharing).toHaveBeenCalledWith('lesson', 'L1', true);
    expect(await screen.findByDisplayValue('https://videomind.test/?s=Ab3dEf9hIk')).toBeInTheDocument();
    expect(await screen.findByAltText('QR code for the class link')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ isPublic: true, shareSlug: 'Ab3dEf9hIk' });

    vi.mocked(setSharing).mockResolvedValueOnce({ isPublic: false, shareSlug: 'Ab3dEf9hIk' });
    await user.click(screen.getByRole('checkbox', { name: /Anyone with the link/ }));
    expect(await screen.findByText(/The link is off/)).toBeInTheDocument();
  });

  it('shows the server error if sharing fails', async () => {
    const user = userEvent.setup();
    vi.mocked(setSharing).mockRejectedValueOnce(new Error('Sign in and open your own lesson to share it.'));
    render(<ShareButton kind="course" id="C1" title="Stars" isPublic={false} shareSlug={null} />);
    await user.click(screen.getByRole('button', { name: 'Share with class' }));
    await user.click(screen.getByRole('checkbox'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in');
  });
});
