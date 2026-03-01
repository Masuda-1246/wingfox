/** Detect the language a persona was generated in by checking for Japanese content */
export function detectLangFromDocument(compiledDocument: string): "ja" | "en" {
	// Count Japanese characters (hiragana, katakana, CJK) in the content
	const jpChars = (compiledDocument.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) ?? []).length;
	// If significant Japanese content exists, treat as Japanese
	if (jpChars > 20) return "ja";
	return "en";
}
