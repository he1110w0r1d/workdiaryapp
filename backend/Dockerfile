# 后端 Dockerfile
FROM node:18-alpine

# 安装 tzdata 以支持时区设置
RUN apk add --no-cache tzdata

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建必要目录
RUN mkdir -p uploads backup

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["node", "server.js"]
