FROM golang:1.24-alpine AS builder

RUN apk add --no-cache ca-certificates

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /relay .

FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /relay /usr/local/bin/relay

EXPOSE 8788

ENTRYPOINT ["relay"]
CMD ["serve"]
