# ==========================================
# 阶段 1: 构建前端和后端 (Build Stage)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖定义
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# 安装所有依赖
RUN npm install

# 复制源码
COPY client/ ./client/
COPY server/ ./server/

# 编译前端和后端
RUN npm run build

# ==========================================
# 阶段 2: 生产运行环境 (Production Runner)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 su-exec 用于安全自动修复宿主机挂载目录权限并降权运行
RUN apk add --no-cache su-exec

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# 复制生产所需的 package.json
COPY server/package.json ./server/

# 在 server 目录安装生产依赖
WORKDIR /app/server
RUN npm install --omit=dev && npm cache clean --force

WORKDIR /app

# 复制编译产物和数据库 Schema
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/schema.sql ./server/dist/db/schema.sql
COPY --from=builder /app/server/src/db/schema.sql ./server/src/db/schema.sql

# 创建数据存储、图标缓存与上传目录并赋予 node 用户权限
RUN mkdir -p /app/server/data /app/server/data/favicons /app/server/data/uploads && \
    chown -R node:node /app

# 复制 entrypoint 启动脚本并赋权
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 声明持久化数据卷
VOLUME ["/app/server/data"]

# 暴露统一应用端口
EXPOSE 3000

# 容器健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/settings || exit 1

# 通过 entrypoint 自动修复挂载权限并降权至 node 用户启动
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server/dist/index.js"]
