package opml

import (
	"reflect"
	"testing"
)

func TestRoundTripPreservesFoldersAndURLs(t *testing.T) {
	want := []Source{
		{Title: "One", XMLURL: "https://example.com/one.xml", HTMLURL: "https://example.com/one", FolderPath: []string{"Research", "Economics"}},
		{Title: "Two", XMLURL: "https://example.com/two.json", FolderPath: []string{"Research"}},
	}
	body, err := Export("Cairn subscriptions", want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("round trip mismatch:\nwant: %#v\n got: %#v", want, got)
	}
}
