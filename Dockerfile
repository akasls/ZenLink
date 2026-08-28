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

# 切换为非 root 用户运行
USER node

# 声明持久化数据卷
VOLUME ["/app/server/data"]

# 暴露统一应用端口
EXPOSE 3000

# 容器健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/settings || exit 1

# 启动服务
CMD ["node", "server/dist/index.js"]
