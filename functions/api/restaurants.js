export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const stmt = env.DB.prepare('SELECT * FROM restaurants ORDER BY created_at DESC');
    const { results } = await stmt.all();
    
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const { name, address, lat, lng, rating, review } = data;
    
    const stmt = env.DB.prepare(`
      INSERT INTO restaurants (name, address, lat, lng, rating, review)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt.bind(name, address, lat, lng, rating, review).run();
    
    return Response.json({ 
      id: result.meta.last_row_id,
      success: true 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}