FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install git and build tools
RUN apk add --no-cache git gcc musl-dev

# Copy go.mod first
COPY go.mod ./

# Initialize module without go.sum
RUN go mod tidy

# Copy all source code
COPY . .

# Clean any existing go.sum and regenerate
RUN rm -f go.sum && \
    GOSUMDB=off GOPROXY=https://proxy.golang.org,direct go mod tidy && \
    GOSUMDB=off GOPROXY=https://proxy.golang.org,direct go mod download

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -v -a -installsuffix cgo -o main .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./main"]