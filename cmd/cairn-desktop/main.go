//go:build desktop

package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"

	"github.com/cairn-reader/cairn/internal/config"
	"github.com/cairn-reader/cairn/internal/httpapi"
	"github.com/cairn-reader/cairn/internal/secretbox"
	"github.com/cairn-reader/cairn/internal/storage"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load configuration", "error", err)
		os.Exit(1)
	}

	db, err := storage.Open(context.Background(), cfg.DBPath)
	if err != nil {
		slog.Error("open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	box, err := secretbox.LoadOrCreate(cfg.MasterKeyPath)
	if err != nil {
		slog.Error("load credential master key", "error", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	handler := httpapi.New(db, logger, desktopWebDir(cfg.WebDir))
	handler.ConfigureSync(box)
	handler.ConfigureAI(box)
	handler.SetRSSHubBase(cfg.RSSHubBase)
	handler.ConfigureSecurity(cfg.LANMode, cfg.AllowedOrigins)
	appContext, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := handler.Start(appContext); err != nil {
		logger.Error("start application services", "error", err)
		os.Exit(1)
	}
	app := application.New(application.Options{
		Name:        "Cairn",
		Description: "A private reading home for the open web",
		LogLevel:    slog.LevelError,
		Assets: application.AssetOptions{
			Handler: handler.Handler(),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		SingleInstance: func() *application.SingleInstanceOptions {
			if runtime.GOOS == "linux" {
				return nil
			}
			return &application.SingleInstanceOptions{UniqueID: "app.cairn.reader"}
		}(),
	})

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "cairn-main-window",
		Title:            "Cairn",
		Width:            1280,
		Height:           820,
		MinWidth:         920,
		MinHeight:        620,
		URL:              "/",
		BackgroundColour: application.NewRGB(244, 243, 239),
	})
	window.Center()

	if err := app.Run(); err != nil {
		logger.Error("run desktop application", "error", err)
		os.Exit(1)
	}
}

func desktopWebDir(configured string) string {
	if filepath.IsAbs(configured) {
		return configured
	}
	executable, err := os.Executable()
	if err != nil {
		return configured
	}
	base := filepath.Dir(executable)
	candidates := []string{
		filepath.Join(base, configured),
		filepath.Join(base, "..", "Resources", configured),
	}
	for _, candidate := range candidates {
		if info, statErr := os.Stat(candidate); statErr == nil && info.IsDir() {
			resolved, resolveErr := filepath.Abs(candidate)
			if resolveErr == nil {
				return resolved
			}
		}
	}
	return configured
}
