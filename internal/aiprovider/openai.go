package aiprovider

import (
	"context"
	"errors"
	"strings"
)

type openAIProvider struct{ baseClient }

func (p *openAIProvider) Complete(ctx context.Context, request Request) (Response, error) {
	model := strings.TrimSpace(request.Model)
	if model == "" {
		model = p.model
	}
	body := struct {
		Model       string    `json:"model"`
		Messages    []Message `json:"messages"`
		Temperature *float64  `json:"temperature,omitempty"`
	}{Model: model, Messages: request.Messages, Temperature: request.Temperature}
	var result struct {
		Choices []struct {
			Message Message `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := p.postJSON(ctx, "/chat/completions", body, &result); err != nil {
		return Response{}, err
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return Response{}, &Error{Code: "empty_response", Err: errors.New("AI provider returned no content")}
	}
	return Response{
		Content: strings.TrimSpace(result.Choices[0].Message.Content),
		Usage:   Usage{InputTokens: result.Usage.PromptTokens, OutputTokens: result.Usage.CompletionTokens, TotalTokens: result.Usage.TotalTokens},
	}, nil
}
