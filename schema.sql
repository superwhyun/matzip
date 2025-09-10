-- Cloudflare D1 데이터베이스 스키마
-- 세종시 맛집 공유 지도 애플리케이션

-- 맛집 테이블
CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  rating REAL NOT NULL DEFAULT 3.0,
  review TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 맛집 이름 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);

-- 지역 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_address ON restaurants(address);

-- 위치 기반 검색을 위한 인덱스 (위도, 경도)
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(lat, lng);

-- 평점 정렬을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);

-- 생성일 정렬을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON restaurants(created_at DESC);