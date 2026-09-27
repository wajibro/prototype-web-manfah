export interface CartCookieItem {
  id_product: string;
  quantity: number;
}

export interface Product {
  id_product: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
}

export interface CartItemResponse {
  id_product: string;
  name: string;
  slug: string;         // ← tambahan
  price: number;
  quantity: number;
  subtotal: number;
  image_url: string | null;
  stock: number;
  available: boolean;
}