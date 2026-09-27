export interface Creator {
    id_creator: number;
    nama: string;
    slug?: string;
}

export interface Post {
    // Primary key
    id: number;

    // Konten utama
    judul: string;
    slug?: string;
    kategori: string[];              // array kategori
    deskripsi_singkat?: string | null;

    // File & media
    content_url: string;             // ← yang hilang
    cover_url: string;

    // Relasi
    id_creator: number;
    creator?: Creator | null;        // hasil join (opsional)

    // Metadata
    tanggal: string;
    author?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface Category {
    kategori: string;
}

export interface DateView {
    value: string;
    label?: string;
}

// (kalau ada)
export interface CreatorView {
    id_creator: number;
    nama: string;
}