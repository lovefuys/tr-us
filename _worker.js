export default {
  async fetch(request, env, ctx) {
    // 处理跨域请求 (CORS)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 路由1：保存发现的靓号
    if (url.pathname === '/api/save' && request.method === 'POST') {
      try {
        const { address, privateKey, pattern } = await request.json();
        
        if (!address || !privateKey) {
          return new Response(JSON.stringify({ error: '参数不完整' }), { status: 400, headers: corsHeaders });
        }

        // 存储到 KV，以地址为 Key，包含私钥和匹配规则
        const data = { privateKey, pattern, createdAt: new Date().toISOString() };
        await env.kv.put(address, JSON.stringify(data));

        return new Response(JSON.stringify({ success: true, message: '靓号已成功保存到云端' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 路由2：获取已跑出的靓号列表
    if (url.pathname === '/api/list' && request.method === 'GET') {
      const list = await env.kv.list();
      const results = [];
      
      for (const key of list.keys) {
        const value = await env.kv.get(key.name);
        results.push({ address: key.name, ...JSON.parse(value) });
      }

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
