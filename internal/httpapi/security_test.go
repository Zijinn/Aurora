package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLANModeRequiresPairedDeviceToken(t *testing.T) {
	server := newTestServer(t)
	server.ConfigureSecurity(true, nil)

	unauthorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/feeds", nil)
	request.RemoteAddr = "192.168.1.20:40000"
	server.Handler().ServeHTTP(unauthorized, request)
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected remote request to require auth, got %d", unauthorized.Code)
	}

	codeResponse := httptest.NewRecorder()
	codeRequest := httptest.NewRequest(http.MethodPost, "/api/v1/devices/pairing-code", nil)
	codeRequest.RemoteAddr = "127.0.0.1:40001"
	server.Handler().ServeHTTP(codeResponse, codeRequest)
	if codeResponse.Code != http.StatusCreated {
		t.Fatalf("create pairing code: %d %s", codeResponse.Code, codeResponse.Body.String())
	}
	var codeBody struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(codeResponse.Body).Decode(&codeBody); err != nil || codeBody.Code == "" {
		t.Fatalf("decode pairing code: %+v, %v", codeBody, err)
	}

	pairBody, _ := json.Marshal(map[string]string{"code": codeBody.Code, "name": "iPad", "platform": "ipad"})
	pairResponse := httptest.NewRecorder()
	pairRequest := httptest.NewRequest(http.MethodPost, "/api/v1/devices/pair", bytes.NewReader(pairBody))
	pairRequest.RemoteAddr = "192.168.1.20:40002"
	server.Handler().ServeHTTP(pairResponse, pairRequest)
	if pairResponse.Code != http.StatusCreated {
		t.Fatalf("pair device: %d %s", pairResponse.Code, pairResponse.Body.String())
	}
	var paired struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(pairResponse.Body).Decode(&paired); err != nil || paired.Token == "" {
		t.Fatalf("decode paired token: %+v, %v", paired, err)
	}

	authorized := httptest.NewRecorder()
	authorizedRequest := httptest.NewRequest(http.MethodGet, "/api/v1/feeds", nil)
	authorizedRequest.RemoteAddr = "192.168.1.20:40003"
	authorizedRequest.Header.Set("Authorization", "Bearer "+paired.Token)
	server.Handler().ServeHTTP(authorized, authorizedRequest)
	if authorized.Code != http.StatusOK {
		t.Fatalf("paired request failed: %d %s", authorized.Code, authorized.Body.String())
	}
}

func TestOriginValidationRejectsUntrustedWebsites(t *testing.T) {
	server := newTestServer(t)
	server.ConfigureSecurity(true, []string{"https://reader.example"})
	blocked := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	request.RemoteAddr = "127.0.0.1:40000"
	request.Header.Set("Origin", "https://evil.example")
	server.Handler().ServeHTTP(blocked, request)
	if blocked.Code != http.StatusForbidden {
		t.Fatalf("expected untrusted origin to be rejected, got %d", blocked.Code)
	}
	allowed := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodOptions, "/api/v1/feeds", nil)
	request.RemoteAddr = "192.168.1.20:40001"
	request.Header.Set("Origin", "https://reader.example")
	server.Handler().ServeHTTP(allowed, request)
	if allowed.Code != http.StatusNoContent || allowed.Header().Get("Access-Control-Allow-Origin") != "https://reader.example" {
		t.Fatalf("expected allowed preflight, got %d %+v", allowed.Code, allowed.Header())
	}
}
