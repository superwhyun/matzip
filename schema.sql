-- Cloudflare D1 데이터베이스 스키마
-- 세종시 맛집 공유 지도 애플리케이션

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 맛집 테이블
CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  rating REAL NOT NULL DEFAULT 3.0,
  review TEXT,
  user_id INTEGER NOT NULL,
  kakao_place_id TEXT,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 사용자 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

-- 맛집 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_address ON restaurants(address);
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(lat, lng);
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON restaurants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_kakao_place_id ON restaurants(kakao_place_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_category ON restaurants(category);