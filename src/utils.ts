
/**
 * Extracts the paragraph of text surrounding the given cursor position.
 * A paragraph is defined as a block of text separated by empty lines.
 */
export const extractParagraphAtCursor = (text: string, cursorIndex: number): string => {
    if (!text) return '';

    const lines = text.split('\n');
    let currentPos = 0;
    let targetLineIndex = -1;

    // Find which line the cursor is on
    for (let i = 0; i < lines.length; i++) {
        // Length of line plus the newline character that follows it
        // Note: The last line might not have a newline, but for index calculation
        // we can assume previous lines did.
        const lineLengthWithNewline = lines[i].length + 1;

        // Check if cursor is within this line (inclusive of start, exclusive of next line start)
        // We handle the EOF case specially if needed, but usually cursorIndex <= text.length
        if (cursorIndex >= currentPos && cursorIndex < currentPos + lineLengthWithNewline) {
            targetLineIndex = i;
            break;
        }

        currentPos += lineLengthWithNewline;
    }

    // If cursor is at the very end of text
    if (targetLineIndex === -1 && cursorIndex === text.length) {
        targetLineIndex = lines.length - 1;
    }

    if (targetLineIndex === -1) return ''; // Should not happen if index is valid

    // If the target line itself is empty (whitespace only), return as is or empty?
    // User said "executes the current paragraph the cursor is on".
    // If on empty space, we treat it as no paragraph selected.
    if (!lines[targetLineIndex].trim()) {
        return '';
    }

    // Scan backwards to find start of paragraph
    let startLine = targetLineIndex;
    while (startLine > 0 && lines[startLine - 1].trim().length > 0) {
        startLine--;
    }

    // Scan forwards to find end of paragraph
    let endLine = targetLineIndex;
    while (endLine < lines.length - 1 && lines[endLine + 1].trim().length > 0) {
        endLine++;
    }

    return lines.slice(startLine, endLine + 1).join('\n');
};

/**
 * Immutably updates a value at a given JSON path.
 * Path starts with 'root', which is ignored.
 */
export const updateValueAtPath = (obj: any, path: string[], newValue: any): any => {
    // path starts with 'root'
    const keys = path.slice(1);
    if (keys.length === 0) return newValue;

    const newObjArrayOrObject = Array.isArray(obj) ? [...obj] : { ...obj };
    let current: any = newObjArrayOrObject;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        // Handle linked data wrapper
        if (current[key] && typeof current[key] === 'object' && current[key].__isLinked__) {
            // We need to immutably update the wrapper itself too
            current[key] = {
                ...current[key],
                linkedData: Array.isArray(current[key].linkedData) ? [...current[key].linkedData] : { ...current[key].linkedData }
            };
            current = current[key].linkedData;
        } else {
            // Standard update
            current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
            current = current[key];
        }
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = newValue;

    return newObjArrayOrObject;
};
