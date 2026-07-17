package httpapi

import (
	"bufio"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestOpenAPICoversRegisteredHTTPRoutes(t *testing.T) {
	root := filepath.Join("..", "..")
	expected := map[string]map[string]bool{}
	for _, name := range []string{"internal/httpapi/routes.go", "internal/httpapi/server.go"} {
		file, err := parser.ParseFile(token.NewFileSet(), filepath.Join(root, name), nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok || len(call.Args) == 0 {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok || selector.Sel.Name != "HandleFunc" {
				return true
			}
			literal, ok := call.Args[0].(*ast.BasicLit)
			if !ok || literal.Kind.String() != "STRING" {
				return true
			}
			pattern, err := strconv.Unquote(literal.Value)
			if err != nil {
				t.Errorf("decode route pattern %s: %v", literal.Value, err)
				return true
			}
			method, path, hasMethod := strings.Cut(pattern, " ")
			if !hasMethod || !strings.HasPrefix(path, "/api/v1") || path == "/api/" {
				return true
			}
			path = normalizeOpenAPIPath(path)
			if expected[path] == nil {
				expected[path] = map[string]bool{}
			}
			expected[path][strings.ToLower(method)] = true
			return true
		})
	}

	openapiBody, err := os.ReadFile(filepath.Join(root, "api", "openapi.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	actual := map[string]map[string]bool{}
	var currentPath string
	scanner := bufio.NewScanner(strings.NewReader(string(openapiBody)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "  /") {
			currentPath = normalizeOpenAPIPath(strings.TrimSuffix(strings.TrimSpace(line), ":"))
			actual[currentPath] = map[string]bool{}
			continue
		}
		if currentPath == "" || len(line) < 7 || line[:4] != "    " || !strings.HasSuffix(strings.TrimSpace(line), ":") {
			continue
		}
		method := strings.TrimSuffix(strings.TrimSpace(line), ":")
		switch method {
		case "get", "post", "patch", "put", "delete", "options", "head":
			actual[currentPath][method] = true
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}

	for path, methods := range expected {
		for method := range methods {
			if !actual[path][method] {
				t.Errorf("runtime route %s %s is missing from api/openapi.yaml", strings.ToUpper(method), path)
			}
		}
	}
}

func normalizeOpenAPIPath(path string) string {
	path = strings.ReplaceAll(path, "{$}", "")
	var normalized strings.Builder
	for position := 0; position < len(path); {
		start := strings.IndexByte(path[position:], '{')
		if start < 0 {
			normalized.WriteString(path[position:])
			break
		}
		start += position
		normalized.WriteString(path[position:start])
		end := strings.IndexByte(path[start:], '}')
		if end < 0 {
			normalized.WriteString(path[start:])
			break
		}
		normalized.WriteString("{param}")
		position = start + end + 1
	}
	return normalized.String()
}
