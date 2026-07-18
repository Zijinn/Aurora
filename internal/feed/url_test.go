package feed

import "testing"

func TestNormalizeURL(t *testing.T) {
	got, err := NormalizeURL("HTTPS://Example.COM:443/a/../feed/?b=2&a=1#fragment")
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://example.com/feed/?a=1&b=2" {
		t.Fatalf("unexpected normalized URL %q", got)
	}
}

func TestTransformRSSHubURL(t *testing.T) {
	got, err := TransformRSSHubURL("rsshub://github/trending/daily", "https://rsshub.example/base")
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://rsshub.example/base/github/trending/daily" {
		t.Fatalf("unexpected RSSHub URL %q", got)
	}
	got, err = TransformRSSHubURL("rsshub:/github/trending/daily?limit=10&include=go", "https://rsshub.example/base")
	if err != nil {
		t.Fatalf("transform RSSHub route with query: %v", err)
	}
	if got != "https://rsshub.example/base/github/trending/daily?include=go&limit=10" {
		t.Fatalf("unexpected RSSHub query URL %q", got)
	}
}
