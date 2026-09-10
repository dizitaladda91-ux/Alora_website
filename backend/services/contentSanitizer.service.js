import sanitizeHtml from "sanitize-html";

const BLOG_ALLOWED_TAGS = [
  "p", "br", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "s", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr",
  "th", "td", "hr", "div", "span"
];

export const decodeEntities = (str) => {
  if (str === null || str === undefined) return "";
  let decoded = String(str);
  let previous;
  let iterations = 0;
  do {
    previous = decoded;
    decoded = decoded
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&#39;|&apos;/gi, "'");
    iterations++;
  } while (decoded !== previous && iterations < 5);
  return decoded;
};

export const sanitizePlainText = (value, maxLength = 500) => {
  const stripped = sanitizeHtml(String(value ?? ""), {
    allowedTags: [],
    allowedAttributes: {}
  });
  return decodeEntities(stripped).replace(/\s+/g, " ").trim().slice(0, maxLength);
};

export const sanitizeBlogHtml = (value) => sanitizeHtml(String(value ?? "").replace(/<h1\b[^>]*>.*?<\/h1>/gis, ""), {
  allowedTags: BLOG_ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "title"],
    img: ["src", "alt", "width", "height", "loading"],
    table: ["class", "style", "border", "cellpadding", "cellspacing", "align"],
    thead: ["class", "style"],
    tbody: ["class", "style"],
    tr: ["class", "style"],
    th: ["colspan", "rowspan", "style", "class", "scope", "align"],
    td: ["colspan", "rowspan", "style", "class", "align"],
    div: ["class", "style"],
    span: ["class", "style"],
    p: ["class", "style"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        href: attribs.href,
        title: attribs.title,
        target: attribs.target === "_blank" ? "_blank" : undefined,
        rel: attribs.target === "_blank" ? "noopener noreferrer" : undefined
      }
    })
  }
});

export const sanitizeHttpUrl = (value) => {
  const url = String(value ?? "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

export const deduplicateSchemas = (schemas) => {
  if (!Array.isArray(schemas)) return [];
  const seen = new Set();
  const result = [];
  for (const s of schemas) {
    if (!s || typeof s !== "object") continue;
    const key = JSON.stringify(s);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }
  return result;
};

export const parseAndNormalizeSchemas = (rawInput) => {
  if (!rawInput) return [];
  if (Array.isArray(rawInput)) {
    return deduplicateSchemas(rawInput.filter(item => item && typeof item === "object"));
  }
  if (typeof rawInput === "object" && rawInput !== null) {
    if (Array.isArray(rawInput["@graph"])) {
      return deduplicateSchemas(rawInput["@graph"].filter(item => item && typeof item === "object"));
    }
    return [rawInput];
  }
  let cleaned = String(rawInput).trim();
  if (!cleaned) return [];

  if (cleaned.includes("<script")) {
    const scriptMatches = cleaned.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches && scriptMatches.length > 0) {
      const extracted = [];
      for (const match of scriptMatches) {
        const content = match.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
        if (content) {
          const sub = parseAndNormalizeSchemas(content);
          extracted.push(...sub);
        }
      }
      if (extracted.length > 0) return deduplicateSchemas(extracted);
    } else {
      cleaned = cleaned.replace(/<[^>]*>/g, "").trim();
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return deduplicateSchemas(parsed.filter(item => item && typeof item === "object"));
    }
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed["@graph"])) {
        return deduplicateSchemas(parsed["@graph"].filter(item => item && typeof item === "object"));
      }
      return [parsed];
    }
  } catch (_) {}

  const schemas = [];
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === "\\") {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{" || char === "[") {
        if (depth === 0) startIndex = i;
        depth++;
      } else if (char === "}" || char === "]") {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          const chunk = cleaned.substring(startIndex, i + 1).trim();
          try {
            const parsedObj = JSON.parse(chunk);
            if (Array.isArray(parsedObj)) {
              schemas.push(...parsedObj.filter(item => item && typeof item === "object"));
            } else if (parsedObj && typeof parsedObj === "object") {
              if (Array.isArray(parsedObj["@graph"])) {
                schemas.push(...parsedObj["@graph"].filter(item => item && typeof item === "object"));
              } else {
                schemas.push(parsedObj);
              }
            }
          } catch (_) {}
          startIndex = -1;
        }
      }
    }
  }

  return deduplicateSchemas(schemas);
};

export const formatSchemaForStorage = (value) => {
  if (!value) return "";
  const parsed = parseAndNormalizeSchemas(value);
  if (!parsed || parsed.length === 0) return "";
  if (parsed.length === 1) {
    const single = { ...parsed[0] };
    if (!single["@context"]) single["@context"] = "https://schema.org";
    return JSON.stringify(single, null, 2);
  }
  return JSON.stringify(parsed, null, 2);
};

export const sanitizeJsonObject = (value) => {
  if (value === undefined || value === null || value === "") return "";
  const schemas = parseAndNormalizeSchemas(value);
  if (!schemas || schemas.length === 0) {
    throw new Error("Invalid JSON-LD Schema format provided.");
  }
  return formatSchemaForStorage(schemas);
};

