// ================================================================
// src/controllers/productController.ts
// ================================================================
import type { Request, Response, NextFunction } from 'express';
import supabase from '../../config/supabase.js';
import { selectTable } from '../services/supabaseService';
import { slugify } from '../utils/slugify';
import { renderMarkdown } from '../utils/markdown';

const sanitizeWord = (w: string): string =>
  w.replace(/[,()%*\\{}:."']/g, '').trim();

const makeSlug = (nama: string): string => slugify(nama);

const UNCATEGORIZED_KEY = 'uncategorized';

const getKategori = (p: any): string => String(p?.kategori ?? '').trim();

// ================================================================
// GET /products
// ================================================================
export const productPage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const kategoriRaw = (req.query.kategori as string | undefined)?.trim();
    const sort = (req.query.sort as string | undefined)?.trim();
    const q = (req.query.q as string | undefined)?.trim();

    // Normalisasi input kategori → slug
    // "Micro Controller" | "micro%20controller" | "Micro+Controller"
    // semuanya jadi "micro-controller"
    const kategoriSlug = kategoriRaw ? slugify(kategoriRaw) : '';

    // 1. Ambil semua produk
    const allProducts = await selectTable('products', { order1: 'id_product', order1State: false });

    // 2. Susun kategori unik (dalam bentuk slug) + deteksi uncategorized
    const kategoriSlugSet = new Set<string>();
    let hasUncategorized = false;

    (allProducts || []).forEach((p: any) => {
      const k = getKategori(p);
      if (k) {
        kategoriSlugSet.add(slugify(k));
      } else {
        hasUncategorized = true;
      }
    });

    const categories = Array.from(kategoriSlugSet)
      .sort((a, b) => a.localeCompare(b))
      .map((slug) => ({ kategori: slug }));

    if (hasUncategorized) {
      categories.push({ kategori: UNCATEGORIZED_KEY });
    }

    // 3. Filter kategori (bandingkan dalam bentuk slug)
    let products = allProducts || [];

    if (kategoriSlug) {
      if (kategoriSlug === UNCATEGORIZED_KEY) {
        products = products.filter((p: any) => getKategori(p) === '');
      } else {
        products = products.filter(
          (p: any) => slugify(getKategori(p)) === kategoriSlug
        );
      }
    }

    // 4. Search
    if (q) {
      const words = q
        .split(/\s+/)
        .map(sanitizeWord)
        .filter((w) => w.length > 0);

      if (words.length > 0) {
        products = products.filter((p: any) => {
          const haystack = `${p.nama || ''} ${getKategori(p)}`.toLowerCase();
          return words.every((w) => haystack.includes(w.toLowerCase()));
        });
      }
    }

    // 5. Sort harga
    if (sort === 'harga_asc') {
      products = [...products].sort(
        (a: any, b: any) => Number(a.harga) - Number(b.harga)
      );
    } else if (sort === 'harga_desc') {
      products = [...products].sort(
        (a: any, b: any) => Number(b.harga) - Number(a.harga)
      );
    }

    // 6. Map link
    const finalProducts = products.map((p: any) => ({
      ...p,
      link: `/products/${makeSlug(p.nama)}`,
    }));

    // 7. Render — kirim kategoriSlug (sudah ternormalisasi) ke view
    res.render('products', {
      products: finalProducts,
      categories,
      query: {
        ...req.query,
        kategori: kategoriSlug || undefined,
      },
    });
  } catch (error) {
    next(error);
    return;
  }
};

// ================================================================
// GET /products/:slug
// ================================================================
export const getProductDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    const products = await selectTable('products');
    const product = (products || []).find(
      (p) => slugify(p.nama) === slug
    );

    if (!product) {
      res.status(404).render('404', {
        message: `Product "${slug}" tidak ditemukan`,
      });
      return;
    }

    let htmlContent = '';

    if (product.deskripsi_url) {
      try {
        const mdRes = await fetch(product.deskripsi_url);
        if (!mdRes.ok) throw new Error(`HTTP ${mdRes.status}`);

        const markdown = await mdRes.text();
        htmlContent = renderMarkdown(markdown);
      } catch (err) {
        console.error('Gagal fetch markdown produk:', err);
        htmlContent = `<p class="text-red-500">Deskripsi produk tidak dapat dimuat.</p>`;
      }
    }

    res.render('product', {
      product,
      content: htmlContent,
      title: product.nama,
    });
  } catch (error) {
    next(error);
    return;
  }
};