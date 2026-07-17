package feed

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParserFixtures(t *testing.T) {
	tests := []struct {
		name       string
		file       string
		format     string
		entryTitle string
	}{
		{name: "RSS", file: "rss.xml", format: "rss", entryTitle: "First RSS entry"},
		{name: "Atom", file: "atom.xml", format: "atom", entryTitle: "First Atom entry"},
		{name: "JSON Feed", file: "feed.json", format: "json", entryTitle: "First JSON entry"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			body := readFixture(t, test.file)
			parsed, err := NewParser().Parse(body, "https://feeds.example.test/source")
			if err != nil {
				t.Fatalf("parse fixture: %v", err)
			}
			if parsed.Format != test.format || len(parsed.Entries) != 1 {
				t.Fatalf("unexpected feed: format=%s entries=%d", parsed.Format, len(parsed.Entries))
			}
			if parsed.Entries[0].Title != test.entryTitle || parsed.Entries[0].ContentHash == "" {
				t.Fatalf("unexpected entry: %+v", parsed.Entries[0])
			}
		})
	}
}

func TestParserRejectsMalformedXML(t *testing.T) {
	if _, err := NewParser().Parse(readFixture(t, "malformed.xml"), "https://example.com/feed"); err == nil {
		t.Fatal("expected malformed feed to fail")
	}
}

func TestParserSanitizesActiveContentAndResolvesImages(t *testing.T) {
	parsed, err := NewParser().Parse(readFixture(t, "rss.xml"), "https://example.com/feed.xml")
	if err != nil {
		t.Fatalf("parse RSS: %v", err)
	}
	entry := parsed.Entries[0]
	lower := strings.ToLower(entry.SanitizedHTML)
	for _, forbidden := range []string{"<script", "onerror", "javascript:"} {
		if strings.Contains(lower, forbidden) {
			t.Fatalf("sanitized HTML contains %q: %s", forbidden, entry.SanitizedHTML)
		}
	}
	if entry.LeadImageURL == nil || *entry.LeadImageURL != "https://example.com/images/first.jpg" {
		t.Fatalf("unexpected lead image: %v", entry.LeadImageURL)
	}
}

func readFixture(t *testing.T, name string) []byte {
	t.Helper()
	body, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	return body
}
