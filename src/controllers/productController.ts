import type { Request, Response, NextFunction } from 'express';
import supabase from '../../config/supabase.js';
import { selectTable } from '../services/supabaseService';
import { slugify } from '../utils/slugify';
import { renderMarkdown } from '../utils/markdown';

const sanitizeWord = (w: string): string =>
  w.replace(/[,()%*\\{}:."']/g, '').trim();

const makeSlug = (nama: string): string => slugify(nama);

// ================================================================
// GET /products
// Filter: kategori
// Sort:   harga_asc | harga_desc (default: terbaru)
// Search: q (nama / kategori)
// ================================================================
export const productPage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const kategori = (req.query.kategori as string | undefined)?.trim();
    const sort = (req.query.sort as string | undefined)?.trim();
    const q = (req.query.q as string | undefined)?.trim();

    // 1. Ambil semua produk
    const allProducts = await selectTable('products');

    // 2. Susun daftar unik kategori untuk dropdown
    const kategoriSet = new Set<string>();
    (allProducts || []).forEach((p: any) => {
      const k = (p.kategori || '').toString().trim();
      if (k) kategoriSet.add(k);
    });

    const categories = Array.from(kategoriSet)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => ({ kategori: k }));

    // 3. Filter kategori
    let products = allProducts || [];

    if (kategori) {
      products = products.filter(
        (p: any) =>
          String(p.kategori || '').toLowerCase() === kategori.toLowerCase()
      );
    }

    // 4. Search multi-field (nama + kategori)
    if (q) {
      const words = q
        .split(/\s+/)
        .map(sanitizeWord)
        .filter((w) => w.length > 0);

      if (words.length > 0) {
        products = products.filter((p: any) => {
          const haystack = `${p.nama || ''} ${p.kategori || ''}`.toLowerCase();
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

    // 7. Render
    res.render('products', {
      products: finalProducts,
      categories,
      query: req.query,
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