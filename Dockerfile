FROM oven/bun:1.4.4-debian AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS development
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev"]

FROM dependencies AS build
COPY . .
RUN bun run build

FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
