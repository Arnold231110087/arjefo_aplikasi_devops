-- Skema database PustakaKu (Anggota 2)
-- Dijalankan otomatis oleh container MySQL saat pertama kali dibuat
-- (di-mount ke /docker-entrypoint-initdb.d/).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','member') NOT NULL DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(150) NOT NULL,
  isbn VARCHAR(20) UNIQUE,
  category_id INT NULL,
  year INT NULL,
  stock INT NOT NULL DEFAULT 1,
  available INT NOT NULL DEFAULT 1,
  description TEXT,
  cover_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  loan_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  status ENUM('borrowed','returned') NOT NULL DEFAULT 'borrowed',
  fine INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_loans_status (status, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (user_id, book_id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Antrean reservasi buku yang stoknya habis
CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  status ENUM('waiting','ready','fulfilled','cancelled','expired') NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ready_at DATE NULL,
  expires_at DATE NULL,
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_res_queue (book_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Data awal
INSERT INTO categories (name) VALUES
  ('Teknologi'), ('Novel'), ('Sains'), ('Sejarah'), ('Pengembangan Diri');

INSERT INTO books (title, author, isbn, category_id, year, stock, available, description) VALUES
  ('Laskar Pelangi', 'Andrea Hirata', '9789793062792', 2, 2005, 4, 4, 'Kisah sepuluh anak Belitung yang berjuang untuk bersekolah.'),
  ('Bumi Manusia', 'Pramoedya Ananta Toer', '9789799731234', 2, 1980, 3, 3, 'Kisah Minke di masa kolonial Hindia Belanda.'),
  ('Clean Code', 'Robert C. Martin', '9780132350884', 1, 2008, 2, 2, 'Panduan menulis kode yang bersih dan mudah dirawat.'),
  ('The DevOps Handbook', 'Gene Kim dkk.', '9781942788003', 1, 2016, 2, 2, 'Praktik DevOps untuk mempercepat delivery software.'),
  ('Docker Deep Dive', 'Nigel Poulton', '9781521822807', 1, 2020, 3, 3, 'Dasar hingga lanjutan container dengan Docker.'),
  ('Sapiens', 'Yuval Noah Harari', '9780062316097', 4, 2011, 2, 2, 'Sejarah singkat umat manusia.'),
  ('A Brief History of Time', 'Stephen Hawking', '9780553380163', 3, 1988, 1, 1, 'Pengantar kosmologi untuk pembaca umum.'),
  ('Atomic Habits', 'James Clear', '9780735211292', 5, 2018, 3, 3, 'Cara membangun kebiasaan kecil yang berdampak besar.');
