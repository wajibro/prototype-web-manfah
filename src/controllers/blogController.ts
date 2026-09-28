import type { Request, Response, NextFunction } from "express";
import { selectTable } from "../services/supabaseService";
import { slugify } from '../utils/slugify';
import supabase from "../../config/supabase.js";
import { renderMarkdown } from '../utils/markdown';
import { Category, DateView, Creator, Post } from "../types/blogTypes.js";

const sanitizeWord = (w: string): string =>
    w.replace(/[,()%*\\{}:."']/g, "").trim();

const makeSlug = (judul: string): string => slugify(judul);

// ================================================================
// GET /blog
// ================================================================
// ================================================================
// GET /blog
// ================================================================
export const blogPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const kategori = req.query.kategori as string | undefined;
        const tanggal  = req.query.tanggal  as string | undefined;
        const bulan    = (req.query.bulan as string | undefined)?.trim(); // format: YYYY-MM
        const kreator  = req.query.kreator  as string | undefined;
        const q        = (req.query.q as string | undefined)?.trim();

        // 1. Fetch data filter (paralel)
        const [categories, dates, creators] = await Promise.all([
            selectTable("view_daftar_kategori_posts") as Promise<Category[]>,
            selectTable("view_daftar_tanggal_posts")  as Promise<DateView[]>,
            selectTable("view_daftar_kreator_posts")  as Promise<Creator[]>,
        ]);

        // 2. Base options
        const postOptions: {
            select: string;
            order1: string;
            order1State: boolean;
            eqCol?: string;
            eqRow?: any;
            containsCol?: string;
            containsRow?: any;
            orFilters?: string[];
        } = {
            select: "*, creator:id_creator(id_creator, nama)",
            order1: "id_post",
            order1State: false,
        };

        // 3. Filter tunggal (bulan TIDAK di sini — difilter di JS setelah fetch)
        if (kategori) {
            postOptions.containsCol = "kategori";
            postOptions.containsRow = [kategori];
        }
        if (tanggal) {
            postOptions.eqCol = "tanggal";
            postOptions.eqRow = tanggal;
        }
        if (kreator) {
            postOptions.eqCol = "id_creator";
            postOptions.eqRow = Number(kreator);
        }

        // 4. Search query
        if (q) {
            const words = q
                .split(/\s+/)
                .map(sanitizeWord)
                .filter(w => w.length > 0);

            if (words.length > 0) {
                const creatorIdsSet = new Set<number>();

                for (const word of words) {
                    const { data } = await supabase
                        .from("creator")
                        .select("id_creator")
                        .ilike("nama", `%${word}%`);

                    (data || []).forEach((c: { id_creator: number }) =>
                        creatorIdsSet.add(c.id_creator)
                    );
                }

                const creatorIds = Array.from(creatorIdsSet);

                postOptions.orFilters = words.map(word => {
                    const parts = [
                        `judul.ilike.%${word}%`,
                        `kategori.cs.{${word}}`,
                    ];
                    if (creatorIds.length > 0) {
                        parts.push(`id_creator.in.(${creatorIds.join(",")})`);
                    }
                    return parts.join(",");
                });
            }
        }

        // 5. Fetch
        let rawPosts = (await selectTable("posts", postOptions)) as Post[];

        // 6. Filter bulan (YYYY-MM) — difilter di JS
        if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
            rawPosts = (rawPosts || []).filter((p) => {
                if (!p.tanggal) return false;
                const d = new Date(p.tanggal);
                if (isNaN(d.getTime())) return false;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === bulan;
            });
        }

        // 7. Mapping link
        const posts = (rawPosts || []).map(p => ({
            ...p,
            link: `/blog/${makeSlug(p.judul)}`,
        }));

        // 8. Render
        res.render('blogs', {
            posts,
            categories,
            dates,
            creators,
            query: req.query,
        });
    } catch (error) {
        next(error);
    }
};

// ================================================================
// GET /blog/:slug
// ================================================================
export const getBlogDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { slug } = req.params;

        const posts = (await selectTable("posts", {
            select: "*, creator:id_creator(id_creator, nama)",
            order1: "id_post",
            order1State: false,
        })) as Post[];

        const post = (posts || []).find(p => slugify(p.judul) === slug);

        if (!post) {
            res.status(404).render('404', {
                message: `Post "${slug}" tidak ditemukan`,
            });
            return;
        }

        // ================================================
        // Data sidebar
        // ================================================
        const categories = (await selectTable(
            "view_daftar_kategori_posts"
        )) as Category[];

        // --- Postingan terbaru ---
        const recentRaw = (await selectTable("view_posts_terbaru", { limit: 6 })) as any[];

        const recentPosts = (recentRaw || [])
            .map((p: any) => ({
                id:        p.id_post ?? p.id,
                judul:     p.judul,
                cover_url: p.cover_url,
                tanggal:   p.tanggal,
                link:      `/blog/${slugify(p.judul)}`,
            }))
            .filter((p: any) => p.judul && slugify(p.judul) !== slug)
            .slice(0, 5);

        // --- Arsip per BULAN (dihitung dari posts) ---
        const monthLabels = [
            'Januari','Februari','Maret','April','Mei','Juni',
            'Juli','Agustus','September','Oktober','November','Desember'
        ];

        const monthSet = new Set<string>();

        (posts || []).forEach((p) => {
            if (!p.tanggal) return;
            const d = new Date(p.tanggal);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthSet.add(key);
        });

        const months = Array.from(monthSet)
            .sort((a, b) => b.localeCompare(a)) // terbaru di atas
            .map((m) => {
                const [y, mo] = m.split('-').map(Number);
                return {
                    value: m,                                 // "2024-05"
                    label: `${monthLabels[mo - 1]} ${y}`,    // "Mei 2024"
                };
            });

        let htmlContent = '';
        try {
            const mdRes = await fetch(post.content_url);
            if (!mdRes.ok) throw new Error(`HTTP ${mdRes.status}`);
            const markdown = await mdRes.text();

            htmlContent = await renderMarkdown(markdown);
        } catch (err) {
            console.error('Gagal fetch markdown:', err);
            htmlContent = `<p class="text-red-500">Konten tidak dapat dimuat.</p>`;
        }

        res.render('blog', {
            title:     post.judul,
            content:   htmlContent,
            creator:   post.creator,
            date:      post.tanggal,
            kategori:  post.kategori || [],
            cover_url: post.cover_url,

            // === sidebar ===
            recentPosts,
            categories,
            months,
        });
    } catch (error) {
        next(error);
    }
};