package httpapi

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/Zijinn/Aurora/internal/domain"
	"github.com/Zijinn/Aurora/internal/storage"
)

type SecurityConfig struct {
	RequireDeviceAuth bool
	AllowedOrigins    []string
}

type deviceContextKey struct{}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.security.RequireDeviceAuth || !strings.HasPrefix(r.URL.Path, "/api/") || publicAPIPath(r.URL.Path) || isLoopbackRemote(r.RemoteAddr) {
			next.ServeHTTP(w, r)
			return
		}
		token := deviceTokenFromRequest(r)
		if token == "" {
			writeProblem(w, r, http.StatusUnauthorized, "authentication_required", "Authentication required", "Pair this device or provide its bearer token.")
			return
		}
		device, err := storage.AuthenticateDevice(r.Context(), s.db, token)
		if err != nil {
			writeProblem(w, r, http.StatusUnauthorized, "invalid_device_token", "Invalid device token", "The device token is invalid or has been revoked.")
			return
		}
		ctx := context.WithValue(r.Context(), deviceContextKey{}, device)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func deviceTokenFromRequest(r *http.Request) string {
	const bearerPrefix = "Bearer "
	authorization := r.Header.Get("Authorization")
	if strings.HasPrefix(authorization, bearerPrefix) {
		return strings.TrimSpace(strings.TrimPrefix(authorization, bearerPrefix))
	}
	if cookie, err := r.Cookie("cairn_device"); err == nil {
		return cookie.Value
	}
	return ""
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}
		if !s.originAllowed(origin, r.Host) {
			writeProblem(w, r, http.StatusForbidden, "origin_not_allowed", "Origin not allowed", "This origin is not trusted by Aurora Server.")
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Add("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) originAllowed(origin, requestHost string) bool {
	parsed, err := url.Parse(origin)
	if err == nil && strings.EqualFold(parsed.Host, requestHost) && (parsed.Scheme == "http" || parsed.Scheme == "https") {
		return true
	}
	for _, allowed := range s.security.AllowedOrigins {
		if origin == strings.TrimRight(strings.TrimSpace(allowed), "/") {
			return true
		}
	}
	return false
}

func publicAPIPath(path string) bool {
	return path == "/api/v1/status" || path == "/api/v1/devices/pair"
}

func isLoopbackRemote(remoteAddress string) bool {
	host, _, err := net.SplitHostPort(remoteAddress)
	if err != nil {
		return false
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && ip.IsLoopback()
}

func deviceFromContext(ctx context.Context) *domain.Device {
	device, ok := ctx.Value(deviceContextKey{}).(domain.Device)
	if !ok {
		return nil
	}
	return &device
}
