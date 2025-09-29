# 🍽️ 세종시 맛집 지도

React와 Leaflet을 사용한 세종시 맛집 공유 지도 애플리케이션입니다.  
Cloudflare Workers와 D1 데이터베이스를 통해 실시간으로 맛집 정보를 공유할 수 있습니다.

## ✨ 주요 기능

- 🗺️ **GPS 기반 지도**: 사용자 위치를 기준으로 지도 시작
- 👥 **사용자 인증**: 로그인/회원가입으로 개인 맛집 관리
- 📍 **맛집 등록**: 지도 클릭으로 간편 등록
- 🔍 **카카오 검색**: 맛집 이름으로 자동 주소/위치 검색
- ⭐ **평점 및 리뷰**: 5점 평점과 텍스트 리뷰 시스템
- 📱 **모바일 최적화**: 반응형 디자인으로 모바일 친화적
- 🔎 **검색 필터**: 맛집명/주소로 실시간 검색
- 📊 **집계 리뷰**: 동일 맛집에 대한 여러 사용자 리뷰 통합 표시

## 🚀 설치 및 실행

### 1. 프로젝트 클론 및 의존성 설치
```bash
git clone [repository-url]
cd matzip
npm install
```

### 2. 카카오 API 키 설정

1. [카카오 개발자 콘솔](https://developers.kakao.com/console/app)에서 앱 생성
2. **설정 > 일반** 에서 플랫폼 추가 (Web 플랫폼)
3. **제품 설정 > 카카오맵** 활성화
4. **앱 키** 에서 **REST API 키** 복사

### 3. 환경변수 설정

`.dev.vars` 파일을 생성하여 API 키 설정:
```bash
# .dev.vars 파일
KAKAO_API_KEY=여기에_발급받은_REST_API_키_입력
```

### 4. 개발 서버 실행

**프론트엔드 개발 서버 (Vite)**:
```bash
npm run dev
```
브라우저에서 `http://localhost:5173` 접속

**백엔드 API 서버 (Cloudflare Workers)**:
```bash
npm run dev:worker
```
API 서버가 `http://localhost:3000`에서 실행됨

**전체 개발 환경**:
두 명령어를 각각 다른 터미널에서 실행하여 프론트엔드와 백엔드를 동시에 개발할 수 있습니다.

## 📖 사용 방법

### 회원가입 및 로그인
1. 상단 **"로그인"** 버튼 클릭
2. 회원가입 또는 기존 계정으로 로그인
3. 로그인 후 개인 맛집 등록 및 관리 가능

### 맛집 등록
1. 로그인 후 **"맛집 등록"** 버튼 클릭
2. 커서가 핀 모양으로 변경됨
3. 지도에서 원하는 위치 클릭
4. 팝업에서 맛집 정보 입력
   - **🔍 검색 아이콘**: 맛집 이름으로 자동 주소 검색
   - 평점 선택 (1.0 ~ 5.0)
   - 리뷰 작성
5. **"등록하기"** 클릭

### 보기 모드 전환
- **전체**: 모든 사용자의 맛집 보기
- **내 맛집**: 자신이 등록한 맛집만 보기
- **⭐ 평점**: 지도에서 평점 표시 on/off

### 맛집 관리
- **마커 클릭**: 맛집 정보 확인 (사이드 패널)
- **✏️ 수정**: 본인 등록 맛집만 수정 가능
- **🗑️ 삭제**: 본인 등록 맛집만 삭제 가능
- **집계 리뷰**: 동일 맛집에 여러 리뷰가 있는 경우 통합 표시

### 검색
- 상단 검색창에서 맛집명/주소로 실시간 필터링

## 🛠️ 기술 스택

- **Frontend**: React 18, Vite
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **지도**: React-Leaflet, OpenStreetMap
- **API**: Kakao Map API (장소 검색)
- **스타일**: Vanilla CSS (반응형 디자인)
- **상태 관리**: React Hooks (useState, useEffect)
- **인증**: SHA-256 해시 기반 로그인 시스템

## 📁 프로젝트 구조

```
src/
├── App.jsx          # 메인 애플리케이션 컴포넌트
├── main.jsx         # React 진입점
├── index.css        # 스타일시트 (반응형 포함)
└── worker.js        # Cloudflare Workers API 핸들러

functions/
└── api/
    └── restaurants.js # 맛집 API 엔드포인트 (레거시)

public/
├── *.json           # 지역 데이터 파일들
└── index.html       # HTML 템플릿

schema.sql           # 데이터베이스 스키마
seed.sql            # 초기 데이터
wrangler.toml       # Cloudflare Workers 설정
```

## 🔧 배포 및 설정

### 프로덕션 빌드
```bash
npm run build
```

### Cloudflare 배포
```bash
npm run deploy
```

### 데이터베이스 설정
```bash
# D1 데이터베이스 생성 (최초 1회)
npx wrangler d1 create matzip

# 스키마 적용
npx wrangler d1 execute matzip --file=./schema.sql

# 초기 데이터 입력 (선택사항)
npx wrangler d1 execute matzip --file=./seed.sql
```

### API 설정 참고

**카카오 API**:
- 무료 할당량: 일 300,000회
- 장소 검색 API 사용 (키워드 검색)
- Workers를 통한 프록시로 CORS 문제 해결

**환경변수**:
- 개발: `.dev.vars` 파일
- 프로덕션: `wrangler secret put` 명령어

## 🎯 향후 개선 계획

- [ ] 이미지 업로드 기능
- [ ] 카테고리별 필터링 개선
- [ ] 즐겨찾기 기능
- [ ] PWA 지원
- [ ] 소셜 로그인 (카카오, 구글)
- [ ] 알림 시스템

## 📄 라이선스

MIT License