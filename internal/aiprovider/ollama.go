package aiprovider

import (
	"context"
	"errors"
	"strings"
)

type ollamaProvider struct{ baseClient }

func (p *ollamaProvider) Complete(ctx context.Context, request Request) (Response, error) {
	model := strings.TrimSpace(request.Model)
	if model == "" {
		model = p.model
	}
	body := struct {
		Model    string    `json:"model"`
		Messages []Message `json:"messages"`
		Stream   bool      `json:"stream"`
		Options  any       `json:"options,omitempty"`
	}{Model: model, Messages: request.Messages, Stream: false}
	if request.Temperature != nil {
		body.Options = map[string]float64{"temperature": *request.Temperature}
	}
	var result struct {
		Message         Message `json:"message"`
		PromptEvalCount int     `json:"prompt_eval_count"`
		EvalCount       int     `json:"eval_count"`
	}
	if err := p.postJSON(ctx, "/api/chat", body, &result); err != nil {
		return Response{}, err
	}
	if strings.TrimSpace(result.Message.Content) == "" {
		return Response{}, &Error{Code: "empty_response", Err: errors.New("Ollama returned no content")}
	}
	return Response{
		Content: strings.TrimSpace(result.Message.Content),
		Usage: Usage{
			InputTokens: result.PromptEvalCount, OutputTokens: result.EvalCount,
			TotalTokens: result.PromptEvalCount + result.EvalCount,
		},
	}, nil
}
