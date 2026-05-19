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

        // 【核心安全】KV 数据库中依然存储完整的私钥，绝对不能打星号！
        const data = { privateKey, pattern, createdAt: new Date().toISOString() };
        await env.kv.put(address, JSON.stringify(data));

        // [新增逻辑] 推送通知到 Telegram 机器人
        if (env.TG_BOT_TOKEN && env.TG_CHAT_ID) {
          
          // 新增：脱敏打星号函数 (保留前6位和后6位，中间全部变 ****)
          const maskString = (str, showStart = 6, showEnd = 6) => {
            if (!str || str.length <= showStart + showEnd) return str;
            return str.slice(0, showStart) + '****' + str.slice(-showEnd);
          };

          // 对发往 TG 的地址和私钥进行脱敏处理
          const maskedAddress = maskString(address, 6, 6);
          const maskedPrivateKey = maskString(privateKey, 6, 6);

          const tgUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`;
          // 这里使用的是加了星号的变量 maskedAddress 和 maskedPrivateKey
          const textMsg = `🎉 **发现 TRON 极品靓号！**\n\n🎯 匹配规则: ${pattern}\n🪪 地址: \`${maskedAddress}\`\n🔑 私钥: \`${maskedPrivateKey}\`\n⏱️ 时间: ${data.createdAt}\n\n*(完整私钥已安全存入云端 KV)*`;
          
          const tgRequest = fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: env.TG_CHAT_ID, 
              text: textMsg, 
              parse_mode: 'Markdown' 
            })
          });
          
          // 使用 waitUntil 让请求在后台执行，不阻塞返回给前端的响应
          ctx.waitUntil(tgRequest);
        }

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

    return env.ASSETS.fetch(request);
  },
};
