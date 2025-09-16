export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight 처리
    if (method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      // API 라우팅 처리
      // 맛집 목록 조회
      if (path === '/api/restaurants' && method === 'GET') {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        const aggregated = url.searchParams.get('aggregated') === 'true';
        const bounds = url.searchParams.get('bounds'); // "lat1,lng1,lat2,lng2" 형태
        
        if (userId) {
          // 특정 사용자의 맛집 목록
          const stmt = env.DB.prepare(`
            SELECT r.*, u.nickname 
            FROM restaurants r 
            LEFT JOIN users u ON r.user_id = u.id 
            WHERE r.user_id = ? 
            ORDER BY r.created_at DESC
          `);
          const { results } = await stmt.bind(parseInt(userId)).all();
          
          return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (aggregated) {
          // 집계된 맛집 목록 (같은 place_id별로 통합) - 단순화
          const stmt = env.DB.prepare(`
            SELECT 
              COALESCE(r.kakao_place_id, 'no_id_' || r.id) as group_key,
              r.kakao_place_id,
              r.name,
              r.address,
              r.lat,
              r.lng,
              AVG(r.rating) as avg_rating,
              COUNT(*) as review_count,
              MAX(r.updated_at) as latest_update
            FROM restaurants r
            LEFT JOIN users u ON r.user_id = u.id
            GROUP BY COALESCE(r.kakao_place_id, 'no_id_' || r.id), r.name, r.address, r.lat, r.lng
            ORDER BY latest_update DESC
          `);
          const { results: groupedResults } = await stmt.all();
          
          // 각 그룹의 상세 리뷰 정보 가져오기
          const processedResults = [];
          for (const group of groupedResults) {
            let reviewsStmt;
            let reviewsParams;
            
            let reviewsWhereClause = '';
            if (group.kakao_place_id) {
              reviewsWhereClause = 'WHERE r.kakao_place_id = ?';
              reviewsParams = [group.kakao_place_id];
            } else {
              reviewsWhereClause = 'WHERE r.kakao_place_id IS NULL AND r.name = ? AND r.address = ? AND r.lat = ? AND r.lng = ?';
              reviewsParams = [group.name, group.address, group.lat, group.lng];
            }
            
            // bounds 필터링 추가
            if (bounds) {
              const [lat1, lng1, lat2, lng2] = bounds.split(',').map(Number);
              const minLat = Math.min(lat1, lat2);
              const maxLat = Math.max(lat1, lat2);
              const minLng = Math.min(lng1, lng2);
              const maxLng = Math.max(lng1, lng2);
              
              reviewsWhereClause += ' AND r.lat BETWEEN ? AND ? AND r.lng BETWEEN ? AND ?';
              reviewsParams.push(minLat, maxLat, minLng, maxLng);
            }
            
            reviewsStmt = env.DB.prepare(`
              SELECT r.*, u.nickname 
              FROM restaurants r 
              LEFT JOIN users u ON r.user_id = u.id 
              ${reviewsWhereClause}
              ORDER BY r.created_at DESC
            `);
            
            const { results: reviews } = await reviewsStmt.bind(...reviewsParams).all();
            
            // 첫 번째 리뷰에서 카테고리 정보 가져오기
            const category = reviews.length > 0 ? reviews[0].category : null;
            
            processedResults.push({
              ...group,
              category: category,
              reviews: reviews
            });
          }
          
          return new Response(JSON.stringify(processedResults), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // 전체 맛집 목록 (집계된 형태로 반환)
          let whereClause = '';
          let queryParams = [];
          
          if (bounds) {
            const [lat1, lng1, lat2, lng2] = bounds.split(',').map(Number);
            const minLat = Math.min(lat1, lat2);
            const maxLat = Math.max(lat1, lat2);
            const minLng = Math.min(lng1, lng2);
            const maxLng = Math.max(lng1, lng2);
            
            whereClause = 'WHERE r.lat BETWEEN ? AND ? AND r.lng BETWEEN ? AND ?';
            queryParams = [minLat, maxLat, minLng, maxLng];
          }
          
          const stmt = env.DB.prepare(`
            SELECT 
              COALESCE(r.kakao_place_id, 'no_id_' || r.id) as group_key,
              r.kakao_place_id,
              r.name,
              r.address,
              r.lat,
              r.lng,
              AVG(r.rating) as avg_rating,
              COUNT(*) as review_count,
              MAX(r.updated_at) as latest_update
            FROM restaurants r
            LEFT JOIN users u ON r.user_id = u.id
            ${whereClause}
            GROUP BY COALESCE(r.kakao_place_id, 'no_id_' || r.id), r.name, r.address, r.lat, r.lng
            ORDER BY latest_update DESC
          `);
          
          const { results: groupedResults } = queryParams.length > 0 
            ? await stmt.bind(...queryParams).all()
            : await stmt.all();
          
          // 각 그룹의 상세 리뷰 정보 가져오기
          const processedResults = [];
          for (const group of groupedResults) {
            let reviewsStmt;
            let reviewsParams;
            
            let reviewsWhereClause = '';
            if (group.kakao_place_id) {
              reviewsWhereClause = 'WHERE r.kakao_place_id = ?';
              reviewsParams = [group.kakao_place_id];
            } else {
              reviewsWhereClause = 'WHERE r.kakao_place_id IS NULL AND r.name = ? AND r.address = ? AND r.lat = ? AND r.lng = ?';
              reviewsParams = [group.name, group.address, group.lat, group.lng];
            }
            
            // bounds 필터링 추가
            if (bounds) {
              const [lat1, lng1, lat2, lng2] = bounds.split(',').map(Number);
              const minLat = Math.min(lat1, lat2);
              const maxLat = Math.max(lat1, lat2);
              const minLng = Math.min(lng1, lng2);
              const maxLng = Math.max(lng1, lng2);
              
              reviewsWhereClause += ' AND r.lat BETWEEN ? AND ? AND r.lng BETWEEN ? AND ?';
              reviewsParams.push(minLat, maxLat, minLng, maxLng);
            }
            
            reviewsStmt = env.DB.prepare(`
              SELECT r.*, u.nickname 
              FROM restaurants r 
              LEFT JOIN users u ON r.user_id = u.id 
              ${reviewsWhereClause}
              ORDER BY r.created_at DESC
            `);
            
            const { results: reviews } = await reviewsStmt.bind(...reviewsParams).all();
            
            // 첫 번째 리뷰에서 카테고리 정보 가져오기
            const category = reviews.length > 0 ? reviews[0].category : null;
            
            processedResults.push({
              ...group,
              category: category,
              reviews: reviews
            });
          }
          
          return new Response(JSON.stringify(processedResults), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 맛집 등록
      if (path === '/api/restaurants' && method === 'POST') {
        const data = await request.json();
        const { name, address, lat, lng, rating, review, userId, kakaoPlaceId, category } = data;
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'User ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const stmt = env.DB.prepare(`
          INSERT INTO restaurants (name, address, lat, lng, rating, review, user_id, kakao_place_id, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = await stmt.bind(name, address, lat, lng, rating, review, userId, kakaoPlaceId, category || null).run();
        
        return new Response(JSON.stringify({ 
          id: result.meta.last_row_id,
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 맛집 수정
      if (path.startsWith('/api/restaurants/') && method === 'PUT') {
        const id = path.split('/')[3];
        const data = await request.json();
        const { name, address, lat, lng, rating, review, userId, kakaoPlaceId, category } = data;
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'User ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 소유권 확인
        const restaurant = await env.DB.prepare('SELECT user_id FROM restaurants WHERE id = ?')
          .bind(id).first();
        
        if (!restaurant) {
          return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (restaurant.user_id !== userId) {
          return new Response(JSON.stringify({ error: 'Permission denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const stmt = env.DB.prepare(`
          UPDATE restaurants 
          SET name = ?, address = ?, lat = ?, lng = ?, rating = ?, review = ?, 
              kakao_place_id = ?, category = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        
        await stmt.bind(name, address, lat, lng, rating, review, kakaoPlaceId, category || null, id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 맛집 삭제
      if (path.startsWith('/api/restaurants/') && method === 'DELETE') {
        const pathParts = path.split('/');
        const id = pathParts[3];
        const userId = pathParts[4]; // /api/restaurants/{id}/{userId} 형태로 가정
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'User ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 소유권 확인
        const restaurant = await env.DB.prepare('SELECT user_id FROM restaurants WHERE id = ?')
          .bind(id).first();
        
        if (!restaurant) {
          return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (restaurant.user_id !== parseInt(userId)) {
          return new Response(JSON.stringify({ error: 'Permission denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const stmt = env.DB.prepare('DELETE FROM restaurants WHERE id = ?');
        await stmt.bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 카카오 장소검색 API 프록시
      if (path === '/api/search-place' && method === 'POST') {
        const data = await request.json();
        const { query } = data;
        
        if (!query || !query.trim()) {
          return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // API 키 확인
        if (!env.VITE_KAKAO_API_KEY) {
          return new Response(JSON.stringify({ 
            error: 'Kakao API key not configured',
            details: 'VITE_KAKAO_API_KEY environment variable is missing' 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          console.log('Calling Kakao API with query:', query);
          
          const kakaoResponse = await fetch(
            `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
            {
              headers: {
                'Authorization': `KakaoAK ${env.VITE_KAKAO_API_KEY}`
              }
            }
          );

          console.log('Kakao API response status:', kakaoResponse.status);

          if (!kakaoResponse.ok) {
            const errorText = await kakaoResponse.text();
            console.log('Kakao API error response:', errorText);
            throw new Error(`Kakao API error: ${kakaoResponse.status} - ${errorText}`);
          }

          const kakaoData = await kakaoResponse.json();
          console.log('Kakao API success, documents count:', kakaoData.documents?.length || 0);
          
          return new Response(JSON.stringify(kakaoData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Search place error:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to search place',
            details: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 사용자 등록
      if (path === '/api/users/register' && method === 'POST') {
        const data = await request.json();
        const { nickname, password } = data;
        
        if (!nickname || !password) {
          return new Response(JSON.stringify({ error: 'Nickname and password are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // 닉네임 중복 확인
          const existingUser = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?')
            .bind(nickname).first();
          
          if (existingUser) {
            return new Response(JSON.stringify({ error: 'Nickname already exists' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // 패스워드 해시화 (간단한 방식, 실제로는 bcrypt 등 사용 권장)
          const passwordHash = await crypto.subtle.digest('SHA-256', 
            new TextEncoder().encode(password + nickname)
          );
          const hashArray = Array.from(new Uint8Array(passwordHash));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          // 사용자 생성
          const result = await env.DB.prepare(`
            INSERT INTO users (nickname, password_hash)
            VALUES (?, ?)
          `).bind(nickname, hashHex).run();
          
          return new Response(JSON.stringify({ 
            success: true,
            userId: result.meta.last_row_id,
            nickname: nickname
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('User registration error:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to register user',
            details: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 사용자 로그인/인증
      if (path === '/api/users/login' && method === 'POST') {
        const data = await request.json();
        const { nickname, password } = data;
        
        if (!nickname || !password) {
          return new Response(JSON.stringify({ error: 'Nickname and password are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // 패스워드 해시화
          const passwordHash = await crypto.subtle.digest('SHA-256', 
            new TextEncoder().encode(password + nickname)
          );
          const hashArray = Array.from(new Uint8Array(passwordHash));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          // 사용자 확인
          const user = await env.DB.prepare('SELECT id, nickname FROM users WHERE nickname = ? AND password_hash = ?')
            .bind(nickname, hashHex).first();
          
          if (!user) {
            return new Response(JSON.stringify({ error: 'Invalid nickname or password' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ 
            success: true,
            userId: user.id,
            nickname: user.nickname
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('User login error:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to login',
            details: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 사용자 정보 조회
      if (path.startsWith('/api/users/') && method === 'GET') {
        const nickname = path.split('/')[3];
        
        if (!nickname) {
          return new Response(JSON.stringify({ error: 'Nickname is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const user = await env.DB.prepare('SELECT id, nickname, created_at FROM users WHERE nickname = ?')
            .bind(nickname).first();
          
          if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ 
            success: true,
            user: user
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('User info error:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to get user info',
            details: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 정적 파일 서빙 (API가 아닌 모든 요청)
      if (!path.startsWith('/api/')) {
        try {
          // Static Assets 바인딩 확인 (프로덕션)
          if (env.ASSETS && env.ASSETS.fetch) {
            return await env.ASSETS.fetch(request);
          } else {
            // 로컬 개발: 간단한 fallback
            // 실제로는 wrangler dev 명령이 dist 폴더를 자동으로 서빙해야 함
            
            // SPA 라우팅 지원: 확장자가 없는 경로는 index.html 반환
            if (!path.includes('.') || path === '/') {
              const indexHtml = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>맛집 지도 - Matzip Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script type="module" crossorigin src="/assets/index-ee5438b1.js"></script>
    <link rel="stylesheet" href="/assets/index-a175c48f.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
              return new Response(indexHtml, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            }
            
            // 정적 자산 파일들은 404 반환 (wrangler가 처리해야 함)
            return new Response('Static file not found', { status: 404 });
          }
        } catch (e) {
          // 404가 발생하고 확장자가 없는 경우 SPA 지원을 위해 index.html 반환
          if (e.status === 404 && !path.includes('.')) {
            try {
              if (env.ASSETS && env.ASSETS.fetch) {
                const indexRequest = new Request(new URL('/', request.url), request);
                return await env.ASSETS.fetch(indexRequest);
              } else {
                // fallback HTML
                const indexHtml = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>맛집 지도 - Matzip Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script type="module" crossorigin src="/assets/index-ee5438b1.js"></script>
    <link rel="stylesheet" href="/assets/index-a175c48f.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
                return new Response(indexHtml, {
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
              }
            } catch (indexError) {
              return new Response('Page not found', { status: 404 });
            }
          }
          return new Response('Asset Error: ' + e.message, { status: e.status || 500 });
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};