// JavaScript string characters, matching the established import boundary.
// Preserve complete history: refuse a larger transaction, never trim its prose.
export const MAX_SAVE_CHARACTERS = 1000000;
// Each JS UTF-16 code unit needs at most three UTF-8 bytes. This pre-read
// guard cannot reject an exported string accepted by the character policy.
export const MAX_SAVE_FILE_BYTES = MAX_SAVE_CHARACTERS * 3;
export function assertSaveSize(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_SAVE_CHARACTERS) {
    const error = new Error('存档文字长度超过 1,000,000 字符上限，无法保存或重新导入。');
    error.code = 'SAVE_SIZE_LIMIT';
    throw error;
  }
  return raw;
}
