import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dbHelper, saveDatabase } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { isSafeUrl } from '../services/meta-scraper.js';
import { randomUUID } from 'crypto';

export default async function aiRoutes(fastify: FastifyInstance) {
  // 1. 获取 AI 配置（需要登录鉴权，杜绝未授权敏感配置暴露）
  fastify.get('/api/ai/settings', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const settingsRows = dbHelper.all('SELECT key, value FROM ai_settings');
    const settings: Record<string, any> = {
      api_key: '',
      base_url: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      writing_model: 'deepseek-chat',
      bookmark_model: 'gpt-5.5',
      system_prompt: '你是一个知识渊博、高效简洁的智能全能助理。你精通各种编程语言、工具推荐、效率技巧以及文章写作。',
      available_models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 4096,
      reasoning_mode: false,
    };
    for (const row of settingsRows) {
      if (row.key === 'api_key') {
        settings.has_api_key = row.value ? 'true' : 'false';
        // 掩码显示 key
        settings.api_key_masked = row.value ? `${row.value.slice(0, 4)}••••••••${row.value.slice(-4)}` : '';
      } else if (row.key === 'all_models') {
        try {
          settings.all_models = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        } catch {
          settings.all_models = [];
        }
      } else if (row.key === 'available_models') {
        try {
          settings.available_models = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        } catch {
          settings.available_models = [settings.model || 'deepseek-chat'];
        }
      } else if (row.key === 'temperature' || row.key === 'top_p' || row.key === 'max_tokens') {
        settings[row.key] = Number(row.value);
      } else if (row.key === 'reasoning_mode') {
        settings[row.key] = row.value === 'true' || row.value === true;
      } else {
        settings[row.key] = row.value;
      }
    }
    if (!settings.model || !String(settings.model).trim()) {
      settings.model = (settings.available_models && settings.available_models[0]) || 'gpt-5.5';
    }
    if (!settings.writing_model || !String(settings.writing_model).trim()) {
      settings.writing_model = settings.model || 'deepseek-chat';
    }
    if (!settings.bookmark_model || !String(settings.bookmark_model).trim()) {
      settings.bookmark_model = settings.model || 'gpt-5.5';
    }
    return reply.send({ settings });
  });

  // 2. 更新 AI 配置（需要登录）
  fastify.post('/api/ai/settings', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const { api_key, base_url, model, writing_model, bookmark_model, system_prompt, available_models, all_models, temperature, top_p, max_tokens, reasoning_mode } = body;

    if (api_key !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['api_key', api_key]);
    }
    if (base_url !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['base_url', base_url]);
    }
    if (model !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['model', model]);
    }
    if (writing_model !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['writing_model', writing_model]);
    }
    if (bookmark_model !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['bookmark_model', bookmark_model]);
    }
    if (system_prompt !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['system_prompt', system_prompt]);
    }
    if (all_models !== undefined) {
      const allStr = typeof all_models === 'string' ? all_models : JSON.stringify(all_models);
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['all_models', allStr]);
    }
    if (available_models !== undefined) {
      const modelsStr = typeof available_models === 'string' ? available_models : JSON.stringify(available_models);
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['available_models', modelsStr]);
    }
    if (temperature !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['temperature', String(temperature)]);
    }
    if (top_p !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['top_p', String(top_p)]);
    }
    if (max_tokens !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['max_tokens', String(max_tokens)]);
    }
    if (reasoning_mode !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', ['reasoning_mode', String(reasoning_mode)]);
    }

    saveDatabase();
    return reply.send({ success: true });
  });

  // 2.1 一键在线读取大模型列表
  fastify.post('/api/ai/fetch-models', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    let baseUrl = body.base_url;
    let apiKey = body.api_key;

    if (!baseUrl) {
      const row = dbHelper.get("SELECT value FROM ai_settings WHERE key = 'base_url'");
      baseUrl = row?.value || 'https://api.deepseek.com/v1';
    }
    if (!apiKey) {
      const row = dbHelper.get("SELECT value FROM ai_settings WHERE key = 'api_key'");
      apiKey = row?.value || '';
    }

    baseUrl = (baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    const targetUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

    if (!isSafeUrl(targetUrl)) {
      return reply.status(400).send({ error: '目标 AI 接口地址不合法或属于受保护的私有网段/环回地址' });
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const txt = await res.text();
        return reply.status(res.status).send({ error: `接口响应异常 (${res.status}): ${txt.slice(0, 150)}` });
      }

      const data = await res.json();
      let models: string[] = [];
      if (Array.isArray(data.data)) {
        models = data.data.map((m: any) => m.id).filter(Boolean);
      } else if (Array.isArray(data.models)) {
        models = data.models.map((m: any) => m.name || m.id || m).filter(Boolean);
      }

      models = Array.from(new Set(models)).sort();
      if (models.length === 0) {
        return reply.status(400).send({ error: '未能从返回数据中解析到可用模型列表' });
      }

      return reply.send({ models });
    } catch (err: any) {
      return reply.status(500).send({ error: `获取模型列表失败: ${err.message || err}` });
    }
  });

  // 2.1 获取所有项目
  fastify.get('/api/ai/projects', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const projects = dbHelper.all('SELECT id, name, icon, description, created_at, updated_at FROM ai_projects ORDER BY updated_at DESC, created_at DESC');
    return reply.send({ projects });
  });

  // 2.2 创建项目
  fastify.post('/api/ai/projects', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const id = body.id || randomUUID();
    const name = (body.name || '').trim();
    if (!name) {
      return reply.status(400).send({ error: '项目名称不能为空' });
    }
    const icon = body.icon || 'pi pi-folder';
    const description = body.description || '';
    const now = new Date().toISOString();

    dbHelper.run(
      'INSERT INTO ai_projects (id, name, icon, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, icon, description, now, now]
    );
    saveDatabase();
    const proj = dbHelper.get('SELECT * FROM ai_projects WHERE id = ?', [id]);
    return reply.status(201).send({ project: proj });
  });

  // 2.3 更新项目
  fastify.put('/api/ai/projects/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const { name, icon, description } = body;
    const now = new Date().toISOString();

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return reply.status(400).send({ error: '项目名称不能为空' });
      dbHelper.run('UPDATE ai_projects SET name = ?, updated_at = ? WHERE id = ?', [trimmed, now, id]);
    }
    if (icon !== undefined) {
      dbHelper.run('UPDATE ai_projects SET icon = ?, updated_at = ? WHERE id = ?', [icon, now, id]);
    }
    if (description !== undefined) {
      dbHelper.run('UPDATE ai_projects SET description = ?, updated_at = ? WHERE id = ?', [description, now, id]);
    }
    saveDatabase();
    const proj = dbHelper.get('SELECT * FROM ai_projects WHERE id = ?', [id]);
    return reply.send({ success: true, project: proj });
  });

  // 2.4 删除项目（同时将所属会话的 project_id 清空）
  fastify.delete('/api/ai/projects/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    dbHelper.run('UPDATE ai_conversations SET project_id = NULL WHERE project_id = ?', [id]);
    dbHelper.run('DELETE FROM ai_projects WHERE id = ?', [id]);
    saveDatabase();
    return reply.send({ success: true });
  });

  // 3. 获取所有会话（置顶优先、按最新活动时间倒序排序）
  fastify.get('/api/ai/conversations', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { project_id, is_archived } = (request.query as any) || {};
    let sql = 'SELECT id, title, model, role_id, icon, project_id, is_pinned, is_archived, created_at, updated_at FROM ai_conversations';
    const params: any[] = [];
    const where: string[] = [];
    if (project_id) {
      where.push('project_id = ?');
      params.push(project_id);
    }
    if (is_archived !== undefined) {
      where.push('is_archived = ?');
      params.push(Number(is_archived));
    }
    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }
    sql += ' ORDER BY is_pinned DESC, updated_at DESC, created_at DESC';
    const conversations = dbHelper.all(sql, params);
    return reply.send({ conversations });
  });

  // 4. 创建新会话
  fastify.post('/api/ai/conversations', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const id = body.id || randomUUID();
    const title = body.title || '新对话';
    const model = body.model || 'deepseek-chat';
    const role_id = body.role_id || 'default';
    const icon = body.icon || '';
    const project_id = body.project_id || null;
    const is_pinned = body.is_pinned ? 1 : 0;
    const is_archived = body.is_archived ? 1 : 0;
    const now = new Date().toISOString();

    dbHelper.run(
      'INSERT INTO ai_conversations (id, title, model, role_id, icon, project_id, is_pinned, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, model, role_id, icon, project_id, is_pinned, is_archived, now, now]
    );
    saveDatabase();

    const conv = dbHelper.get('SELECT * FROM ai_conversations WHERE id = ?', [id]);
    return reply.status(201).send({ conversation: conv });
  });

  // 4.1 更新会话（重命名标题 / 角色 / 模型 / 图标 / 项目归属 / 置顶 / 归档）
  fastify.put('/api/ai/conversations/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const { title, role_id, model, icon, project_id, is_pinned, is_archived } = body;
    const now = new Date().toISOString();

    if (title !== undefined) {
      dbHelper.run('UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?', [title, now, id]);
    }
    if (icon !== undefined) {
      dbHelper.run('UPDATE ai_conversations SET icon = ?, updated_at = ? WHERE id = ?', [icon, now, id]);
    }
    if (role_id !== undefined) {
      dbHelper.run('UPDATE ai_conversations SET role_id = ?, updated_at = ? WHERE id = ?', [role_id, now, id]);
    }
    if (model !== undefined) {
      dbHelper.run('UPDATE ai_conversations SET model = ?, updated_at = ? WHERE id = ?', [model, now, id]);
    }
    if (project_id !== undefined) {
      dbHelper.run('UPDATE ai_conversations SET project_id = ?, updated_at = ? WHERE id = ?', [project_id || null, now, id]);
    }
    if (is_pinned !== undefined) {
      dbHelper.run('UPDATE ai_conversations SET is_pinned = ?, updated_at = ? WHERE id = ?', [is_pinned ? 1 : 0, now, id]);
    }
    if (is_archived !== undefined) {
      dbHelper.run('UPDATE ai_conversations SET is_archived = ?, updated_at = ? WHERE id = ?', [is_archived ? 1 : 0, now, id]);
    }
    saveDatabase();
    const conv = dbHelper.get('SELECT * FROM ai_conversations WHERE id = ?', [id]);
    return reply.send({ success: true, conversation: conv });
  });

  // 5. 删除会话
  fastify.delete('/api/ai/conversations/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    dbHelper.run('DELETE FROM ai_messages WHERE conversation_id = ?', [id]);
    dbHelper.run('DELETE FROM ai_conversations WHERE id = ?', [id]);
    saveDatabase();
    return reply.send({ success: true });
  });

  // 6. 清空所有会话
  fastify.post('/api/ai/conversations/clear', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    dbHelper.run('DELETE FROM ai_messages');
    dbHelper.run('DELETE FROM ai_conversations');
    saveDatabase();
    return reply.send({ success: true });
  });

  // 7. 获取某会话的消息历史
  fastify.get('/api/ai/conversations/:id/messages', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const messages = dbHelper.all('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC', [id]);
    return reply.send({ messages });
  });

  // 7.1 编辑某条消息
  fastify.put('/api/ai/messages/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const { content } = body;
    if (content !== undefined) {
      dbHelper.run('UPDATE ai_messages SET content = ? WHERE id = ?', [content, id]);
      saveDatabase();
    }
    const msg = dbHelper.get('SELECT * FROM ai_messages WHERE id = ?', [id]);
    return reply.send({ success: true, message: msg });
  });

  // 7.2 删除某条消息
  fastify.delete('/api/ai/messages/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    dbHelper.run('DELETE FROM ai_messages WHERE id = ?', [id]);
    saveDatabase();
    return reply.send({ success: true });
  });

  // 8. 流式对话接口 (SSE / Streaming Completion，支持私密模式不留痕)
  fastify.post('/api/ai/chat', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    let {
      conversation_id,
      message,
      stream = true,
      custom_prompt,
      model: requestModel,
      role_id,
      temperature,
      top_p,
      max_tokens,
      is_private = false,
      history: clientHistory = [],
    } = body;

    if (!message || !message.trim()) {
      return reply.status(400).send({ error: '消息内容不能为空' });
    }

    const now = new Date().toISOString();

    if (!is_private) {
      // 若无会话 ID，自动新建一个会话
      let conversation: any = null;
      if (conversation_id) {
        conversation = dbHelper.get('SELECT * FROM ai_conversations WHERE id = ?', [conversation_id]);
      }

      if (!conversation) {
        conversation_id = randomUUID();
        const title = message.trim().slice(0, 20) + (message.length > 20 ? '...' : '');
        dbHelper.run(
          'INSERT INTO ai_conversations (id, title, model, role_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [conversation_id, title, requestModel || 'deepseek-chat', role_id || 'default', '', now, now]
        );
      } else {
        // 无论是否是新会话，只要发送消息就刷新 updated_at 与 role_id
        const title = conversation.title === '新对话'
          ? (message.trim().slice(0, 20) + (message.length > 20 ? '...' : ''))
          : conversation.title;

        dbHelper.run(
          'UPDATE ai_conversations SET title = ?, updated_at = ?, role_id = COALESCE(?, role_id), model = COALESCE(?, model) WHERE id = ?',
          [title, now, role_id || null, requestModel || null, conversation_id]
        );
      }

      // 保存用户消息
      const userMsgTime = new Date().toISOString();
      dbHelper.run(
        'INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
        [conversation_id, 'user', message, userMsgTime]
      );
      saveDatabase();
    } else {
      if (!conversation_id) {
        conversation_id = 'private_' + randomUUID();
      }
    }

    // 读取 AI 设置
    const keyRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['api_key']);
    const urlRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['base_url']);
    const modelRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['model']);
    const promptRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['system_prompt']);

    const apiKey = keyRow?.value || process.env.OPENAI_API_KEY || '';
    const baseUrl = urlRow?.value || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1';
    const model = requestModel || modelRow?.value || 'deepseek-chat';
    const systemPrompt = custom_prompt || promptRow?.value || '你是一个知识渊博、高效简洁的智能全能助理。';

    let messages: any[] = [];
    if (is_private) {
      const hist = Array.isArray(clientHistory) ? clientHistory.slice(-20) : [];
      messages = [
        { role: 'system', content: systemPrompt },
        ...hist.map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ];
    } else {
      // 取该会话最近 20 条历史消息
      const history = dbHelper.all(
        'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 20',
        [conversation_id]
      );
      messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m: any) => ({ role: m.role, content: m.content })),
      ];
    }

    // 设置 SSE Header 并立刻下发 Header 建立真实双向流
    reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    // 如果用户配置了 API Key，调用真实大模型接口
    if (apiKey) {
      try {
        const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
        const targetUrl = cleanBaseUrl.endsWith('/chat/completions')
          ? cleanBaseUrl
          : `${cleanBaseUrl}/chat/completions`;

        const llmPayload: any = {
          model,
          messages,
          stream: true,
        };
        if (typeof temperature === 'number') llmPayload.temperature = temperature;
        if (typeof top_p === 'number') llmPayload.top_p = top_p;
        if (typeof max_tokens === 'number' && max_tokens > 0) llmPayload.max_tokens = max_tokens;

        const upstreamAbortController = new AbortController();
        request.raw.on('close', () => {
          if (!upstreamAbortController.signal.aborted) {
            upstreamAbortController.abort();
          }
        });

        const response = await fetch(targetUrl, {
          method: 'POST',
          signal: upstreamAbortController.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(llmPayload),
        });
        if (!response.ok) {
          const errText = await response.text();
          const errData = `AI 服务响应错误 (${response.status}): ${errText}`;
          reply.raw.write(`data: ${JSON.stringify({ text: errData, conversation_id })}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullAiText = '';

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                reply.raw.write('data: [DONE]\n\n');
                continue;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  fullAiText += delta;
                  reply.raw.write(`data: ${JSON.stringify({ text: delta, conversation_id })}\n\n`);
                }
              } catch {
                // ignore chunk parse error
              }
            }
          }
        }

        // 保存完整 AI 回复（私密模式不落库）
        if (fullAiText && !is_private) {
          dbHelper.run(
            'INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
            [conversation_id, 'assistant', fullAiText, new Date().toISOString()]
          );
          dbHelper.run('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [
            new Date().toISOString(),
            conversation_id,
          ]);
          saveDatabase();
        }

        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } catch (err: any) {
        reply.raw.write(`data: ${JSON.stringify({ text: `\n\n[连接大模型 API 异常: ${err.message}]`, conversation_id })}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      }
    } else {
      // 若未配置 API Key，提供高质量即时交互演示与提示
      const mockResponses = generateMockResponse(message);
      let fullMockText = '';

      for (const chunk of mockResponses) {
        fullMockText += chunk;
        reply.raw.write(`data: ${JSON.stringify({ text: chunk, conversation_id })}\n\n`);
        await new Promise(r => setTimeout(r, 45));
      }

      // 保存模拟回复（私密模式不落库）
      if (!is_private) {
        dbHelper.run(
          'INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
          [conversation_id, 'assistant', fullMockText, new Date().toISOString()]
        );
        dbHelper.run('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [
          new Date().toISOString(),
          conversation_id,
        ]);
        saveDatabase();
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
  });

  // 9. 笔记专享 AI 智能写作协同助手 (流式 SSE)
  fastify.post('/api/ai/writing-assistant', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const { action = 'continue', content = '', context = '', instruction = '', model: requestModel } = body;

    if (!content && !context && action !== 'continue') {
      return reply.status(400).send({ error: '内容不能为空' });
    }

    // 读取 AI 配置
    const keyRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['api_key']);
    const urlRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['base_url']);
    const modelRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['model']);
    const writingModelRow = dbHelper.get('SELECT value FROM ai_settings WHERE key = ?', ['writing_model']);

    const apiKey = keyRow?.value || process.env.OPENAI_API_KEY || '';
    const baseUrl = urlRow?.value || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1';
    const model = requestModel || writingModelRow?.value || modelRow?.value || 'deepseek-chat';

    const { system, userInstruction } = getWritingPrompt(action, instruction);
    const userMessageContent = context
      ? `${userInstruction}\n\n【前文背景】:\n${context}\n\n【待处理文本】:\n${content}`
      : `${userInstruction}\n\n${content}`;

    reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    if (apiKey) {
      try {
        const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
        const targetUrl = cleanBaseUrl.endsWith('/chat/completions')
          ? cleanBaseUrl
          : `${cleanBaseUrl}/chat/completions`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        request.raw.on('close', () => {
          if (!controller.signal.aborted) {
            controller.abort();
          }
        });

        const upstreamRes = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userMessageContent },
            ],
            stream: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!upstreamRes.ok) {
          const errBody = await upstreamRes.text();
          reply.raw.write(`data: ${JSON.stringify({ error: `大模型请求异常 (${upstreamRes.status}): ${errBody}` })}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
          return;
        }

        const reader = upstreamRes.body?.getReader();
        const decoder = new TextDecoder('utf-8');

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                reply.raw.write('data: [DONE]\n\n');
                continue;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  reply.raw.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
                }
              } catch {}
            }
          }
        }
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } catch (err: any) {
        reply.raw.write(`data: ${JSON.stringify({ error: `生成中断或失败: ${err.message}` })}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      }
    } else {
      // 模拟智能写作助手回复
      const mockChunks = generateMockWritingResponse(action, content, instruction);
      for (const chunk of mockChunks) {
        reply.raw.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 20));
      }
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
  });
}

function getWritingPrompt(action: string, instruction?: string): { system: string; userInstruction: string } {
  switch (action) {
    case 'continue':
      return {
        system: '你是一个专业的写作续写专家。请根据用户提供的上文内容，自然流畅地接着构思并续写后续内容。请直接输出续写的正文文本，不要包含任何客套话、解释或前缀说明。保持与上文的语言风格、语气和格式一致。',
        userInstruction: '请接着以下内容继续往下写：',
      };
    case 'polish':
      return {
        system: '你是一个顶级文字润色编辑。请对用户的文本进行专业润色，优化语句表达、消除错别字和语病，使行文更加优雅、流畅、清晰。请直接输出润色后的完整文本，不要输出任何多余的解释、修改说明或前后对比。',
        userInstruction: '请润色优化以下文字：',
      };
    case 'summarize':
      return {
        system: '你是一个高效的内容提炼专家。请为用户的文章/笔记提炼一份清晰的核心摘要与 Markdown 结构化要点大纲。直接输出摘要和大纲内容，使用 Markdown 格式。',
        userInstruction: '请为以下内容提取摘要与结构化要点大纲：',
      };
    case 'title':
      return {
        system: '你是一个专业的标题起名专家。请阅读用户提供的笔记内容，为其提炼一个简明扼要、高度概括的标题（通常在 4 到 15 个字之间）。直接输出标题文本本身，不要带书名号、引号或任何解释说明。',
        userInstruction: '请为以下内容提炼一个最佳标题：',
      };
    case 'translate':
      return {
        system: '你是一个精通多语言的专业翻译家。若输入是中文请翻译为地道自然的英文；若输入是英文或其他语言请翻译为地道流畅的中文。直接输出翻译结果，不要输出任何解释或注记。',
        userInstruction: '请翻译以下内容：',
      };
    case 'expand':
      return {
        system: '你是一个深度内容创作专家。请在忠实于原文核心观点的前提下，对用户的文本进行扩写，丰富论据、细节、逻辑链条和实际案例。直接输出扩写后的文本，保持清晰结构。',
        userInstruction: '请扩写以下内容，丰富细节和要点：',
      };
    case 'shorten':
      return {
        system: '你是一个极致精简的文字编辑。请在保留全部关键信息的前提下，大幅精简压缩用户文本，剔除冗词赘字，直击核心。直接输出精简后的文本。',
        userInstruction: '请精简以下内容：',
      };
    case 'to_table':
      return {
        system: '你是一个数据结构化专家。请将用户文本中的属性、数据或对比要点整理为排版规范整齐的 Markdown 表格。直接输出 Markdown 表格，不要包含其他解释。',
        userInstruction: '请将以下内容整理为 Markdown 规范表格：',
      };
    case 'to_tasks':
      return {
        system: '你是一个项目管理与行动力专家。请从用户文本中提炼出所有可执行的行动项与待办事项，输出为标准的 Markdown `- [ ] ` 待办任务清单。直接输出任务清单。',
        userInstruction: '请从以下内容提炼为 `- [ ] ` 待办清单：',
      };
    case 'tags':
      return {
        system: '你是一个专业的文章与笔记标签分类专家。请阅读用户提供的文章标题和内容，为其生成 2 到 4 个最切合主题、简短精准的文章标签。请直接以 JSON 字符串数组格式输出（例如：["技术", "Vue3", "前端"]），不要输出任何 markdown 格式包裹、解释、书名号或任何多余文字。',
        userInstruction: '请为以下笔记内容提取 2 到 4 个关键标签（仅返回 JSON 数组）：',
      };
    case 'title_and_tags':
      return {
        system: '你是一个专业的文章与笔记提炼专家。请阅读用户提供的笔记正文，为其提炼一个简明扼要的标题（4到15字）以及2到4个最相关的关键文章标签。请严格直接以标准 JSON 对象格式输出（例如：{"title": "高效协作工作流指南", "tags": ["架构设计", "知识库", "效率提升"]}），不要包含任何 markdown 标记、解释或多余字符。',
        userInstruction: '请为以下笔记内容生成最佳标题与标签（仅返回标准 JSON 对象）：',
      };
    case 'custom':
    default:
      return {
        system: '你是一个高效、精准的智能写作助手。请严格按照用户的具体要求对文本进行处理。直接输出处理后的结果，不要包含任何多余的废话。',
        userInstruction: instruction ? `要求：${instruction}\n\n内容：` : '请处理以下内容：',
      };
  }
}

function generateMockWritingResponse(action: string, content: string, instruction?: string): string[] {
  let full = '';
  switch (action) {
    case 'continue':
      full = '\n\n结合上述规划，接下来的实施步骤应当聚焦于核心模块的解耦与性能压测。首先，通过引入响应式数据流与本地持久化缓存，确保在弱网或离线状态下的交互可用性；其次，对高频变更事件建立自适应防抖机制，从而在保障用户操作平滑度的同时最大化减轻服务器吞吐负载。';
      break;
    case 'polish':
      full = content.trim() ? `✨ 润色优化后：\n${content.replace(/的/g, '之').replace(/很/g, '极为')}\n\n通过对句式结构的重新梳理，强化了段落之间的逻辑递进关系，行文更具专业度与说服力。` : '暂无待润色内容。';
      break;
    case 'summarize':
      full = `### 📋 核心要点与大纲概览\n\n- **核心主旨**：围绕高效敏捷的数字化工作流展开系统化构建。\n- **关键行动项**：\n  1. 完成核心业务逻辑与 UI 层的解耦优化；\n  2. 建立端到端的数据一致性同步与安全加密通道；\n  3. 完善异常处理与无缝降级策略。\n\n> 💡 *提示*：在系统设置配置 API Key 即可体验完整云端深度大模型！`;
      break;
    case 'title':
      full = '高效工程架构与沉浸式协作指南';
      break;
    case 'translate':
      full = content.trim() ? `【翻译结果】\nAn efficient, clean, and modern workspace designed for seamless cross-device productivity and structured knowledge management.` : 'Please provide content to translate.';
      break;
    case 'expand':
      full = `${content}\n\n此外，从工程落地与最佳实践的维度深入考量，我们还需要关注以下关键支撑点：\n1. **容错机制与边界防护**：对所有外部输入与异步调用建立完善的超时拦截与回滚策略；\n2. **用户体验与感知性能**：通过骨架屏与打字机动效提升主观响应速度；\n3. **多端协同一致性**：依托轻量级序列化协议保障跨设备流转的一致性。`;
      break;
    case 'shorten':
      full = content.slice(0, Math.max(30, Math.floor(content.length / 2))) + '...（核心已提炼）';
      break;
    case 'to_table':
      full = `\n| 维度 | 特性指标 | 实施状态 |\n| :--- | :--- | :--- |\n| 交互体验 | 丝滑流式响应 | ✅ 已就绪 |\n| 数据安全 | 端到端加密与防泄漏 | ✅ 已完成 |\n| 多端适配 | 响应式双栏与抽屉 | ✅ 已优化 |\n`;
      break;
    case 'to_tasks':
      full = `\n- [ ] 审查并确认核心模块边界与依赖\n- [ ] 验证端到端流式数据流与网络容错\n- [ ] 完成全量单元测试与打包构建\n`;
      break;
    case 'tags':
      full = '["前端开发", "知识库", "效率提升"]';
      break;
    case 'title_and_tags':
      full = '{"title": "高效数字化工作流构建指南", "tags": ["架构设计", "知识库", "效率工具"]}';
      break;
    case 'custom':
    default:
      full = `已根据指令「${instruction || '智能处理'}」完成处理：\n\n${content}\n\n> 💡 系统已针对当前笔记上下文完成针对性重构。`;
      break;
  }

  const chunks: string[] = [];
  for (let i = 0; i < full.length; i += 3) {
    chunks.push(full.slice(i, i + 3));
  }
  return chunks;
}

function generateMockResponse(prompt: string): string[] {
  const p = prompt.toLowerCase();
  let full = '';

  if (p.includes('总结') || p.includes('书签') || p.includes('网站')) {
    full = `### 🌐 网站智能解析与推荐\n\n针对你提及的内容，为你整理如下核心概览：\n\n1. **核心价值**：提供高效、敏捷的在线服务体系，大幅提升日常工作流效率。\n2. **同类优质工具推荐**：\n   - **Devv.ai / Perplexity**：新一代 AI 搜索引擎\n   - **v0.dev**：UI 界面生成与原型构建\n   - **DeepSeek**：高性价比推理与代码大模型\n\n> 💡 *提示*：你可以在「系统设置」中配置你自己的 **DeepSeek / OpenAI API Key**，即可开启完整大模型实时联网推理能力！点击右上角可将此回复一键转存为在线笔记。`;
  } else if (p.includes('代码') || p.includes('vue') || p.includes('js') || p.includes('python')) {
    full = `### 💻 编程与代码实现示例\n\n为你提供一份高效、干净的代码实现：\n\n\`\`\`typescript\n// 示例：轻量异步流式请求处理器\nexport async function streamChat(prompt: string, onChunk: (text: string) => void) {\n  const res = await fetch('/api/ai/chat', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ message: prompt }),\n  });\n  \n  const reader = res.body?.getReader();\n  const decoder = new TextDecoder();\n  \n  while (reader) {\n    const { done, value } = await reader.read();\n    if (done) break;\n    onChunk(decoder.decode(value));\n  }\n}\n\`\`\`\n\n- 代码遵循现代 ES2022+ 规范，结构轻量且无冗余依赖。`;
  } else {
    full = `你好！我是 **ZenLink / 不凡智能助理** 🤖。\n\n我支持与当前站点的 **网址导航**、**在线笔记** 和 **传输助手** 深度联动：\n\n- 🔍 **书签解析**：输入网址或点击书签卡片，快速获取网站介绍与同类工具推荐。\n- 📝 **灵感记录**：随时点击右上角 **「转存为笔记」**，将对话直接存入你的在线笔记。\n- 🚀 **文件与文本**：协助解析传输过来的代码片段与格式转换。\n\n> ⚙️ **配置提示**：前往左下角 **「系统设置」** 填入你的 DeepSeek / OpenAI API Key，即可接入最新云端大模型！`;
  }

  // 分块切片模拟流式打字机
  const chunks: string[] = [];
  for (let i = 0; i < full.length; i += 3) {
    chunks.push(full.slice(i, i + 3));
  }
  return chunks;
}
