package domain

import (
	"net/url"
	"strings"
)

// Content kinds distinguish scholarly sources from casual subscriptions so the
// timeline can offer a literature-only scope and readers can render academic
// metadata differently.
const (
	ContentKindGeneral    = "general"
	ContentKindLiterature = "literature"
	ContentKindVideo      = "video"
	ContentKindSocial     = "social"
)

var literatureHosts = []string{
	"nature.com", "science.org", "sciencemag.org", "cell.com", "plos.org",
	"arxiv.org", "biorxiv.org", "medrxiv.org", "ssrn.com",
	"pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov",
	"springer.com", "link.springer.com", "wiley.com", "onlinelibrary.wiley.com",
	"sciencedirect.com", "elsevier.com", "ieee.org", "ieeexplore.ieee.org",
	"acm.org", "dl.acm.org", "jstor.org", "tandfonline.com", "sagepub.com",
	"academic.oup.com", "frontiersin.org", "mdpi.com", "acs.org", "pubs.acs.org",
	"pubs.rsc.org", "rsc.org", "iop.org", "iopscience.iop.org", "aps.org",
	"journals.aps.org", "annualreviews.org", "aip.scitation.org", "scitation.org",
	"cnki.net", "wanfangdata.com.cn", "semanticscholar.org",
}

var videoHosts = []string{
	"bilibili.com", "youtube.com", "youtu.be",
}

var socialHosts = []string{
	"x.com", "twitter.com", "weibo.com", "zhihu.com", "reddit.com", "v2ex.com",
}

func hostMatches(rawURL, host string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	name := strings.ToLower(parsed.Hostname())
	return name == host || strings.HasSuffix(name, "."+host)
}

// DetectContentKind infers the feed's content kind from its site/feed URLs and
// the DOI density of its entries. DOI presence wins over host heuristics so
// journal mirrors on generic platforms still classify as literature.
func DetectContentKind(feedURL string, siteURL *string, entries []ParsedEntry) string {
	doiCount := 0
	for _, entry := range entries {
		if entry.DOI != nil && *entry.DOI != "" {
			doiCount++
		}
	}
	if doiCount >= 2 || (len(entries) > 0 && doiCount*2 >= len(entries)) {
		return ContentKindLiterature
	}
	for _, host := range literatureHosts {
		if hostMatches(feedURL, host) || (siteURL != nil && hostMatches(*siteURL, host)) {
			return ContentKindLiterature
		}
	}
	for _, host := range videoHosts {
		if hostMatches(feedURL, host) || (siteURL != nil && hostMatches(*siteURL, host)) {
			return ContentKindVideo
		}
	}
	for _, host := range socialHosts {
		if hostMatches(feedURL, host) || (siteURL != nil && hostMatches(*siteURL, host)) {
			return ContentKindSocial
		}
	}
	return ContentKindGeneral
}
