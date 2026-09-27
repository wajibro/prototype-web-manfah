// src/utils/cartCookie.ts
import type { Request, Response } from 'express';
import Config from '../../config/index.js';
import type { CartCookieItem } from '../types/cart.js';

export const CART_COOKIE = 'cart';
export const MAX_QTY_PER_ITEM = 99;
export const MAX_ITEMS = 30;                       // jaga ukuran cookie < 4KB
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;   // 30 hari

/** Batasi quantity ke 1..99 */
export const clampQty = (value: unknown): number => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, MAX_QTY_PER_ITEM);
};

/** Baca cookie → array item (selalu valid, tidak pernah throw) */
export const readCart = (req: Request): CartCookieItem[] => {
    const raw = req.cookies?.[CART_COOKIE];
    if (!raw) return [];

    let parsed: unknown = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(parsed)) return [];

    return parsed
        .map((it: any) => ({
            id_product: String(it?.id_product ?? '').trim(),
            quantity: clampQty(it?.quantity),
        }))
        .filter((i) => i.id_product.length > 0)
        .slice(0, MAX_ITEMS);
};

/** Tulis cookie (kalau kosong → hapus cookie) */
export const writeCart = (res: Response, items: CartCookieItem[]): void => {
    const clean = items
        .filter((i) => i.id_product && i.quantity > 0)
        .slice(0, MAX_ITEMS);

    if (clean.length === 0) {
        clearCartCookie(res);
        return;
    }

    res.cookie(CART_COOKIE, JSON.stringify(clean), {
        httpOnly: true,
        sameSite: 'lax',
        secure: Config.IS_PRODUCTION,
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    });
};

export const clearCartCookie = (res: Response): void => {
    res.clearCookie(CART_COOKIE, { path: '/' });
};

export const countItems = (items: CartCookieItem[]): number =>
    items.reduce((sum, i) => sum + i.quantity, 0);

/* ================= operasi item ================= */

export const addItem = (
    items: CartCookieItem[],
    id_product: unknown,
    quantity: unknown = 1
): CartCookieItem[] => {
    const id = String(id_product ?? '').trim();
    if (!id) return items;

    const qty = clampQty(quantity);
    const next = items.map((i) => ({ ...i }));
    const found = next.find((i) => i.id_product === id);

    if (found) {
        found.quantity = Math.min(found.quantity + qty, MAX_QTY_PER_ITEM);
    } else if (next.length < MAX_ITEMS) {
        next.push({ id_product: id, quantity: qty });
    }
    return next;
};

export const setItem = (
    items: CartCookieItem[],
    id_product: unknown,
    quantity: unknown
): CartCookieItem[] => {
    const id = String(id_product ?? '').trim();
    const qty = Math.floor(Number(quantity));
    if (!id) return items;
    if (!Number.isFinite(qty) || qty <= 0) return removeItem(items, id);

    return items.map((i) =>
        i.id_product === id
            ? { ...i, quantity: Math.min(qty, MAX_QTY_PER_ITEM) }
            : { ...i }
    );
};

export const removeItem = (
    items: CartCookieItem[],
    id_product: unknown
): CartCookieItem[] => {
    const id = String(id_product ?? '').trim();
    return items.filter((i) => i.id_product !== id).map((i) => ({ ...i }));
};