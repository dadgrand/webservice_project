import sanitizeHtml from 'sanitize-html';

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'code',
      'pre',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      h5: ['style'],
      h6: ['style'],
    },
    allowedStyles: {
      '*': {
        'text-align': [/^left$/, /^center$/, /^right$/, /^justify$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
  }).trim();
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();

    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return NAMED_HTML_ENTITIES[normalized] ?? match;
  });
}

export function stripRichTextToPlainText(value: string): string {
  const withoutTags = value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|blockquote|h[1-6]|pre|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

export function buildTextPreview(value: string, maxLength = 150): string {
  const plainText = stripRichTextToPlainText(value);

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength).trim()}...`;
}
