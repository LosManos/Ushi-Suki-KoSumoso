import { describe, it, expect } from 'vitest';
import { extractParagraphAtCursor, updateValueAtPath, fuzzyMatch, getPropertyPath } from './utils';

// ─── extractParagraphAtCursor ──────────────────────────────────────────

describe('extractParagraphAtCursor', () => {
    it('returns the paragraph the cursor is in', () => {
        const text = 'line one\nline two\n\nline three';
        // Cursor in "line two" → should return the first paragraph
        const result = extractParagraphAtCursor(text, 10);
        expect(result).toBe('line one\nline two');
    });

    it('returns empty string when cursor is on an empty line', () => {
        const text = 'first\n\nsecond';
        // Cursor on the blank line between paragraphs (index 6 = the newline)
        const result = extractParagraphAtCursor(text, 6);
        expect(result).toBe('');
    });

    it('returns the paragraph when cursor is at the very start', () => {
        const text = 'hello\nworld\n\nother';
        const result = extractParagraphAtCursor(text, 0);
        expect(result).toBe('hello\nworld');
    });

    it('returns the last paragraph when cursor is at the end of text', () => {
        const text = 'first\n\nlast paragraph';
        const result = extractParagraphAtCursor(text, text.length);
        expect(result).toBe('last paragraph');
    });

    it('returns empty string for empty input', () => {
        expect(extractParagraphAtCursor('', 0)).toBe('');
    });

    it('handles single-line text', () => {
        const text = 'only one line';
        const result = extractParagraphAtCursor(text, 5);
        expect(result).toBe('only one line');
    });

    it('handles multiple paragraphs and picks the correct one', () => {
        const text = 'a\nb\n\nc\nd\n\ne\nf';
        // Cursor on "d" (paragraph 2)
        const indexOfD = text.indexOf('d');
        const result = extractParagraphAtCursor(text, indexOfD);
        expect(result).toBe('c\nd');
    });
});

// ─── updateValueAtPath ─────────────────────────────────────────────────

describe('updateValueAtPath', () => {
    it('updates a simple nested property immutably', () => {
        const obj = { a: { b: 1 } };
        const result = updateValueAtPath(obj, ['root', 'a', 'b'], 42);
        expect(result.a.b).toBe(42);
        // Original unchanged
        expect(obj.a.b).toBe(1);
    });

    it('returns the new value when path is just root', () => {
        const result = updateValueAtPath({ x: 1 }, ['root'], 'replaced');
        expect(result).toBe('replaced');
    });

    it('updates a value inside an array', () => {
        const obj = { items: [10, 20, 30] };
        const result = updateValueAtPath(obj, ['root', 'items', '1'], 99);
        expect(result.items[1]).toBe(99);
        // Original unchanged
        expect(obj.items[1]).toBe(20);
    });

    it('handles __isLinked__ wrapper objects', () => {
        const obj = {
            link: {
                __isLinked__: true,
                linkedData: { name: 'old' },
            },
        };
        const result = updateValueAtPath(obj, ['root', 'link', 'name'], 'new');
        expect(result.link.linkedData.name).toBe('new');
        // Original unchanged
        expect(obj.link.linkedData.name).toBe('old');
    });

    it('updates a deeply nested property', () => {
        const obj = { a: { b: { c: { d: 'deep' } } } };
        const result = updateValueAtPath(obj, ['root', 'a', 'b', 'c', 'd'], 'updated');
        expect(result.a.b.c.d).toBe('updated');
        expect(obj.a.b.c.d).toBe('deep');
    });
});

// ─── fuzzyMatch ────────────────────────────────────────────────────────

describe('fuzzyMatch', () => {
    it('matches when characters appear in order', () => {
        expect(fuzzyMatch('abc', 'aXbYcZ')).toBe(true);
    });

    it('returns false when characters are not in order', () => {
        expect(fuzzyMatch('abc', 'cba')).toBe(false);
    });

    it('returns true for empty query (matches everything)', () => {
        expect(fuzzyMatch('', 'anything')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(fuzzyMatch('ABC', 'aXbYcZ')).toBe(true);
        expect(fuzzyMatch('abc', 'AXBYCZ')).toBe(true);
    });

    it('returns false when query is longer than text', () => {
        expect(fuzzyMatch('longquery', 'short')).toBe(false);
    });

    it('matches exact strings', () => {
        expect(fuzzyMatch('hello', 'hello')).toBe(true);
    });
});

// ─── getPropertyPath ───────────────────────────────────────────────────

describe('getPropertyPath', () => {
    it('strips root and joins remaining segments', () => {
        expect(getPropertyPath(['root', 'user', 'name'])).toBe('user.name');
    });

    it('strips numeric segments (array indices)', () => {
        expect(getPropertyPath(['root', 'items', '0', 'title'])).toBe('items.title');
    });

    it('returns empty string for root-only path', () => {
        expect(getPropertyPath(['root'])).toBe('');
    });

    it('handles empty array', () => {
        expect(getPropertyPath([])).toBe('');
    });

    it('handles null/undefined input gracefully', () => {
        expect(getPropertyPath(null as any)).toBe('');
        expect(getPropertyPath(undefined as any)).toBe('');
    });

    it('strips multiple numeric segments in a complex path', () => {
        expect(getPropertyPath(['root', 'data', '2', 'nested', '5', 'value'])).toBe('data.nested.value');
    });
});
