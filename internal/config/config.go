package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const defaultAddress = "127.0.0.1:7381"

type Config struct {
	Address        string
	DataDir        string
	DBPath         string
	MasterKeyPath  string
	WebDir         string
	TLSCertPath    string
	TLSKeyPath     string
	LogLevel       string
	LANMode        bool
	RSSHubBase     string
	AllowedOrigins []string
}

func Load() (Config, error) {
	dataDir, err := defaultDataDir()
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		Address:        envOr("CAIRN_ADDR", defaultAddress),
		DataDir:        envOr("CAIRN_DATA_DIR", dataDir),
		WebDir:         envOr("CAIRN_WEB_DIR", "web/dist"),
		TLSCertPath:    strings.TrimSpace(os.Getenv("CAIRN_TLS_CERT_PATH")),
		TLSKeyPath:     strings.TrimSpace(os.Getenv("CAIRN_TLS_KEY_PATH")),
		LogLevel:       strings.ToLower(envOr("CAIRN_LOG_LEVEL", "info")),
		RSSHubBase:     envOr("CAIRN_RSSHUB_BASE", "https://rsshub.app"),
		AllowedOrigins: splitList(os.Getenv("CAIRN_ALLOWED_ORIGINS")),
	}

	if raw := os.Getenv("CAIRN_LAN_MODE"); raw != "" {
		cfg.LANMode, err = strconv.ParseBool(raw)
		if err != nil {
			return Config{}, fmt.Errorf("parse CAIRN_LAN_MODE: %w", err)
		}
	}

	if dbPath := os.Getenv("CAIRN_DB_PATH"); dbPath != "" {
		cfg.DBPath = dbPath
	} else {
		cfg.DBPath = filepath.Join(cfg.DataDir, "cairn.db")
	}
	if keyPath := os.Getenv("CAIRN_MASTER_KEY_PATH"); keyPath != "" {
		cfg.MasterKeyPath = keyPath
	} else {
		cfg.MasterKeyPath = filepath.Join(cfg.DataDir, "master.key")
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil {
		return Config{}, fmt.Errorf("create data directory: %w", err)
	}
	return cfg, nil
}

func (c Config) Validate() error {
	host, _, err := net.SplitHostPort(c.Address)
	if err != nil {
		return fmt.Errorf("invalid CAIRN_ADDR: %w", err)
	}

	if !c.LANMode && !isLoopbackHost(host) {
		return errors.New("non-loopback CAIRN_ADDR requires CAIRN_LAN_MODE=true")
	}

	switch c.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("unsupported CAIRN_LOG_LEVEL %q", c.LogLevel)
	}

	if strings.TrimSpace(c.DataDir) == "" {
		return errors.New("data directory cannot be empty")
	}
	if strings.TrimSpace(c.DBPath) == "" {
		return errors.New("database path cannot be empty")
	}
	if strings.TrimSpace(c.MasterKeyPath) == "" {
		return errors.New("master key path cannot be empty")
	}
	if (c.TLSCertPath == "") != (c.TLSKeyPath == "") {
		return errors.New("CAIRN_TLS_CERT_PATH and CAIRN_TLS_KEY_PATH must be set together")
	}
	rssHubBase := c.RSSHubBase
	if strings.TrimSpace(rssHubBase) == "" {
		rssHubBase = "https://rsshub.app"
	}
	rssHubURL, err := url.Parse(rssHubBase)
	if err != nil || rssHubURL.Hostname() == "" || (rssHubURL.Scheme != "http" && rssHubURL.Scheme != "https") {
		return errors.New("CAIRN_RSSHUB_BASE must be an HTTP or HTTPS URL")
	}
	for _, origin := range c.AllowedOrigins {
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || (parsed.Path != "" && parsed.Path != "/") {
			return fmt.Errorf("invalid CAIRN_ALLOWED_ORIGINS value %q", origin)
		}
	}
	return nil
}

func defaultDataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config directory: %w", err)
	}
	return filepath.Join(base, "Cairn"), nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func isLoopbackHost(host string) bool {
	host = strings.Trim(host, "[]")
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func splitList(value string) []string {
	items := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimRight(strings.TrimSpace(item), "/")
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}
