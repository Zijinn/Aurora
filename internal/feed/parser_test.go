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

func TestParserPreservesDOIExtensions(t *testing.T) {
	body := []byte(`<?xml version="1.0"?><rss version="2.0"
		xmlns:dc="http://purl.org/dc/elements/1.1/"
		xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
		<channel><title>DOI feed</title><link>https://example.com</link><description>Test</description>
		<item><guid>one</guid><title>DC DOI</title><dc:identifier>doi:10.1234/DC.2026.1</dc:identifier></item>
		<item><guid>two</guid><title>PRISM DOI</title><prism:doi>10.5678/Prism.2</prism:doi></item>
		</channel></rss>`)
	parsed, err := NewParser().Parse(body, "https://example.com/feed.xml")
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed.Entries) != 2 || parsed.Entries[0].DOI == nil || *parsed.Entries[0].DOI != "10.1234/dc.2026.1" || parsed.Entries[1].DOI == nil || *parsed.Entries[1].DOI != "10.5678/prism.2" {
		t.Fatalf("DOI extensions were not preserved: %+v", parsed.Entries)
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
