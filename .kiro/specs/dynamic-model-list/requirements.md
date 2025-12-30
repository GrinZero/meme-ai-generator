# Requirements Document

## Introduction

当前应用的模型列表是硬编码的，用户填写 API Key 和选择 API 风格后，模型列表应该动态从 API 获取。这个功能将使用户能够看到他们实际可用的模型，而不是预设的固定列表。

## Glossary

- **Model_List_Fetcher**: 模型列表获取器，负责从 AI API 获取可用模型列表
- **API_Config_Manager**: API 配置管理器，负责管理和存储用户的 API 配置
- **ConfigPanel**: 配置面板组件，显示 API 配置界面

## Requirements

### Requirement 1: 动态模型列表获取

**User Story:** As a user, I want the model list to be fetched from the API after I configure my API settings, so that I can see and select from the models actually available to me.

#### Acceptance Criteria

1. WHEN a user has entered a valid API Key and selected an API style THEN THE Model_List_Fetcher SHALL request the available models from the corresponding API endpoint
2. WHEN the model list is being fetched THEN THE ConfigPanel SHALL display a loading indicator in the model dropdown
3. WHEN the model list fetch succeeds THEN THE ConfigPanel SHALL populate the model dropdown with the fetched models
4. IF the model list fetch fails THEN THE ConfigPanel SHALL display an error message and fall back to the default preset model list
5. WHEN the API style changes THEN THE Model_List_Fetcher SHALL fetch the new model list for the selected style
6. WHEN the API Key changes THEN THE Model_List_Fetcher SHALL re-fetch the model list with the new credentials
7. THE Model_List_Fetcher SHALL cache the fetched model list to avoid unnecessary API calls
8. WHEN the Base URL changes THEN THE Model_List_Fetcher SHALL re-fetch the model list from the new endpoint

### Requirement 2: Gemini 模型列表 API

**User Story:** As a user using Gemini API, I want to see the models available in my Gemini account.

#### Acceptance Criteria

1. THE Model_List_Fetcher SHALL use the Gemini models.list API endpoint to fetch available models
2. THE Model_List_Fetcher SHALL filter the model list to only include models that support image generation
3. WHEN using a custom Base URL THEN THE Model_List_Fetcher SHALL append the models endpoint path to the custom URL

### Requirement 3: OpenAI 风格模型列表 API

**User Story:** As a user using OpenAI-style API, I want to see the models available from my API provider.

#### Acceptance Criteria

1. THE Model_List_Fetcher SHALL use the /v1/models endpoint to fetch available models for OpenAI-style APIs
2. THE Model_List_Fetcher SHALL handle pagination if the API returns paginated results
3. WHEN using a custom Base URL THEN THE Model_List_Fetcher SHALL use the custom URL as the base for the models endpoint

### Requirement 4: 用户体验优化

**User Story:** As a user, I want a smooth experience when the model list is loading or when errors occur.

#### Acceptance Criteria

1. THE ConfigPanel SHALL disable the model dropdown while the model list is being fetched
2. THE ConfigPanel SHALL preserve the previously selected model if it exists in the new model list
3. IF the previously selected model does not exist in the new list THEN THE ConfigPanel SHALL select the first available model
4. THE ConfigPanel SHALL show a refresh button to manually re-fetch the model list
5. WHEN no API Key is provided THEN THE ConfigPanel SHALL show the default preset model list without attempting to fetch

