import { describe, expect, it } from 'vitest';
import { ExtractError, extractText, fileKind, tidy } from './extractText';

describe('tidy', () => {
  it('joins words split across lines and sentences broken by line ends', () => {
    expect(tidy('Plants use photo-\nsynthesis to make\nfood. Then\n\nNew paragraph.')).toBe('Plants use photosynthesis to make food. Then\n\nNew paragraph.');
  });
  it('keeps Hindi sentence ends (danda) as line ends and squeezes spaces', () => {
    expect(tidy('लोकतंत्र में   सत्ता।\nचुनाव')).toBe('लोकतंत्र में सत्ता।\nचुनाव');
  });
});

describe('fileKind and extractText', () => {
  const file = (name: string, body = 'hello world, this is a test', type = '') => new File([body], name, { type });
  it('recognises PDF, Word and text files', () => {
    expect(fileKind(file('a.PDF'))).toBe('pdf');
    expect(fileKind(file('notes.docx'))).toBe('docx');
    expect(fileKind(file('notes.md'))).toBe('text');
    expect(fileKind(file('x.doc'))).toBeNull();
  });
  it('reads plain text files', async () => {
    await expect(extractText(file('a.txt', 'Line one\nline two.'))).resolves.toMatchObject({ kind: 'text', text: 'Line one line two.' });
  });
  it('refuses unknown types with a clear message', async () => {
    await expect(extractText(file('x.exe'))).rejects.toBeInstanceOf(ExtractError);
  });
});
