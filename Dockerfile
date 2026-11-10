FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund
COPY . .
RUN npm run build && mkdir -p .data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=8765 NODE_ENV=production ALLOW_DEMO=false ALLOW_REGISTRATION=true
VOLUME ["/app/.data"]
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8765/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm","start"]
