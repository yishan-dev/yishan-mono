package daemon

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

type JWTAuthConfig struct {
	Secret   string
	Issuer   string
	Audience string
	Required bool
}

type JWTAuth struct {
	config JWTAuthConfig
}

func NewJWTAuth(config JWTAuthConfig) *JWTAuth {
	return &JWTAuth{config: config}
}

func (a *JWTAuth) ValidateConfig() error {
	if a.config.Required && strings.TrimSpace(a.config.Secret) == "" {
		return errors.New("daemon JWT is required but no secret is configured")
	}
	return nil
}

func (a *JWTAuth) Middleware(next http.Handler) http.Handler {
	if !a.config.Required {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenString := extractBearerToken(r)
		if tokenString == "" {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}

		if err := a.validateToken(tokenString); err != nil {
			log.Warn().Err(err).Msg("JWT validation failed")
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (a *JWTAuth) validateToken(tokenString string) error {
	options := []jwt.ParserOption{jwt.WithValidMethods([]string{"HS256", "HS384", "HS512"}), jwt.WithExpirationRequired()}
	if a.config.Issuer != "" {
		options = append(options, jwt.WithIssuer(a.config.Issuer))
	}
	if a.config.Audience != "" {
		options = append(options, jwt.WithAudience(a.config.Audience))
	}

	_, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return []byte(a.config.Secret), nil
	}, options...)
	if err != nil {
		return err
	}

	return nil
}

func extractBearerToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if token, ok := strings.CutPrefix(authHeader, "Bearer "); ok {
		return strings.TrimSpace(token)
	}

	if t := strings.TrimSpace(r.URL.Query().Get("token")); t != "" {
		return t
	}

	return strings.TrimSpace(r.URL.Query().Get("access_token"))
}
