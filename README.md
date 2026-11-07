# 📚 PustakaKu — Sistem Manajemen Perpustakaan

Aplikasi full-stack untuk mengelola perpustakaan: katalog buku, peminjaman & pengembalian dengan denda otomatis,
ulasan/rating, dan dashboard laporan. Dideploy menggunakan **3 container Docker** (frontend, backend, database)
dengan pipeline **CI/CD GitHub Actions**.

## Teknologi
| Lapisan | Teknologi | Container |
|---|---|---|
| Frontend | React 18 + Vite, React Router, disajikan oleh Nginx | `pustakaku-frontend` (port 8080/80) |
| Backend | Node.js 20 + Express, JWT, bcrypt | `pustakaku-backend` (port 5000) |
| Database | MySQL 8.0 | `pustakaku-db` (port 3307 → 3306) |
| CI/CD | GitHub Actions, Docker Hub | — |

## Fitur
1. **Autentikasi & manajemen pengguna** — registrasi, login JWT, role admin/member, ubah role.
2. **Katalog buku** — pencarian (judul/penulis/ISBN), filter kategori, CRUD buku (admin), manajemen stok.
3. **Peminjaman & reservasi** — pinjam (maks. 3 buku aktif, masa 7 hari), pengembalian, denda Rp1.000/hari otomatis, status terlambat; buku habis bisa direservasi (antrean FIFO, buku ditahan 2 hari saat giliran, otomatis pindah ke antrean berikutnya bila tidak diambil).
4. **Ulasan & rating** — rating 1–5 bintang + komentar, hanya untuk yang pernah meminjam, distribusi rating.
5. **Dashboard** — statistik (buku, anggota, pinjaman, denda), grafik 7 hari, buku terpopuler, daftar keterlambatan, rekomendasi.

## Menjalankan dengan Docker
```bash
cp .env.example .env          # opsional, ada nilai default
docker compose up -d --build  # build & jalankan 3 container
docker compose ps             # cek status
```
Buka **http://localhost:8080** · Login admin: `admin@pustakaku.id` / `admin123`

Perintah lain:
```bash
docker compose logs -f backend   # lihat log
docker compose down              # hentikan
docker compose down -v           # hentikan + hapus data database
```

## Menjalankan tanpa Docker (development)
```bash
# MySQL lokal sudah berjalan & database/init.sql sudah diimport
cd backend && npm install && npm run dev     # http://localhost:5000
cd frontend && npm install && npm run dev    # http://localhost:5173
```

## CI/CD
Dua workflow terpisah:
- **CI** — `.github/workflows/ci.yml` (Anggota 1): jalan di setiap push & pull request.
- **CD** — `.github/workflows/cd.yml` (Anggota 5): jalan otomatis setelah CI lulus di branch `main`.

```
CI (ci.yml)                          CD (cd.yml) - hanya jika CI lulus di main
push / PR ──► backend-test   ─┐      integration-test (docker compose 3 container + smoke test)
              frontend-build ─┴──►            ▼
                                     build-and-push (Docker Hub: latest + SHA)
                                              ▼
                             deploy-vps (SSH)  atau  deploy-local (self-hosted runner)
```

### Setup yang dibutuhkan di GitHub (Settings → Secrets and variables → Actions)
| Nama | Jenis | Isi |
|---|---|---|
| `DOCKERHUB_USERNAME` | Secret | username Docker Hub |
| `DOCKERHUB_TOKEN` | Secret | Access token Docker Hub (Account Settings → Personal access tokens) |
| `DEPLOY_TARGET` | Variable | `vps` atau `local` (kosongkan jika hanya sampai push image) |
| `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` | Secret | hanya untuk `vps` |

**Opsi local (tanpa VPS):** di laptop yang sudah terpasang Docker, buka repo → Settings → Actions → Runners →
*New self-hosted runner*, ikuti perintahnya, lalu set variable `DEPLOY_TARGET=local`. Setiap merge ke `main`
otomatis men-deploy versi terbaru ke laptop tersebut (http://localhost).

## Endpoint API
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek status backend & DB |
| POST | `/api/auth/register`, `/api/auth/login` | Registrasi / login |
| GET | `/api/auth/me` · `/api/auth/users` (admin) | Profil · daftar pengguna |
| PUT | `/api/auth/users/:id/role` (admin) | Ubah role |
| GET | `/api/books?q=&category=` · `/api/books/:id` · `/api/books/categories` | Katalog |
| POST/PUT/DELETE | `/api/books[/:id]` (admin) | CRUD buku |
| POST | `/api/loans` | Pinjam buku |
| GET | `/api/loans/my` · `/api/loans?status=` (admin) | Riwayat pinjaman |
| PUT | `/api/loans/:id/return` | Kembalikan + hitung denda (+ beri jatah ke antrean) |
| POST / GET / DELETE | `/api/reservations`, `/api/reservations/my`, `/api/reservations/book/:id`, `/api/reservations/:id` | Reservasi & antrean |
| GET/POST/DELETE | `/api/reviews/book/:id` · `/api/reviews` · `/api/reviews/:id` | Ulasan |
| GET | `/api/dashboard/stats` (admin) · `/api/dashboard/me` | Statistik |

Pembagian tugas anggota: lihat [PEMBAGIAN_TUGAS.md](PEMBAGIAN_TUGAS.md).
