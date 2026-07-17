package config

import "testing"

func TestValidateRejectsLANAddressWithoutLANMode(t *testing.T) {
	cfg := Config{
		Address:       "0.0.0.0:7381",
		DataDir:       t.TempDir(),
		DBPath:        t.TempDir() + "/cairn.db",
		MasterKeyPath: t.TempDir() + "/master.key",
		LogLevel:      "info",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected non-loopback address to be rejected")
	}
}

func TestValidateAllowsLoopback(t *testing.T) {
	cfg := Config{
		Address:       "127.0.0.1:7381",
		DataDir:       t.TempDir(),
		DBPath:        t.TempDir() + "/cairn.db",
		MasterKeyPath: t.TempDir() + "/master.key",
		LogLevel:      "info",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected loopback config to be valid: %v", err)
	}
}

func TestValidateAllowsLANAddressInLANMode(t *testing.T) {
	cfg := Config{
		Address:       "0.0.0.0:7381",
		DataDir:       t.TempDir(),
		DBPath:        t.TempDir() + "/cairn.db",
		MasterKeyPath: t.TempDir() + "/master.key",
		LogLevel:      "info",
		LANMode:       true,
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected LAN config to be valid: %v", err)
	}
}

func TestValidateRequiresTLSCertificateAndKeyTogether(t *testing.T) {
	cfg := Config{
		Address: "0.0.0.0:7381", DataDir: t.TempDir(), DBPath: t.TempDir() + "/cairn.db",
		MasterKeyPath: t.TempDir() + "/master.key", LogLevel: "info", LANMode: true,
		TLSCertPath: t.TempDir() + "/server.crt",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected a missing TLS key to be rejected")
	}
}
