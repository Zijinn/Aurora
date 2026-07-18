package feed

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"path"
	"sort"
	"strings"
)

const DefaultRSSHubBase = "https://rsshub.app"

var ErrInvalidURL = errors.New("invalid feed URL")

func NormalizeURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	parsed, err := url.Parse(value)
	if err != nil || parsed.Hostname() == "" {
		return "", ErrInvalidURL
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: only HTTP and HTTPS are supported", ErrInvalidURL)
	}
	if parsed.User != nil {
		return "", fmt.Errorf("%w: embedded credentials are not supported", ErrInvalidURL)
	}

	parsed.Scheme = strings.ToLower(parsed.Scheme)
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	port := parsed.Port()
	if (parsed.Scheme == "http" && port == "80") || (parsed.Scheme == "https" && port == "443") {
		port = ""
	}
	if strings.Contains(host, ":") {
		host = "[" + host + "]"
	}
	parsed.Host = host
	if port != "" {
		parsed.Host = net.JoinHostPort(strings.Trim(host, "[]"), port)
	}
	parsed.Fragment = ""
	if parsed.Path == "" {
		parsed.Path = "/"
	} else {
		cleaned := path.Clean(parsed.EscapedPath())
		if strings.HasSuffix(parsed.Path, "/") && cleaned != "/" {
			cleaned += "/"
		}
		decoded, decodeErr := url.PathUnescape(cleaned)
		if decodeErr == nil {
			parsed.Path = decoded
			parsed.RawPath = ""
		}
	}

	query := parsed.Query()
	for key, values := range query {
		sort.Strings(values)
		query[key] = values
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func TransformRSSHubURL(raw, base string) (string, error) {
	value := strings.TrimSpace(raw)
	if !strings.HasPrefix(strings.ToLower(value), "rsshub:") {
		return NormalizeURL(value)
	}
	if strings.TrimSpace(base) == "" {
		base = DefaultRSSHubBase
	}
	baseURL, err := url.Parse(base)
	if err != nil || baseURL.Hostname() == "" || (baseURL.Scheme != "http" && baseURL.Scheme != "https") {
		return "", fmt.Errorf("invalid RSSHub base URL")
	}
	route := value[len("rsshub:"):]
	route = strings.TrimLeft(route, "/")
	if route == "" {
		return "", fmt.Errorf("%w: RSSHub route is empty", ErrInvalidURL)
	}
	routePath := route
	routeQuery := ""
	if queryIndex := strings.IndexByte(routePath, '?'); queryIndex >= 0 {
		routeQuery = routePath[queryIndex+1:]
		routePath = routePath[:queryIndex]
	}
	routePath = strings.Trim(routePath, "/")
	if routePath == "" {
		return "", fmt.Errorf("%w: RSSHub route is empty", ErrInvalidURL)
	}
	baseURL.Path = strings.TrimRight(baseURL.Path, "/") + "/" + routePath
	baseURL.RawQuery = ""
	if routeQuery != "" {
		baseURL.RawQuery = routeQuery
	}
	baseURL.Fragment = ""
	return NormalizeURL(baseURL.String())
}

func ResolveURL(baseURL, reference string) *string {
	value := strings.TrimSpace(reference)
	if value == "" {
		return nil
	}
	ref, err := url.Parse(value)
	if err != nil {
		return nil
	}
	if baseURL != "" {
		base, baseErr := url.Parse(baseURL)
		if baseErr == nil {
			ref = base.ResolveReference(ref)
		}
	}
	normalized, err := NormalizeURL(ref.String())
	if err != nil {
		return nil
	}
	return &normalized
}
