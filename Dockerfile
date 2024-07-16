FROM oven/bun:1.1-alpine AS build

WORKDIR /app
COPY . .

RUN bun install
RUN bun compile

FROM ubuntu:22.04

COPY --from=build /app/dist/kubedeploy /usr/local/bin/kubedeploy

EXPOSE 3000

CMD [ "kubedeploy" ]