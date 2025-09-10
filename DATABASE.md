# 🗄️ D1 데이터베이스 설정

## 📋 데이터베이스 정보
- **이름**: matzip
- **ID**: a79357b7-0549-4b73-a8de-391455a00bf9
- **지역**: APAC
- **바인딩**: DB

## 📊 테이블 스키마

### restaurants 테이블
```sql
CREATE TABLE restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- 맛집 이름
  address TEXT NOT NULL,                 -- 주소
  lat REAL NOT NULL,                     -- 위도
  lng REAL NOT NULL,                     -- 경도
  rating REAL NOT NULL DEFAULT 3.0,     -- 평점 (1.0-5.0)
  review TEXT,                           -- 리뷰 텍스트
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 인덱스
- `idx_restaurants_name` - 맛집 이름 검색용
- `idx_restaurants_address` - 주소 검색용  
- `idx_restaurants_location` - 위치 기반 검색용 (lat, lng)
- `idx_restaurants_rating` - 평점 정렬용
- `idx_restaurants_created_at` - 생성일 정렬용

## 🚀 설정 방법

### 1. 데이터베이스 생성 (이미 완료)
```bash
npx wrangler d1 create matzip
```

### 2. 스키마 적용
```bash
# 로컬 개발 환경
npx wrangler d1 execute matzip --file=./schema.sql

# 원격 프로덕션 환경
npx wrangler d1 execute matzip --remote --file=./schema.sql
```

### 3. 초기 데이터 삽입
```bash
# 로컬 개발 환경
npx wrangler d1 execute matzip --file=./seed.sql

# 원격 프로덕션 환경
npx wrangler d1 execute matzip --remote --file=./seed.sql
```

## 🔍 데이터베이스 쿼리

### 모든 맛집 조회
```bash
npx wrangler d1 execute matzip --remote --command="SELECT * FROM restaurants;"
```

### 평점순 정렬
```bash
npx wrangler d1 execute matzip --remote --command="SELECT * FROM restaurants ORDER BY rating DESC;"
```

### 이름으로 검색
```bash
npx wrangler d1 execute matzip --remote --command="SELECT * FROM restaurants WHERE name LIKE '%빌즈%';"
```

## 📝 초기 데이터

현재 5개의 샘플 맛집 데이터가 포함되어 있습니다:
1. **하여금 동국** - 세종시 아름동 (4.5점)
2. **빌즈 세종** - 세종시 도담동 (4.2점)  
3. **세종 맛집** - 세종시 종촌동 (4.0점)
4. **카페 드림** - 세종시 나성동 (3.8점)
5. **맛있는 집** - 세종시 보람동 (4.3점)

## 🔧 향후 확장 계획

- 사용자 인증 시스템 (users 테이블)
- 좋아요/북마크 기능 (favorites 테이블)
- 카테고리 분류 (categories 테이블)
- 이미지 업로드 (images 테이블)
- 댓글 시스템 (comments 테이블)