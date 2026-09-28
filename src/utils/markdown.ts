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
    smartypants: true,
});

// ============================================================
// Renderer custom
// ============================================================
const renderer = new marked.Renderer();

// ---------- HEADING dengan ID (anchor TOC) ----------
renderer.heading = (text: string, level: number) => {
    const id = slugifyHeading(text);
    return `<h${level} id="${id}" class="font-bold">${text}</h${level}>`;
};

// ---------- CODE BLOCK dengan highlight + tombol copy ----------
renderer.code = (code: string, infostring: string | undefined) => {
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
        return `<${type} class="px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider ${alignClass}">${content}</${type}>`;
    }
    return `<${type} class="px-6 py-4 text-sm text-gray-600 ${alignClass}">${content}</${type}>`;
};

marked.use({ renderer });

// ============================================================
// POST-PROCESS: Bungkus TOC dengan .toc-box
// ============================================================
const wrapToc = (html: string): string => {
    // 1. Cari posisi heading TOC
    const tocHeadingRegex = /<h([1-6])([^>]*)>\s*(Table Of Contents|Daftar Isi|TOC)\s*<\/h\1>/gi;
    const match = tocHeadingRegex.exec(html);
    
    if (!match) return html;

    const headingStartIndex = match.index;
    const headingEndIndex = headingStartIndex + match[0].length;
    
    // 2. Cari tag <ol> atau <ul> pertama setelah heading
    const afterHeading = html.slice(headingEndIndex);
    let listStartIndex = -1;
    let listType = '';
    
    const olIndex = afterHeading.indexOf('<ol');
    const ulIndex = afterHeading.indexOf('<ul');
    
    if (olIndex !== -1 && (ulIndex === -1 || olIndex < ulIndex)) {
        listStartIndex = olIndex;
        listType = 'ol';
    } else if (ulIndex !== -1) {
        listStartIndex = ulIndex;
        listType = 'ul';
    }
    
    if (listStartIndex === -1) return html;
    
    const openTag = `<${listType}`;
    const closeTag = `</${listType}>`;
    
    // 3. Hitung kedalaman tag untuk menemukan penutup yang cocok (mengatasi nested list)
    const openTagEndIndex = afterHeading.indexOf('>', listStartIndex) + 1;
    if (openTagEndIndex === 0) return html;
    
    let depth = 1;
    let i = openTagEndIndex;
    
    while (i < afterHeading.length && depth > 0) {
        const nextOpen = afterHeading.indexOf(openTag, i);
        const nextClose = afterHeading.indexOf(closeTag, i);
        
        if (nextClose === -1) break; // Tidak ada tag penutup, keluar
        
        if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            i = nextOpen + openTag.length;
        } else {
            depth--;
            i = nextClose + closeTag.length;
        }
    }
    
    if (depth !== 0) return html; // Tag tidak seimbang, kembalikan asli
    
    const listHtml = afterHeading.slice(listStartIndex, i);
    const fullMatch = match[0] + afterHeading.slice(0, i);
    
    // 4. Pastikan ada link anchor di dalam list
    if (!/<a href="#/.test(listHtml)) return html;
    
    // 5. Tambahkan class toc-list ke tag pembuka
    const listWithClass = listHtml.replace(new RegExp(`^<${listType}[^>]*>`), `<${listType} class="toc-list">`);
    
    // 6. Bungkus dengan div.toc-box
    const replacement = `
        <div class="toc-box mt-0" data-reveal>
            <h${match[1]} class="toc-title">Table Of Contents</h${match[1]}>
            ${listWithClass}
        </div>
    `;
    
    return html.replace(fullMatch, replacement);
};

const wrapTables = (html: string): string => {
    return html.replace(
        /<table([^>]*)>([\s\S]*?)<\/table>/g,
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