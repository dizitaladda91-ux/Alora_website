import sanitizeHtml from "sanitize-html";

const BLOG_ALLOWED_TAGS = [
  "p", "br", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "s", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr",
  "th", "td", "hr"
];

export const sanitizePlainText = (value, maxLength = 500) => sanitizeHtml(String(value ?? ""), {
  allowedTags: [],
  allowedAttributes: {}
}).replace(/\s+/g, " ").trim().slice(0, maxLength);

export const sanitizeBlogHtml = (value) => sanitizeHtml(String(value ?? "").replace(/<h1\b[^>]*>.*?<\/h1>/gis, ""), {
  allowedTags: BLOG_ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "title"],
    img: ["src", "alt", "width", "height", "loading"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"]
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

export const sanitizeJsonObject = (value) => {
  if (value === undefined || value === null || value === "") return "";
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Schema must be a JSON object.");
  }
  return JSON.stringify(parsed);
};
