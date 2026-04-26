use crate::db::mysql::MySqlDriver;
use crate::db::postgres::PostgresDriver;
use crate::db::registry::REGISTRY;
use crate::db::sqlite::SqliteDriver;
use crate::db::DatabaseDriver;
use crate::license;
use crate::sql_import;
use crate::ssh::{SshAuth, SshTunnel};
use crate::storage::AppStorage;
use crate::types::*;
use anyhow::Result;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use dashmap::DashMap;
use once_cell::sync::Lazy;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri_plugin_updater::UpdaterExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::timeout as tokio_timeout;

use crate::db::mongodb::MongoDriver;
use crate::db::redis_driver::RedisDriver;

// System databases/schemas to always exclude
const SYSTEM_DATABASES: &[&str] = &[
    // MySQL / MariaDB
    "information_schema",
    "performance_schema",
    "mysql",
    "sys",
    // PostgreSQL
    "postgres",
    "template0",
    "template1",
    // PostgreSQL schemas
    "pg_catalog",
    "pg_toast",
    "pg_temp_1",
    "pg_toast_temp_1",
];

static OPENROUTER_OAUTH_FLOWS: Lazy<DashMap<String, OpenRouterOAuthFlow>> =
    Lazy::new(DashMap::new);

const AI_PROVIDER_OPENROUTER: &str = "openrouter";
const AI_PROVIDER_OPENCODE: &str = "opencode";
const AI_PROVIDER_OPENAI: &str = "openai";
const AI_PROVIDER_CODEX: &str = "codex";
const AI_PROVIDER_GITHUB_COPILOT: &str = "github-copilot";
const AI_PROVIDER_ANTHROPIC: &str = "anthropic";
const AI_PROVIDER_GROQ: &str = "groq";
const AI_PROVIDER_GEMINI: &str = "gemini";

#[derive(Debug, Clone)]
struct OpenRouterOAuthFlow {
    code_verifier: String,
    code: Option<String>,
    error: Option<String>,
    created_at: Instant,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRouterCredentialStatus {
    pub provider: String,
    pub auth_mode: String,
    pub configured: bool,
    pub masked_key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCredentialStatus {
    pub provider: String,
    pub auth_mode: String,
    pub configured: bool,
    pub masked_key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRouterOAuthBeginResult {
    pub flow_id: String,
    pub auth_url: String,
    pub callback_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRouterMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRouterChatRequest {
    pub model: String,
    pub messages: Vec<OpenRouterMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRouterChatResponse {
    pub content: String,
    pub model: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub provider: String,
    pub model: String,
    pub messages: Vec<OpenRouterMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub content: String,
    pub model: Option<String>,
}

fn normalize_ai_provider(provider: &str) -> Result<&'static str, String> {
    let p = provider.trim().to_ascii_lowercase();
    match p.as_str() {
        AI_PROVIDER_OPENROUTER => Ok(AI_PROVIDER_OPENROUTER),
        AI_PROVIDER_OPENCODE => Ok(AI_PROVIDER_OPENCODE),
        AI_PROVIDER_OPENAI => Ok(AI_PROVIDER_OPENAI),
        AI_PROVIDER_CODEX => Ok(AI_PROVIDER_CODEX),
        AI_PROVIDER_GITHUB_COPILOT => Ok(AI_PROVIDER_GITHUB_COPILOT),
        AI_PROVIDER_ANTHROPIC => Ok(AI_PROVIDER_ANTHROPIC),
        AI_PROVIDER_GROQ => Ok(AI_PROVIDER_GROQ),
        AI_PROVIDER_GEMINI => Ok(AI_PROVIDER_GEMINI),
        _ => Err(format!("Unsupported AI provider: {provider}")),
    }
}

fn default_model_for_provider(provider: &str) -> &'static str {
    match provider {
        AI_PROVIDER_OPENROUTER => "openrouter/free",
        AI_PROVIDER_OPENCODE => "openrouter/free",
        AI_PROVIDER_OPENAI => "gpt-4o-mini",
        AI_PROVIDER_CODEX => "gpt-5",
        AI_PROVIDER_GITHUB_COPILOT => "openai/gpt-4.1-mini",
        AI_PROVIDER_ANTHROPIC => "claude-3-5-haiku-latest",
        AI_PROVIDER_GROQ => "llama-3.1-8b-instant",
        AI_PROVIDER_GEMINI => "gemini-1.5-flash",
        _ => "openrouter/free",
    }
}

fn map_openai_style_messages(messages: &[OpenRouterMessage]) -> Vec<serde_json::Value> {
    messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect()
}

fn map_anthropic_messages(messages: &[OpenRouterMessage]) -> (Option<String>, Vec<serde_json::Value>) {
    let mut system_parts: Vec<String> = Vec::new();
    let mut non_system: Vec<serde_json::Value> = Vec::new();

    for m in messages {
        let role = m.role.trim().to_ascii_lowercase();
        if role == "system" {
            system_parts.push(m.content.clone());
            continue;
        }
        let anthropic_role = if role == "assistant" { "assistant" } else { "user" };
        non_system.push(serde_json::json!({
            "role": anthropic_role,
            "content": [
                { "type": "text", "text": m.content }
            ]
        }));
    }

    let system = if system_parts.is_empty() {
        None
    } else {
        Some(system_parts.join("\n\n"))
    };

    (system, non_system)
}

fn map_gemini_messages(messages: &[OpenRouterMessage]) -> (Option<String>, Vec<serde_json::Value>) {
    let mut system_parts: Vec<String> = Vec::new();
    let mut contents: Vec<serde_json::Value> = Vec::new();

    for m in messages {
        let role = m.role.trim().to_ascii_lowercase();
        if role == "system" {
            system_parts.push(m.content.clone());
            continue;
        }
        let gemini_role = if role == "assistant" { "model" } else { "user" };
        contents.push(serde_json::json!({
            "role": gemini_role,
            "parts": [{ "text": m.content }]
        }));
    }

    let system = if system_parts.is_empty() {
        None
    } else {
        Some(system_parts.join("\n\n"))
    };
    (system, contents)
}

fn mask_api_key(raw: &str) -> String {
    if raw.len() <= 10 {
        return "**********".to_string();
    }
    let prefix = &raw[..4];
    let suffix = &raw[raw.len() - 4..];
    format!("{prefix}••••••••{suffix}")
}

async fn openrouter_models_ping(api_key: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://openrouter.ai/api/v1/models")
        .header("Authorization", format!("Bearer {api_key}"))
        .send()
        .await
        .map_err(|e| format!("OpenRouter request failed: {e}"))?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let body_text = response
        .text()
        .await
        .unwrap_or_else(|_| "Unknown OpenRouter error".to_string());
    Err(format!("OpenRouter auth failed ({status}): {body_text}"))
}

async fn ai_provider_models_ping(provider: &str, api_key: &str) -> Result<(), String> {
    match provider {
        AI_PROVIDER_OPENROUTER | AI_PROVIDER_OPENCODE => openrouter_models_ping(api_key).await,
        AI_PROVIDER_OPENAI | AI_PROVIDER_CODEX => {
            let client = reqwest::Client::new();
            let response = client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {api_key}"))
                .send()
                .await
                .map_err(|e| {
                    format!(
                        "{} request failed: {e}",
                        if provider == AI_PROVIDER_CODEX {
                            "Codex"
                        } else {
                            "OpenAI"
                        }
                    )
                })?;

            if response.status().is_success() {
                Ok(())
            } else {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| {
                        if provider == AI_PROVIDER_CODEX {
                            "Unknown Codex error".to_string()
                        } else {
                            "Unknown OpenAI error".to_string()
                        }
                    });
                Err(format!(
                    "{} auth failed ({status}): {body}",
                    if provider == AI_PROVIDER_CODEX {
                        "Codex"
                    } else {
                        "OpenAI"
                    }
                ))
            }
        }
        AI_PROVIDER_GITHUB_COPILOT => {
            let client = reqwest::Client::new();
            let response = client
                .get("https://models.github.ai/catalog/models")
                .header("Authorization", format!("Bearer {api_key}"))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2026-03-10")
                .send()
                .await
                .map_err(|e| format!("GitHub Copilot request failed: {e}"))?;

            if response.status().is_success() {
                Ok(())
            } else {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown GitHub Copilot error".to_string());
                Err(format!("GitHub Copilot auth failed ({status}): {body}"))
            }
        }
        AI_PROVIDER_ANTHROPIC => {
            let client = reqwest::Client::new();
            let response = client
                .get("https://api.anthropic.com/v1/models")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| format!("Anthropic request failed: {e}"))?;

            if response.status().is_success() {
                Ok(())
            } else {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown Anthropic error".to_string());
                Err(format!("Anthropic auth failed ({status}): {body}"))
            }
        }
        AI_PROVIDER_GROQ => {
            let client = reqwest::Client::new();
            let response = client
                .get("https://api.groq.com/openai/v1/models")
                .header("Authorization", format!("Bearer {api_key}"))
                .send()
                .await
                .map_err(|e| format!("Groq request failed: {e}"))?;

            if response.status().is_success() {
                Ok(())
            } else {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown Groq error".to_string());
                Err(format!("Groq auth failed ({status}): {body}"))
            }
        }
        AI_PROVIDER_GEMINI => {
            let encoded = urlencoding::encode(api_key);
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models?key={encoded}"
            );
            let client = reqwest::Client::new();
            let response = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Gemini request failed: {e}"))?;

            if response.status().is_success() {
                Ok(())
            } else {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown Gemini error".to_string());
                Err(format!("Gemini auth failed ({status}): {body}"))
            }
        }
        _ => Err(format!("Unsupported AI provider: {provider}")),
    }
}

fn extract_openrouter_content(value: &serde_json::Value) -> String {
    if let Some(s) = value.as_str() {
        return s.to_string();
    }

    if let Some(arr) = value.as_array() {
        let mut chunks = Vec::new();
        for item in arr {
            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                chunks.push(text.to_string());
            }
        }
        return chunks.join("\n");
    }

    if let Some(text) = value.get("text").and_then(|v| v.as_str()) {
        return text.to_string();
    }

    value.to_string()
}

async fn ai_chat_completion_with_provider(
    provider: &str,
    request: &AiChatRequest,
    api_key: &str,
) -> Result<AiChatResponse, String> {
    let model = if request.model.trim().is_empty() {
        default_model_for_provider(provider).to_string()
    } else {
        request.model.trim().to_string()
    };

    let client = reqwest::Client::new();

    match provider {
        AI_PROVIDER_OPENROUTER | AI_PROVIDER_OPENCODE => {
            let payload = serde_json::json!({
                "model": model,
                "messages": request.messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            });

            let response = client
                .post("https://openrouter.ai/api/v1/chat/completions")
                .header("Authorization", format!("Bearer {api_key}"))
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| {
                    format!(
                        "{} request failed: {e}",
                        if provider == AI_PROVIDER_OPENCODE {
                            "OpenCode"
                        } else {
                            "OpenRouter"
                        }
                    )
                })?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| {
                        if provider == AI_PROVIDER_OPENCODE {
                            "Unknown OpenCode error".to_string()
                        } else {
                            "Unknown OpenRouter error".to_string()
                        }
                    });
                return Err(format!(
                    "{} generation failed ({status}): {body}",
                    if provider == AI_PROVIDER_OPENCODE {
                        "OpenCode"
                    } else {
                        "OpenRouter"
                    }
                ));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Invalid OpenRouter response: {e}"))?;

            let content = json
                .get("choices")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|choice| choice.get("message"))
                .and_then(|msg| msg.get("content"))
                .map(extract_openrouter_content)
                .unwrap_or_default();

            if content.trim().is_empty() {
                return Err(format!(
                    "{} returned an empty response",
                    if provider == AI_PROVIDER_OPENCODE {
                        "OpenCode"
                    } else {
                        "OpenRouter"
                    }
                ));
            }

            return Ok(AiChatResponse {
                content,
                model: json
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            });
        }
        AI_PROVIDER_OPENAI | AI_PROVIDER_CODEX | AI_PROVIDER_GROQ => {
            let base = if provider == AI_PROVIDER_OPENAI {
                "https://api.openai.com"
            } else if provider == AI_PROVIDER_CODEX {
                "https://api.openai.com"
            } else {
                "https://api.groq.com"
            };

            let payload = serde_json::json!({
                "model": model,
                "messages": map_openai_style_messages(&request.messages),
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            });

            let response = client
                .post(format!("{base}/v1/chat/completions"))
                .header("Authorization", format!("Bearer {api_key}"))
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| {
                    format!(
                        "{} request failed: {e}",
                        if provider == AI_PROVIDER_OPENAI {
                            "OpenAI"
                        } else if provider == AI_PROVIDER_CODEX {
                            "Codex"
                        } else {
                            "Groq"
                        }
                    )
                })?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown provider error".to_string());
                return Err(format!(
                    "{} generation failed ({status}): {body}",
                    if provider == AI_PROVIDER_OPENAI {
                        "OpenAI"
                    } else if provider == AI_PROVIDER_CODEX {
                        "Codex"
                    } else {
                        "Groq"
                    }
                ));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Invalid provider response: {e}"))?;
            let content = json
                .get("choices")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|choice| choice.get("message"))
                .and_then(|msg| msg.get("content"))
                .map(extract_openrouter_content)
                .unwrap_or_default();

            if content.trim().is_empty() {
                return Err("Provider returned an empty response".to_string());
            }

            return Ok(AiChatResponse {
                content,
                model: json
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            });
        }
        AI_PROVIDER_GITHUB_COPILOT => {
            let payload = serde_json::json!({
                "model": model,
                "messages": map_openai_style_messages(&request.messages),
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            });

            let response = client
                .post("https://models.github.ai/inference/chat/completions")
                .header("Authorization", format!("Bearer {api_key}"))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2026-03-10")
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("GitHub Copilot request failed: {e}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown GitHub Copilot error".to_string());
                return Err(format!("GitHub Copilot generation failed ({status}): {body}"));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Invalid GitHub Copilot response: {e}"))?;

            let content = json
                .get("choices")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|choice| choice.get("message"))
                .and_then(|msg| msg.get("content"))
                .map(extract_openrouter_content)
                .unwrap_or_default();

            if content.trim().is_empty() {
                return Err("GitHub Copilot returned an empty response".to_string());
            }

            return Ok(AiChatResponse {
                content,
                model: json
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            });
        }
        AI_PROVIDER_ANTHROPIC => {
            let (system, messages) = map_anthropic_messages(&request.messages);
            let mut payload = serde_json::json!({
                "model": model,
                "messages": messages,
                "max_tokens": request.max_tokens.unwrap_or(1200),
                "temperature": request.temperature,
            });
            if let Some(system_prompt) = system {
                payload["system"] = serde_json::Value::String(system_prompt);
            }

            let response = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Anthropic request failed: {e}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown Anthropic error".to_string());
                return Err(format!("Anthropic generation failed ({status}): {body}"));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Invalid Anthropic response: {e}"))?;

            let content = json
                .get("content")
                .and_then(|v| v.as_array())
                .map(|parts| {
                    parts
                        .iter()
                        .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default();

            if content.trim().is_empty() {
                return Err("Anthropic returned an empty response".to_string());
            }

            return Ok(AiChatResponse {
                content,
                model: json
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            });
        }
        AI_PROVIDER_GEMINI => {
            let (system, contents) = map_gemini_messages(&request.messages);
            let model_path = if model.starts_with("models/") {
                model.clone()
            } else {
                format!("models/{model}")
            };
            let encoded_key = urlencoding::encode(api_key);
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/{model_path}:generateContent?key={encoded_key}"
            );

            let mut payload = serde_json::json!({
                "contents": contents,
                "generationConfig": {
                    "temperature": request.temperature,
                    "maxOutputTokens": request.max_tokens,
                }
            });
            if let Some(system_prompt) = system {
                payload["system_instruction"] = serde_json::json!({
                    "parts": [{ "text": system_prompt }]
                });
            }

            let response = client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Gemini request failed: {e}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown Gemini error".to_string());
                return Err(format!("Gemini generation failed ({status}): {body}"));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Invalid Gemini response: {e}"))?;

            let content = json
                .get("candidates")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|c| c.get("content"))
                .and_then(|c| c.get("parts"))
                .and_then(|p| p.as_array())
                .map(|parts| {
                    parts
                        .iter()
                        .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default();

            if content.trim().is_empty() {
                return Err("Gemini returned an empty response".to_string());
            }

            return Ok(AiChatResponse {
                content,
                model: json
                    .get("modelVersion")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or(Some(model)),
            });
        }
        _ => Err(format!("Unsupported AI provider: {provider}")),
    }
}

#[tauri::command]
pub async fn connect_database(mut config: ConnectionConfig) -> Result<(), String> {
    // ── SSH tunnel setup ───────────────────────────────────────────────────────
    if config.ssh_enabled.unwrap_or(false) {
        let ssh_host = config.ssh_host.clone().ok_or("SSH host is required")?;
        let ssh_port = config.ssh_port.unwrap_or(22);
        let ssh_user = config.ssh_user.clone().ok_or("SSH user is required")?;

        let auth = if let Some(key_path) = config.ssh_key_path.clone().filter(|p| !p.is_empty()) {
            SshAuth::Key {
                path: key_path,
                passphrase: config.ssh_key_passphrase.clone().filter(|p| !p.is_empty()),
            }
        } else {
            let pw = config.ssh_password.clone().unwrap_or_default();
            SshAuth::Password(pw)
        };

        // The DB host/port to forward to (from the connection config)
        let db_host = config
            .host
            .clone()
            .unwrap_or_else(|| "localhost".to_string());
        let db_port = config.port.unwrap_or(5432);

        let tunnel = SshTunnel::establish(&ssh_host, ssh_port, &ssh_user, auth, db_host, db_port)
            .await
            .map_err(|e| format!("SSH tunnel failed: {e}"))?;

        // Redirect the driver to connect via the local tunnel port
        config.host = Some("127.0.0.1".to_string());
        config.port = Some(tunnel.local_port);

        REGISTRY.tunnels.insert(config.id.clone(), tunnel);
    }

    let driver: Arc<dyn DatabaseDriver> = match config.db_type {
        DatabaseType::Postgresql => Arc::new(PostgresDriver::new()),
        DatabaseType::Mysql => Arc::new(MySqlDriver::new()),
        DatabaseType::Sqlite => Arc::new(SqliteDriver::new()),
        DatabaseType::Mongodb => Arc::new(MongoDriver::new()),
        DatabaseType::Redis => Arc::new(RedisDriver::new()),
    };

    if let Err(e) = driver.connect(&config).await {
        // If the driver connect fails, clean up the tunnel we just opened
        if let Some((_, tunnel)) = REGISTRY.tunnels.remove(&config.id) {
            tunnel.close();
        }
        return Err(e.to_string());
    }

    REGISTRY.connections.insert(config.id.clone(), driver);
    REGISTRY.configs.insert(config.id.clone(), config);

    Ok(())
}

#[tauri::command]
pub async fn disconnect_database(id: String) -> Result<(), String> {
    if let Some((_, driver)) = REGISTRY.connections.remove(&id) {
        driver.disconnect().await.map_err(|e| e.to_string())?;
    }
    // Close SSH tunnel after the driver disconnects
    if let Some((_, tunnel)) = REGISTRY.tunnels.remove(&id) {
        tunnel.close();
    }
    REGISTRY.configs.remove(&id);
    Ok(())
}

#[tauri::command]
pub async fn get_databases(id: String) -> Result<Vec<String>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver.get_databases().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_database(id: String, name: String) -> Result<(), String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver.create_database(&name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tables(
    id: String,
    database: String,
    schema: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver
        .get_tables(&database, schema.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_query(id: String, query: String, timeout_secs: Option<u64>) -> Result<QueryResult, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let secs = timeout_secs.unwrap_or(30);
    let duration = std::time::Duration::from_secs(secs);
    tokio_timeout(duration, driver.run_query(&query))
        .await
        .map_err(|_| format!("Query timed out after {}s", secs))?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ping_connection(id: String) -> Result<u64, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Choose ping query based on DB type to avoid sending SQL to non-relational DBs
    let ping_query = if let Some(cfg) = REGISTRY.configs.get(&id) {
        match cfg.db_type {
            DatabaseType::Redis => "PING",
            DatabaseType::Mongodb => r#"{"ping": 1}"#,
            _ => "SELECT 1",
        }
    } else {
        "SELECT 1"
    };

    let start = std::time::Instant::now();
    driver.run_query(ping_query).await.map_err(|e| e.to_string())?;
    Ok(start.elapsed().as_millis() as u64)
}

#[tauri::command]
pub async fn get_table_data(
    id: String,
    database: String,
    table: String,
    page: u32,
    page_size: u32,
) -> Result<QueryResult, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let mut result = driver
        .get_table_data(&database, &table, page, page_size)
        .await
        .map_err(|e| e.to_string())?;

    // If table is empty, still return column names so the UI can show headers
    if result.rows.is_empty() && result.columns.is_empty() {
        if let Ok(col_infos) = driver.get_columns(&database, &table, None).await {
            result.columns = col_infos.iter().map(|c| c.name.clone()).collect();
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_user_databases(id: String) -> Result<Vec<String>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Return all databases — let the user pick which one to work with
    driver.get_databases().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_tables(
    id: String,
    database: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Determine which databases to query:
    // 1. Explicit override (user selected from dropdown) → only that one
    // 2. Configured database in connection config → only that one
    // 3. Otherwise → all user databases (system DBs filtered out)
    let target_dbs: Vec<String> = if let Some(db) = database {
        vec![db]
    } else {
        let config = REGISTRY.configs.get(&id);
        let configured_db = config.as_ref().and_then(|c| c.database.clone());
        if let Some(db) = configured_db {
            vec![db]
        } else {
            let all_dbs = driver.get_databases().await.map_err(|e| e.to_string())?;
            all_dbs
                .into_iter()
                .filter(|db| !SYSTEM_DATABASES.contains(&db.to_lowercase().as_str()))
                .collect()
        }
    };

    let target_dbs = if target_dbs.is_empty() {
        vec!["default".to_string()]
    } else {
        target_dbs
    };

    let mut all_tables: Vec<TableInfo> = Vec::new();
    for db in &target_dbs {
        match driver.get_tables(db, None).await {
            Ok(tables) => {
                for mut table in tables {
                    if table.schema.is_none() {
                        table.schema = Some(db.clone());
                    }
                    all_tables.push(table);
                }
            }
            Err(e) => eprintln!("[list_all_tables] get_tables({db}) failed: {e}"),
        }
    }

    Ok(all_tables)
}

#[tauri::command]
pub async fn get_table_structure(
    id: String,
    database: String,
    table: String,
    schema: Option<String>,
) -> Result<TableStructure, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let columns = driver
        .get_columns(&database, &table, schema.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let indexes = driver
        .get_indexes(&database, &table, schema.as_deref())
        .await
        .unwrap_or_default();

    Ok(TableStructure { columns, indexes })
}

#[tauri::command]
pub async fn get_schema_graph(
    id: String,
    database: String,
    schema: Option<String>,
) -> Result<SchemaGraph, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let config = REGISTRY
        .configs
        .get(&id)
        .ok_or_else(|| "Connection config not found".to_string())?;

    let resolved_schema = match config.db_type {
        DatabaseType::Postgresql | DatabaseType::Sqlite => {
            schema.clone().or_else(|| Some(database.clone()))
        }
        _ => schema.clone(),
    };

    let tables = driver
        .get_tables(&database, resolved_schema.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let mut graph_tables = Vec::new();
    for table in tables {
        let table_schema = table.schema.clone().or_else(|| resolved_schema.clone());
        let columns = driver
            .get_columns(&database, &table.name, table_schema.as_deref())
            .await
            .map_err(|e| e.to_string())?;

        graph_tables.push(SchemaGraphTable {
            name: table.name,
            schema: table_schema,
            columns,
        });
    }

    let relationships = driver
        .get_foreign_keys(&database, resolved_schema.as_deref())
        .await
        .unwrap_or_default();

    Ok(SchemaGraph {
        tables: graph_tables,
        relationships,
    })
}

/// Reconnect the driver to a different database within the same server.
/// Required for PostgreSQL where you cannot change the database of an existing
/// connection — a new pool must be created. For other drivers this is a no-op
/// reconnect that also updates the active database.
#[tauri::command]
pub async fn switch_database(id: String, database: String) -> Result<(), String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?
        .clone();

    let mut new_config = REGISTRY
        .configs
        .get(&id)
        .ok_or_else(|| "Connection config not found".to_string())?
        .clone();

    new_config.database = Some(database.clone());

    driver
        .connect(&new_config)
        .await
        .map_err(|e| e.to_string())?;

    REGISTRY
        .configs
        .entry(id)
        .and_modify(|c| c.database = Some(database));

    Ok(())
}

#[tauri::command]
pub async fn dump_database(
    id: String,
    database: String,
    schema: Option<String>,
    include_data: bool,
    include_indexes: bool,
    include_foreign_keys: bool,
    create_database: bool,
) -> Result<String, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let config = REGISTRY
        .configs
        .get(&id)
        .ok_or_else(|| "Connection config not found".to_string())?;

    match config.db_type {
        DatabaseType::Postgresql | DatabaseType::Mysql | DatabaseType::Sqlite => {
            driver
                .dump_database(
                    &database,
                    schema.as_deref(),
                    include_data,
                    include_indexes,
                    include_foreign_keys,
                    create_database,
                )
                .await
                .map_err(|e| e.to_string())
        }
        _ => Err("Dump not supported for this database type".to_string()),
    }
}

#[tauri::command]
pub async fn import_sql_file(
    id: String,
    sql_content: String,
    target_database: Option<String>,
    drop_existing: bool,
    ignore_errors: bool,
) -> Result<ImportSqlResult, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let parsed = sql_import::parse_sql_dump(&sql_content);

    // "Create new database" mode: CREATE DATABASE then reconnect the driver
    if let Some(ref raw_db_name) = target_database {
        // Strip any surrounding SQL quote characters that may have been passed
        // in from a pg_dump \connect "name" or USE `name` line.
        let db_name = raw_db_name
            .trim()
            .trim_matches('"')
            .trim_matches('`')
            .trim_matches('\'');

        if db_name.is_empty() {
            return Err("Target database name is empty".to_string());
        }

        let config = REGISTRY
            .configs
            .get(&id)
            .ok_or_else(|| "Connection config not found".to_string())?
            .clone();
        let create_sql = match config.db_type {
            DatabaseType::Mysql => format!("CREATE DATABASE IF NOT EXISTS `{}`", db_name),
            _ => format!("CREATE DATABASE \"{}\"", db_name),
        };
        // Best-effort — ignore error (DB may already exist, or user lacks
        // CREATE DATABASE privilege; the subsequent connect will surface the
        // real error if the database truly doesn't exist).
        let _ = driver.run_query(&create_sql).await;
        let mut new_cfg = config.clone();
        new_cfg.database = Some(db_name.to_string());
        driver
            .connect(&new_cfg)
            .await
            .map_err(|e| format!(
                "Could not connect to database \"{}\": {}. \
                 If you lack CREATE DATABASE privileges, create the database \
                 manually first and use \"Import into current database\" mode.",
                db_name, e
            ))?;
        REGISTRY
            .configs
            .entry(id.clone())
            .and_modify(|c| c.database = Some(db_name.to_string()));
    }

    // Optionally prepend DROP TABLE IF EXISTS before each CREATE TABLE
    let statements: Vec<String> = if drop_existing {
        let mut out = Vec::with_capacity(parsed.statements.len() * 2);
        for stmt in &parsed.statements {
            let upper = stmt.trim().to_uppercase();
            if upper.starts_with("CREATE TABLE") {
                let tokens: Vec<&str> = stmt.split_whitespace().collect();
                // Handle CREATE TABLE [IF NOT EXISTS] name (
                let ni = if tokens.get(2).map(|s| s.eq_ignore_ascii_case("IF")) == Some(true) {
                    4 // IF NOT EXISTS <name>
                } else {
                    2
                };
                if let Some(raw_name) = tokens.get(ni) {
                    // Trim trailing '(' that may be attached to the name
                    let name = raw_name.trim_end_matches('(');
                    out.push(format!("DROP TABLE IF EXISTS {}", name));
                }
            }
            out.push(stmt.clone());
        }
        out
    } else {
        parsed.statements.clone()
    };

    let mut executed = 0u32;
    let mut skipped = 0u32;
    let mut errors: Vec<String> = Vec::new();

    for stmt in &statements {
        let t = stmt.trim();
        if t.is_empty() {
            skipped += 1;
            continue;
        }
        match driver.run_query(t).await {
            Ok(_) => executed += 1,
            Err(e) => {
                let preview = &t[..t.len().min(120)];
                let msg = format!("Statement failed: {}\nError: {}", preview, e);
                if ignore_errors {
                    errors.push(msg);
                    skipped += 1;
                } else {
                    return Err(msg);
                }
            }
        }
    }

    Ok(ImportSqlResult {
        executed,
        skipped,
        errors,
        detected_db_name: parsed.detected_db_name,
        detected_format: parsed.detected_format,
    })
}

// ── App info commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ── Storage commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn storage_load_connections() -> Result<Vec<ConnectionConfig>, String> {
    AppStorage::get()
        .load_connections()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_connection(connection: ConnectionConfig) -> Result<(), String> {
    AppStorage::get()
        .save_connection(&connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_connection(id: String) -> Result<(), String> {
    AppStorage::get()
        .delete_connection(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_load_queries() -> Result<Vec<SavedQuery>, String> {
    AppStorage::get()
        .load_queries()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_query(query: SavedQuery) -> Result<(), String> {
    AppStorage::get()
        .save_query(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_query(id: String) -> Result<(), String> {
    AppStorage::get()
        .delete_query(&id)
        .await
        .map_err(|e| e.to_string())
}

// ── User snippet commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn storage_load_snippets() -> Result<Vec<UserSnippet>, String> {
    AppStorage::get()
        .load_snippets()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_snippet(snippet: UserSnippet) -> Result<(), String> {
    AppStorage::get()
        .save_snippet(&snippet)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_snippet(id: String) -> Result<(), String> {
    AppStorage::get()
        .delete_snippet(&id)
        .await
        .map_err(|e| e.to_string())
}

// ── Workspace snapshot commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn storage_save_workspace(snapshot_json: String) -> Result<(), String> {
    AppStorage::get()
        .save_workspace_snapshot(&snapshot_json)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_load_workspace() -> Result<Option<String>, String> {
    AppStorage::get()
        .load_workspace_snapshot()
        .await
        .map_err(|e| e.to_string())
}

// ── Query history commands ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn storage_load_history() -> Result<Vec<crate::types::QueryHistoryEntry>, String> {
    AppStorage::get()
        .load_history()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_history_entry(
    entry: crate::types::QueryHistoryEntry,
) -> Result<(), String> {
    AppStorage::get()
        .save_history_entry(&entry)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_clear_history(connection_id: String) -> Result<(), String> {
    AppStorage::get()
        .clear_history_for_connection(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_clear_all_history() -> Result<(), String> {
    AppStorage::get()
        .clear_all_history()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_history_entry(id: String) -> Result<(), String> {
    AppStorage::get()
        .delete_history_entry(&id)
        .await
        .map_err(|e| e.to_string())
}

// ── AI commands (provider-agnostic) ───────────────────────────────────────────

#[tauri::command]
pub async fn ai_get_credential_status(provider: String) -> Result<AiCredentialStatus, String> {
    let provider = normalize_ai_provider(&provider)?;
    let maybe = AppStorage::get()
        .load_ai_credential(provider)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(cred) = maybe {
        Ok(AiCredentialStatus {
            provider: cred.provider,
            auth_mode: cred.auth_mode,
            configured: true,
            masked_key: Some(mask_api_key(&cred.api_key)),
        })
    } else {
        Ok(AiCredentialStatus {
            provider: provider.to_string(),
            auth_mode: "none".to_string(),
            configured: false,
            masked_key: None,
        })
    }
}

#[tauri::command]
pub async fn ai_save_api_key(provider: String, api_key: String) -> Result<AiCredentialStatus, String> {
    let provider = normalize_ai_provider(&provider)?;
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("API key is required".to_string());
    }

    ai_provider_models_ping(provider, trimmed).await?;

    AppStorage::get()
        .save_ai_credential(provider, "api_key", trimmed)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AiCredentialStatus {
        provider: provider.to_string(),
        auth_mode: "api_key".to_string(),
        configured: true,
        masked_key: Some(mask_api_key(trimmed)),
    })
}

#[tauri::command]
pub async fn ai_test_api_key(provider: String, api_key: String) -> Result<(), String> {
    let provider = normalize_ai_provider(&provider)?;
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("API key is required".to_string());
    }
    ai_provider_models_ping(provider, trimmed).await
}

#[tauri::command]
pub async fn ai_clear_credential(provider: String) -> Result<(), String> {
    let provider = normalize_ai_provider(&provider)?;
    AppStorage::get()
        .clear_ai_credential(provider)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_chat_completion(request: AiChatRequest) -> Result<AiChatResponse, String> {
    let provider = normalize_ai_provider(&request.provider)?;
    let credential = AppStorage::get()
        .load_ai_credential(provider)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("{} is not configured", provider.to_ascii_uppercase()))?;

    ai_chat_completion_with_provider(provider, &request, &credential.api_key).await
}

// ── AI / OpenRouter compatibility commands ───────────────────────────────────

#[tauri::command]
pub async fn openrouter_get_credential_status() -> Result<OpenRouterCredentialStatus, String> {
    let s = ai_get_credential_status(AI_PROVIDER_OPENROUTER.to_string()).await?;
    Ok(OpenRouterCredentialStatus {
        provider: s.provider,
        auth_mode: s.auth_mode,
        configured: s.configured,
        masked_key: s.masked_key,
    })
}

#[tauri::command]
pub async fn openrouter_save_api_key(api_key: String) -> Result<OpenRouterCredentialStatus, String> {
    let s = ai_save_api_key(AI_PROVIDER_OPENROUTER.to_string(), api_key).await?;
    Ok(OpenRouterCredentialStatus {
        provider: s.provider,
        auth_mode: s.auth_mode,
        configured: s.configured,
        masked_key: s.masked_key,
    })
}

#[tauri::command]
pub async fn openrouter_test_api_key(api_key: String) -> Result<(), String> {
    ai_test_api_key(AI_PROVIDER_OPENROUTER.to_string(), api_key).await
}

#[tauri::command]
pub async fn openrouter_clear_credential() -> Result<(), String> {
    ai_clear_credential(AI_PROVIDER_OPENROUTER.to_string()).await
}

#[tauri::command]
pub async fn openrouter_oauth_begin() -> Result<OpenRouterOAuthBeginResult, String> {
    let flow_id = format!("or-flow-{}", uuid::Uuid::new_v4());

    let mut verifier_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);
    let code_challenge = {
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        URL_SAFE_NO_PAD.encode(hasher.finalize())
    };

    // Bind to port 0 so the OS assigns a free port automatically.
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to start OAuth callback server ({e})."))?;
    let local_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read OAuth callback port ({e})."))?
        .port();
    let callback_url = format!("http://localhost:{local_port}/openrouter/callback");

    OPENROUTER_OAUTH_FLOWS.insert(
        flow_id.clone(),
        OpenRouterOAuthFlow {
            code_verifier: code_verifier.clone(),
            code: None,
            error: None,
            created_at: Instant::now(),
        },
    );

    let flow_id_for_task = flow_id.clone();
    tokio::spawn(async move {
        let accept = tokio::time::timeout(Duration::from_secs(240), listener.accept()).await;
        let Ok(Ok((mut socket, _peer))) = accept else {
            if let Some(mut flow) = OPENROUTER_OAUTH_FLOWS.get_mut(&flow_id_for_task) {
                flow.error = Some("OAuth callback timeout".to_string());
            }
            return;
        };

        let mut buffer = vec![0u8; 8192];
        let read_bytes = socket.read(&mut buffer).await.unwrap_or(0);
        let request = String::from_utf8_lossy(&buffer[..read_bytes]).to_string();
        let path = request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .unwrap_or("/")
            .to_string();

        let mut code: Option<String> = None;
        let mut error: Option<String> = None;
        if let Ok(parsed) = url::Url::parse(&format!("http://localhost{path}")) {
            for (k, v) in parsed.query_pairs() {
                if k == "code" {
                    code = Some(v.to_string());
                } else if k == "error" {
                    error = Some(v.to_string());
                }
            }
        }

        let ok = code.is_some() && error.is_none();
        let body = if ok {
            "<html><body style=\"font-family:system-ui;padding:24px;\"><h2>DB Connect</h2><p>OpenRouter connected successfully. You can close this tab.</p></body></html>"
        } else {
            "<html><body style=\"font-family:system-ui;padding:24px;\"><h2>DB Connect</h2><p>OpenRouter authorization failed. Return to the app and try again.</p></body></html>"
        };
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        let _ = socket.write_all(response.as_bytes()).await;

        if let Some(mut flow) = OPENROUTER_OAUTH_FLOWS.get_mut(&flow_id_for_task) {
            flow.code = code;
            flow.error = error;
        }
    });

    let encoded_callback = urlencoding::encode(&callback_url);
    let encoded_challenge = urlencoding::encode(&code_challenge);
    let auth_url = format!(
        "https://openrouter.ai/auth?callback_url={encoded_callback}&code_challenge={encoded_challenge}&code_challenge_method=S256"
    );

    Ok(OpenRouterOAuthBeginResult {
        flow_id,
        auth_url,
        callback_url,
    })
}

#[tauri::command]
pub async fn openrouter_oauth_complete(flow_id: String) -> Result<OpenRouterCredentialStatus, String> {
    let start = Instant::now();
    let timeout = Duration::from_secs(240);

    loop {
        if start.elapsed() > timeout {
            OPENROUTER_OAUTH_FLOWS.remove(&flow_id);
            return Err("OAuth authorization timed out".to_string());
        }

        let current = OPENROUTER_OAUTH_FLOWS.get(&flow_id).map(|f| f.clone());
        let Some(flow) = current else {
            return Err("OAuth flow not found. Please start again.".to_string());
        };

        if flow.created_at.elapsed() > Duration::from_secs(600) {
            OPENROUTER_OAUTH_FLOWS.remove(&flow_id);
            return Err("OAuth flow expired. Please start again.".to_string());
        }

        if let Some(err) = flow.error.clone() {
            OPENROUTER_OAUTH_FLOWS.remove(&flow_id);
            return Err(format!("OpenRouter OAuth failed: {err}"));
        }

        if let Some(code) = flow.code.clone() {
            OPENROUTER_OAUTH_FLOWS.remove(&flow_id);
            let client = reqwest::Client::new();
            let exchange_payload = serde_json::json!({
                "code": code,
                "code_verifier": flow.code_verifier,
                "code_challenge_method": "S256"
            });

            let response = client
                .post("https://openrouter.ai/api/v1/auth/keys")
                .header("Content-Type", "application/json")
                .json(&exchange_payload)
                .send()
                .await
                .map_err(|e| format!("OAuth exchange failed: {e}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown OpenRouter error".to_string());
                return Err(format!("OAuth exchange failed ({status}): {body}"));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Invalid OAuth response: {e}"))?;
            let key = json
                .get("key")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "OpenRouter did not return an API key".to_string())?
                .trim()
                .to_string();

            if key.is_empty() {
                return Err("OpenRouter returned an empty API key".to_string());
            }

            AppStorage::get()
                .save_ai_credential(AI_PROVIDER_OPENROUTER, "oauth", &key)
                .await
                .map_err(|e| e.to_string())?;

            return Ok(OpenRouterCredentialStatus {
                provider: "openrouter".to_string(),
                auth_mode: "oauth".to_string(),
                configured: true,
                masked_key: Some(mask_api_key(&key)),
            });
        }

        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

#[tauri::command]
pub async fn openrouter_chat_completion(
    request: OpenRouterChatRequest,
) -> Result<OpenRouterChatResponse, String> {
    let generic = ai_chat_completion(AiChatRequest {
        provider: AI_PROVIDER_OPENROUTER.to_string(),
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
    })
    .await?;

    Ok(OpenRouterChatResponse {
        content: generic.content,
        model: generic.model,
    })
}

// ── Import / Export commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn export_connections(opts: crate::types::ExportOptions) -> Result<String, String> {
    let conns = AppStorage::get()
        .load_connections()
        .await
        .map_err(|e| e.to_string())?;

    match opts.format {
        crate::types::ExportFormat::Json => {
            crate::import_export::export_native_json(&conns, &opts).map_err(|e| e.to_string())
        }
        crate::types::ExportFormat::Uri => Ok(crate::import_export::export_uri_text(
            &conns,
            opts.include_passwords,
        )),
    }
}

#[tauri::command]
pub async fn import_connections(
    content: String,
    opts: crate::types::ImportOptions,
) -> Result<crate::types::ImportResult, String> {
    let existing = AppStorage::get()
        .load_connections()
        .await
        .map_err(|e| e.to_string())?;
    let existing_ids: std::collections::HashSet<String> =
        existing.iter().map(|c| c.id.clone()).collect();

    let result = match opts.format {
        crate::types::ImportFormat::Json => {
            crate::import_export::import_native_json(&content, &opts, &existing_ids)
                .map_err(|e| e.to_string())?
        }
        crate::types::ImportFormat::Dbeaver => {
            crate::import_export::import_dbeaver(&content, &opts, &existing_ids)
                .map_err(|e| e.to_string())?
        }
        crate::types::ImportFormat::Uri => {
            return Err("Use parse_connection_uri for single URIs".to_string());
        }
    };

    for conn in &result.connections {
        AppStorage::get()
            .save_connection(conn)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(result)
}

#[tauri::command]
pub async fn parse_connection_uri(uri: String) -> Result<crate::types::ConnectionConfig, String> {
    crate::import_export::parse_uri(&uri).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_export_protected(content: String) -> Result<bool, String> {
    let export: crate::types::ConnectionExport =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(export.password_protected)
}

// ── Updater commands ───────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();
    let updater = app.updater_builder().build().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            current_version: current,
            body: update.body.clone(),
        }),
        None => Ok(UpdateInfo {
            available: false,
            version: None,
            current_version: current,
            body: None,
        }),
    }
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater_builder().build().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    // The updater installs the new bundle, but the app still needs to relaunch
    // into it explicitly.
    app.request_restart();

    Ok(())
}

// ── License commands ───────────────────────────────────────────────────────────

/// Returns the stable device UUID for this installation (generated on first run).
#[tauri::command]
pub async fn license_get_device_id() -> Result<String, String> {
    license::get_or_create_device_id()
        .await
        .map_err(|e| e.to_string())
}

/// Runs the full offline license check and returns the result.
/// Called on every app startup before showing the main UI.
#[tauri::command]
pub async fn license_check_offline() -> license::OfflineCheckResult {
    license::verify_offline().await
}

/// Verifies a signed license payload (received from the activation server)
/// and persists it as the local license state for this device.
#[tauri::command]
pub async fn license_verify_and_store(
    license_payload: license::SignedLicense,
) -> Result<license::OfflineCheckResult, String> {
    license::verify_and_store(license_payload)
        .await
        .map_err(|e| e.to_string())
}

/// Clears the stored license state (deactivates this device).
#[tauri::command]
pub async fn license_deactivate() -> Result<(), String> {
    license::clear_state().await.map_err(|e| e.to_string())
}

/// Returns the currently stored license state, or null if none.
#[tauri::command]
pub async fn license_get_stored() -> Result<Option<license::StoredLicenseState>, String> {
    license::load_state().await.map_err(|e| e.to_string())
}

/// Updates `last_validated_at` after a successful background online sync.
#[tauri::command]
pub async fn license_update_validated() -> Result<(), String> {
    license::update_last_validated()
        .await
        .map_err(|e| e.to_string())
}

// ── Font commands ──────────────────────────────────────────────────────────────

/// Returns all font family names installed on the system.
/// Uses native OS font APIs: CoreText on macOS, DirectWrite on Windows,
/// and Fontconfig / FreeType on Linux — the same strategy used by Zed.
#[tauri::command]
pub fn get_system_fonts() -> Vec<String> {
    use font_kit::source::SystemSource;
    let source = SystemSource::new();
    let mut families = source.all_families().unwrap_or_default();
    families.sort_unstable_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    families
}

/// Returns the human-readable device name for the current machine.
/// On macOS uses the friendly computer name (System Preferences → Sharing).
/// Falls back to OS hostname on other platforms.
#[tauri::command]
pub async fn license_get_device_name() -> String {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // scutil --get ComputerName returns the friendly name set in System Preferences
        if let Ok(out) = Command::new("scutil").args(["--get", "ComputerName"]).output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
        // Fall back to hostname
        if let Ok(out) = Command::new("hostname").output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
        "My Mac".to_string()
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "My Windows PC".to_string())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        use std::process::Command;
        if let Ok(out) = Command::new("hostname").output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
        std::env::var("HOSTNAME").unwrap_or_else(|_| "My Device".to_string())
    }
}
