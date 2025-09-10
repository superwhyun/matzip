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
        const stmt = env.DB.prepare('SELECT * FROM restaurants ORDER BY created_at DESC');
        const { results } = await stmt.all();
        
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 맛집 등록
      if (path === '/api/restaurants' && method === 'POST') {
        const data = await request.json();
        const { name, address, lat, lng, rating, review } = data;
        
        const stmt = env.DB.prepare(`
          INSERT INTO restaurants (name, address, lat, lng, rating, review)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const result = await stmt.bind(name, address, lat, lng, rating, review).run();
        
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
        const { name, address, lat, lng, rating, review } = data;
        
        const stmt = env.DB.prepare(`
          UPDATE restaurants 
          SET name = ?, address = ?, lat = ?, lng = ?, rating = ?, review = ?, 
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        
        await stmt.bind(name, address, lat, lng, rating, review, id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 맛집 삭제
      if (path.startsWith('/api/restaurants/') && method === 'DELETE') {
        const id = path.split('/')[3];
        
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

      // 정적 파일 서빙 (API가 아닌 모든 요청)
      if (!path.startsWith('/api/')) {
        try {
          // Static Assets 바인딩 확인
          if (env.ASSETS && env.ASSETS.fetch) {
            // 프로덕션: 새로운 Static Assets API 사용
            return await env.ASSETS.fetch(request);
          } else {
            // 로컬 개발: 기본 HTML 응답
            const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>맛집 지도 - Matzip Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  </head>
  <body>
    <div id="root">
      <h1>로컬 개발 모드</h1>
      <p>React 앱: <code>npm run dev</code> (포트 5173)</p>
      <p>Worker API: <code>npx wrangler dev</code> (포트 8787)</p>
      <p>React 앱에서 이 Worker API를 호출합니다.</p>
    </div>
  </body>
</html>`;
            return new Response(html, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
        } catch (e) {
          // 404가 발생하고 확장자가 없는 경우 SPA 지원을 위해 index.html 반환
          if (e.status === 404 && !path.includes('.')) {
            try {
              if (env.ASSETS && env.ASSETS.fetch) {
                const indexRequest = new Request(new URL('/', request.url), request);
                return await env.ASSETS.fetch(indexRequest);
              }
            } catch (indexError) {
              // fallback
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