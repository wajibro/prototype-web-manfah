import supabase from '../../config/supabase.js';
import { CartCookieItem, CartItemResponse, Product } from '../types/cart';

// ============================================================
// Baris mentah dari tabel `products` (nama kolom asli Supabase)
// ============================================================
interface RawProduct {
  id_product: string | number;
  nama: string;
  harga: number | string;
  Stok: number | string;
  image_url: string | null;
}

// ============================================================
// Normalisasi kolom Supabase -> bentuk internal
// ============================================================
const mapProduct = (row: RawProduct): Product => ({
  id_product: String(row.id_product),
  name: row.nama,
  price: Number(row.harga),
  stock: Number(row.Stok),
  image_url: row.image_url,
});

// ============================================================
// Ambil banyak produk berdasarkan id_product
// ============================================================
export const getProductsByIds = async (ids: string[]): Promise<Product[]> => {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('products')
    .select('id_product, nama, harga, Stok, image_url')
    .in('id_product', ids);

  if (error) throw new Error(`Gagal ambil produk: ${error.message}`);
  return ((data ?? []) as RawProduct[]).map(mapProduct);
};

// ============================================================
// Ambil satu produk berdasarkan id_product
// ============================================================
export const getProductById = async (id: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('id_product, nama, harga, Stok, image_url')
    .eq('id_product', id)
    .maybeSingle();

  if (error) throw new Error(`Gagal ambil produk: ${error.message}`);
  if (!data) return null;
  return mapProduct(data as RawProduct);
};

// ============================================================
// Gabungkan item cookie (id_product + qty) dengan data Supabase
// ============================================================
export const buildCartResponse = async (items: CartCookieItem[]) => {
  if (items.length === 0) {
    return {
      items: [] as CartItemResponse[],
      totalItems: 0,
      totalPrice: 0,
    };
  }

  const ids = items.map((i) => i.id_product);
  const products = await getProductsByIds(ids);
  const productMap = new Map(products.map((p) => [p.id_product, p]));

  const merged: CartItemResponse[] = items.map((item) => {
    const product = productMap.get(item.id_product);

    // Produk sudah dihapus dari DB
    if (!product) {
      return {
        id_product: item.id_product,
        name: '(Produk tidak tersedia)',
        price: 0,
        quantity: item.quantity,
        subtotal: 0,
        image_url: null,
        stock: 0,
        available: false,
      };
    }

    const available = product.stock >= item.quantity;

    return {
      id_product: product.id_product,
      name: product.name,
      slug: product.name.toLowerCase().trim().replace(/\s+/g, '-'),  // ← tambahan
      price: product.price,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
      image_url: product.image_url,
      stock: product.stock,
      available,
    };
  });

  const totalItems = merged.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = merged.reduce((s, i) => s + i.subtotal, 0);

  return { items: merged, totalItems, totalPrice };
};