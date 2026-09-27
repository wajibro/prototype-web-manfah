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
export const blogPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const kategori = req.query.kategori as string | undefined;
        const tanggal  = req.query.tanggal  as string | undefined;
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

        // 3. Filter tunggal
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

        // 5. Fetch + mapping link
        const rawPosts = (await selectTable("posts", postOptions)) as Post[];

        const posts = (rawPosts || []).map(p => ({
            ...p,
            link: `/blog/${makeSlug(p.judul)}`,
        }));

        // 6. Render
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
        });
    } catch (error) {
        next(error);
    }
};