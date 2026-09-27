import { marked } from 'marked';
import hljs from 'highlight.js';

// ============================================================
// Helper: slug dari teks heading (untuk anchor TOC)
// ============================================================
const slugifyHeading = (text: string): string =>
    text
        .toLowerCase()
        .replace(/<[^>]+>/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

// ============================================================
// Konfigurasi marked (v4 — CommonJS friendly)
// ============================================================
marked.setOptions({
    gfm: true,
    breaks: true,
    pedantic: false,
    smartypants: true,   // ✅ v4 masih support ini
});

// ============================================================
// Renderer custom
// ============================================================
const renderer = new marked.Renderer();

// ---------- HEADING dengan ID (anchor TOC) ----------
renderer.heading = (text: string, level: number) => {
    // ⚠️ Signature v4: (text, level, raw, slugger)
    const id = slugifyHeading(text);
    return `<br><h${level} id="${id}">${text}</h${level}>`;
};

// ---------- CODE BLOCK dengan highlight + tombol copy ----------
renderer.code = (code: string, infostring: string | undefined) => {
    // ⚠️ Signature v4: (code, infostring, escaped)
    const lang = (infostring || '').match(/\S*/)?.[0] || '';
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    const highlighted = hljs.highlight(code, { language }).value;

    return `
        <div class="code-block" data-reveal>
            <div class="code-header">
                <span class="code-lang">${language}</span>
                <button class="copy-btn" data-code="${encodeURIComponent(code)}">Copy</button>
            </div>
            <pre><code class="hljs language-${language}">${highlighted}</code></pre>
        </div>
    `;
};

// ---------- INLINE CODE ----------
renderer.codespan = (text: string) =>
    `<code class="inline-code">${text}</code>`;

// ---------- GAMBAR dengan lazy load ----------
renderer.image = (href: string, title: string | null, text: string) =>
    `<img src="${href}" alt="${text || ''}" title="${title || ''}" class="md-image" loading="lazy" data-reveal>`;

// ---------- BLOCKQUOTE ----------
renderer.blockquote = (quote: string) =>
    `<blockquote class="md-blockquote">${quote}</blockquote>`;

// ---------- LINK eksternal auto target="_blank" ----------
renderer.link = (href: string, title: string | null, text: string) => {
    const isExternal = /^https?:\/\//.test(href) && !href.includes('manfahbot');
    const attrs = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}" title="${title || ''}" ${attrs}>${text}</a>`;
};

// ---------- TABLE ----------
renderer.table = (header: string, body: string) => {
    return `
        <table class="min-w-full divide-y divide-gray-200" data-reveal>
            <thead class="bg-gray-50">
                ${header}
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${body}
            </tbody>
        </table>
    `;
};

// ---------- TABLE ROW ----------
renderer.tablerow = (content: string) => {
    return `<tr class="hover:bg-gray-50 transition-colors">${content}</tr>`;
};

// ---------- TABLE CELL ----------
renderer.tablecell = (content: string, flags: { header: boolean; align: 'center' | 'left' | 'right' | null }) => {
    const type = flags.header ? 'th' : 'td';
    const alignClass = flags.align ? `text-${flags.align}` : 'text-left';
    
    if (flags.header) {
        // Styling untuk Header (th)
        return `<${type} class="px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider ${alignClass}">${content}</${type}>`;
    }
    
    // Styling untuk Sel Biasa (td)
    return `<${type} class="px-6 py-4 text-sm text-gray-600 ${alignClass}">${content}</${type}>`;
};

marked.use({ renderer });

// ============================================================
// POST-PROCESS: Bungkus TOC dengan .toc-box
// ============================================================
const wrapToc = (html: string): string => {
    return html.replace(
        /<h([1-6])([^>]*)>\s*(Table Of Contents|Daftar Isi|TOC)\s*<\/h\1>\s*(<[uo]l>[\s\S]*?<\/[uo]l>)/gi,
        (_match, level, _attrs, _title, list) => {
            if (!/<a href="#/.test(list)) return _match;

            const listWithClass = list
                .replace(/^<ul/, '<ul class="toc-list"')
                .replace(/^<ol/, '<ol class="toc-list"');

            return `
                <div class="toc-box" data-reveal>
                    <h${level} class="toc-title">Table Of Contents</h${level}>
                    ${listWithClass}
                </div>
            `;
        }
    );
};

const wrapTables = (html: string): string => {
    return html.replace(
        /<table([^>]*)>([\s\S]*?)<\/table>/g, // <-- Regex diubah untuk menangkap atribut class
        '<div class="table-wrapper overflow-x-auto my-6" data-reveal><table$1>$2</table></div>'
    );
};

// ============================================================
// API utama — SYNC (tidak async)
// ============================================================
export const renderMarkdown = (markdown: string): string => {
    let html = marked.parse(markdown) as string;
    html = wrapToc(html);
    html = wrapTables(html);
    return html;
};