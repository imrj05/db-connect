/// SQL dump parser.
///
/// Handles format detection, statement splitting, and preamble stripping for
/// dump files produced by phpMyAdmin, pg_dump, MySQL Workbench, and the SQLite
/// CLI. The output is a list of clean SQL statements that can be executed
/// directly against the target database.

// ── Public types ──────────────────────────────────────────────────────────────

pub struct ParsedSqlDump {
    /// Individual SQL statements, preamble stripped, ready to execute.
    pub statements: Vec<String>,
    /// Database name found in the dump (from USE / \connect / CREATE DATABASE).
    pub detected_db_name: Option<String>,
    /// One of: "phpmyadmin", "pg_dump", "mysql_workbench", "sqlite_cli", "generic".
    pub detected_format: String,
}

/// Parse a full SQL dump string into clean, executable statements.
pub fn parse_sql_dump(content: &str) -> ParsedSqlDump {
    let detected_format = detect_dump_format(content);
    let raw = split_statements(content);
    let detected_db_name = extract_db_name(&raw);
    let statements = raw
        .into_iter()
        .filter(|s| !should_strip(s))
        .collect();
    ParsedSqlDump {
        statements,
        detected_db_name,
        detected_format,
    }
}

// ── Format detection ──────────────────────────────────────────────────────────

fn detect_dump_format(content: &str) -> String {
    let header = &content[..content.len().min(2000)];
    if header.contains("-- phpMyAdmin SQL Dump") {
        "phpmyadmin".to_string()
    } else if header.contains("-- PostgreSQL database dump")
        || header.contains("SET client_encoding")
    {
        "pg_dump".to_string()
    } else if header.contains("-- MySQL Workbench") {
        "mysql_workbench".to_string()
    } else if header.contains("PRAGMA foreign_keys") {
        "sqlite_cli".to_string()
    } else {
        "generic".to_string()
    }
}

// ── Database name extraction ──────────────────────────────────────────────────

fn extract_db_name(statements: &[String]) -> Option<String> {
    for stmt in statements {
        let trimmed = stmt.trim();
        let upper = trimmed.to_uppercase();

        // MySQL: USE `dbname` or USE "dbname" or USE dbname
        if upper.starts_with("USE ") {
            let rest = trimmed[4..].trim();
            let name = rest
                .trim_matches('`')
                .trim_matches('"')
                .trim_end_matches(';')
                .trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }

        // pg_dump: \connect dbname
        if upper.starts_with("\\CONNECT ") {
            let rest = trimmed[9..].trim().trim_end_matches(';').trim();
            if !rest.is_empty() && rest != "-" {
                return Some(rest.to_string());
            }
        }

        // CREATE DATABASE [IF NOT EXISTS] dbname
        if upper.starts_with("CREATE DATABASE") {
            let tokens: Vec<&str> = trimmed.split_whitespace().collect();
            // tokens: [CREATE, DATABASE, (IF, NOT, EXISTS,)? name, ...]
            let name_idx =
                if tokens.get(2).map(|s| s.eq_ignore_ascii_case("IF")) == Some(true) {
                    4 // IF NOT EXISTS <name>
                } else {
                    2
                };
            if let Some(raw) = tokens.get(name_idx) {
                let name = raw
                    .trim_matches('`')
                    .trim_matches('"')
                    .trim_end_matches(';')
                    .trim();
                if !name.is_empty() {
                    return Some(name.to_string());
                }
            }
        }
    }
    None
}

// ── Statement splitter ────────────────────────────────────────────────────────

#[derive(Debug, PartialEq)]
enum State {
    Normal,
    SingleQuote,
    DoubleQuote,
    Backtick,
    LineComment,
    BlockComment,
    DollarQuote(String),
    /// Custom delimiter active (MySQL DELIMITER $$)
    CustomDelim(String),
}

/// Split a SQL dump into individual statements using a character-level state
/// machine that handles all quoting styles, comments, dollar-quoting (PG),
/// and MySQL DELIMITER directives.
fn split_statements(content: &str) -> Vec<String> {
    let chars: Vec<char> = content.chars().collect();
    let len = chars.len();

    let mut statements: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut state = State::Normal;
    // Current statement delimiter (';' by default, changed by DELIMITER cmd).
    let mut delimiter: Vec<char> = vec![';'];
    let mut i = 0;

    while i < len {
        let ch = chars[i];

        match state {
            // ── Inside a single-quoted string ──────────────────────────────
            State::SingleQuote => {
                current.push(ch);
                if ch == '\'' {
                    // '' is an escaped quote — stay inside
                    if i + 1 < len && chars[i + 1] == '\'' {
                        current.push(chars[i + 1]);
                        i += 2;
                        continue;
                    }
                    state = State::Normal;
                } else if ch == '\\' && i + 1 < len {
                    // MySQL backslash escape (e.g. \')
                    current.push(chars[i + 1]);
                    i += 2;
                    continue;
                }
            }

            // ── Inside a double-quoted identifier ──────────────────────────
            State::DoubleQuote => {
                current.push(ch);
                if ch == '"' {
                    if i + 1 < len && chars[i + 1] == '"' {
                        current.push(chars[i + 1]);
                        i += 2;
                        continue;
                    }
                    state = State::Normal;
                }
            }

            // ── Inside a backtick-quoted identifier ────────────────────────
            State::Backtick => {
                current.push(ch);
                if ch == '`' {
                    state = State::Normal;
                }
            }

            // ── Inside a line comment ───────────────────────────────────────
            State::LineComment => {
                if ch == '\n' {
                    state = State::Normal;
                }
                // Do not push comment chars into current statement
            }

            // ── Inside a block comment ─────────────────────────────────────
            State::BlockComment => {
                if ch == '*' && i + 1 < len && chars[i + 1] == '/' {
                    i += 2;
                    state = State::Normal;
                    continue;
                }
                // Drop comment content
            }

            // ── Inside a dollar-quoted string ──────────────────────────────
            State::DollarQuote(ref tag) => {
                // Check if the closing tag starts here
                let tag_chars: Vec<char> = tag.chars().collect();
                let tlen = tag_chars.len();
                if i + tlen <= len && chars[i..i + tlen] == tag_chars[..] {
                    // Push the closing tag and return to Normal
                    for &c in &tag_chars {
                        current.push(c);
                    }
                    i += tlen;
                    state = State::Normal;
                    continue;
                } else {
                    current.push(ch);
                }
            }

            // ── Custom delimiter mode (MySQL stored procs) ─────────────────
            State::CustomDelim(ref delim) => {
                let dchars: Vec<char> = delim.chars().collect();
                let dlen = dchars.len();
                if i + dlen <= len && chars[i..i + dlen] == dchars[..] {
                    // End of statement
                    let s = current.trim().to_string();
                    if !s.is_empty() {
                        statements.push(s);
                    }
                    current = String::new();
                    i += dlen;
                    continue;
                } else {
                    current.push(ch);
                }
            }

            // ── Normal state ───────────────────────────────────────────────
            State::Normal => {
                // ── Line comment: -- or # ─────────────────────────────────
                if ch == '-' && i + 1 < len && chars[i + 1] == '-' {
                    state = State::LineComment;
                    i += 2;
                    continue;
                }
                if ch == '#' {
                    state = State::LineComment;
                    i += 1;
                    continue;
                }

                // ── Block comment: /* ... */  ─────────────────────────────
                // phpMyAdmin uses /*! ... */ for version-conditional SQL.
                // We treat both as comments so they get stripped.
                if ch == '/' && i + 1 < len && chars[i + 1] == '*' {
                    state = State::BlockComment;
                    i += 2;
                    continue;
                }

                // ── Quoted strings / identifiers ──────────────────────────
                if ch == '\'' {
                    current.push(ch);
                    state = State::SingleQuote;
                    i += 1;
                    continue;
                }
                if ch == '"' {
                    current.push(ch);
                    state = State::DoubleQuote;
                    i += 1;
                    continue;
                }
                if ch == '`' {
                    current.push(ch);
                    state = State::Backtick;
                    i += 1;
                    continue;
                }

                // ── Dollar-quoting (PostgreSQL) ────────────────────────────
                if ch == '$' {
                    if let Some(tag) = try_read_dollar_tag(&chars, i) {
                        let tag_chars: Vec<char> = tag.chars().collect();
                        let tlen = tag_chars.len();
                        // Push the opening tag into current
                        for &c in &tag_chars {
                            current.push(c);
                        }
                        i += tlen;
                        // The content until closing $tag$ belongs to DollarQuote
                        // Build closing tag = same as opening tag
                        state = State::DollarQuote(tag);
                        continue;
                    }
                    // Not a dollar-quote — push the $ literally
                    current.push(ch);
                    i += 1;
                    continue;
                }

                // ── DELIMITER command (MySQL stored procedures) ────────────
                // Detect "DELIMITER <token>" at the start of a statement line
                if (ch == 'D' || ch == 'd') && current.trim().is_empty() {
                    let keyword = "DELIMITER";
                    if i + keyword.len() < len {
                        let slice: String = chars[i..i + keyword.len()].iter().collect();
                        if slice.eq_ignore_ascii_case(keyword) {
                            // Read the new delimiter: rest of the line
                            let start = i + keyword.len();
                            let end = chars[start..]
                                .iter()
                                .position(|&c| c == '\n')
                                .map(|p| start + p)
                                .unwrap_or(len);
                            let new_delim: String =
                                chars[start..end].iter().collect::<String>().trim().to_string();
                            i = end;
                            if new_delim == ";" {
                                // Back to standard delimiter
                                delimiter = vec![';'];
                                state = State::Normal;
                            } else if !new_delim.is_empty() {
                                delimiter = new_delim.chars().collect();
                                state = State::CustomDelim(new_delim);
                            }
                            continue;
                        }
                    }
                }

                // ── Statement terminator ──────────────────────────────────
                let dlen = delimiter.len();
                if delimiter == vec![';']
                    && ch == ';'
                    && !matches!(state, State::CustomDelim(_))
                {
                    let s = current.trim().to_string();
                    if !s.is_empty() {
                        statements.push(s);
                    }
                    current = String::new();
                    i += 1;
                    continue;
                } else if delimiter.len() > 1
                    && i + dlen <= len
                    && chars[i..i + dlen] == delimiter[..]
                {
                    let s = current.trim().to_string();
                    if !s.is_empty() {
                        statements.push(s);
                    }
                    current = String::new();
                    i += dlen;
                    continue;
                }

                current.push(ch);
            }
        }

        i += 1;
    }

    // Flush any remaining content (no trailing semicolon)
    let s = current.trim().to_string();
    if !s.is_empty() {
        statements.push(s);
    }

    statements
}

/// Try to read a dollar-quote tag starting at position `i` in `chars`.
/// Returns `Some("$tag$")` (including the surrounding `$`) if found,
/// or `None` if this is not a dollar-quote opener.
fn try_read_dollar_tag(chars: &[char], i: usize) -> Option<String> {
    debug_assert_eq!(chars[i], '$');
    let len = chars.len();
    // Find the next '$' after i
    let mut j = i + 1;
    while j < len && chars[j] != '$' && chars[j] != '\n' && chars[j] != ' ' {
        j += 1;
    }
    if j >= len || chars[j] != '$' {
        return None;
    }
    // Valid tag: chars[i..=j] is "$...tag...$"
    let tag: String = chars[i..=j].iter().collect();
    Some(tag)
}

// ── Statement filter ──────────────────────────────────────────────────────────

/// Returns `true` for statements that should be stripped when importing into
/// an existing database (preamble noise, database-switching commands, etc.).
fn should_strip(stmt: &str) -> bool {
    let trimmed = stmt.trim();
    if trimmed.is_empty() {
        return true;
    }

    // Upper-case prefix for case-insensitive matching
    let up = {
        // Only upper-case the first ~80 chars to avoid allocating large strings
        let prefix = &trimmed[..trimmed.len().min(80)];
        prefix.to_uppercase()
    };

    // phpMyAdmin version-conditional comments: /*!NNNNNstatement*/
    // These appear as standalone statements in the split output because the
    // block-comment stripper drops them. They should never reach here, but
    // guard just in case older dump formats include them.
    if up.starts_with("/*!") {
        return true;
    }

    // psql meta-commands (pg_dump): \connect, \set, \i, \encoding, etc.
    if trimmed.starts_with('\\') {
        return true;
    }

    // Database-level DDL — not relevant when importing into a target DB
    if up.starts_with("CREATE DATABASE")
        || up.starts_with("DROP DATABASE")
        || up.starts_with("CREATE SCHEMA")
    {
        return true;
    }

    // MySQL USE statement
    if up.starts_with("USE ") || up == "USE" {
        return true;
    }

    // pg_dump: ALTER DATABASE ... OWNER TO ...
    if up.starts_with("ALTER DATABASE") {
        return true;
    }

    // pg_dump: SELECT pg_catalog.set_config('search_path', '', false)
    // This resets search_path to empty which would break subsequent statements.
    if up.starts_with("SELECT PG_CATALOG.SET_CONFIG") {
        return true;
    }

    // Character-set / collation SET statements from MySQL / phpMyAdmin
    // that are connection-level noise.
    // Keep: SET search_path (schema routing), START TRANSACTION, COMMIT, PRAGMA, SET FOREIGN_KEY_CHECKS
    if up.starts_with("SET ") {
        // Allowed SET statements — do NOT strip these
        let allowed_prefixes = [
            "SET SEARCH_PATH",
            "SET FOREIGN_KEY_CHECKS",
            "SET UNIQUE_CHECKS",
            "SET AUTOCOMMIT",
            "SET SESSION_REPLICATION_ROLE",
            "SET STATEMENT_TIMEOUT",
            "SET LOCK_TIMEOUT",
            "SET IDLE_IN_TRANSACTION_SESSION_TIMEOUT",
            "SET STANDARD_CONFORMING_STRINGS",
            "SET CHECK_FUNCTION_BODIES",
            "SET XMLOPTION",
            "SET CLIENT_MIN_MESSAGES",
            "SET ROW_SECURITY",
        ];
        if allowed_prefixes.iter().any(|p| up.starts_with(p)) {
            return false;
        }

        // Strip these noise SET statements
        let strip_prefixes = [
            "SET NAMES",
            "SET CHARACTER_SET_CLIENT",
            "SET CHARACTER_SET_RESULTS",
            "SET CHARACTER_SET_CONNECTION",
            "SET COLLATION_CONNECTION",
            "SET SQL_MODE",
            "SET TIME_ZONE",
            "SET @OLD_",
            "SET @",
            "SET CLIENT_ENCODING",
        ];
        if strip_prefixes.iter().any(|p| up.starts_with(p)) {
            return true;
        }
    }

    false
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_phpmyadmin() {
        let content = "-- phpMyAdmin SQL Dump\n-- version 5.2\nSELECT 1;";
        assert_eq!(detect_dump_format(content), "phpmyadmin");
    }

    #[test]
    fn detects_pg_dump() {
        let content = "-- PostgreSQL database dump\nSET client_encoding = 'UTF8';";
        assert_eq!(detect_dump_format(content), "pg_dump");
    }

    #[test]
    fn detects_sqlite() {
        let content = "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;";
        assert_eq!(detect_dump_format(content), "sqlite_cli");
    }

    #[test]
    fn splits_basic_statements() {
        let sql = "CREATE TABLE t (id INT); INSERT INTO t VALUES (1);";
        let stmts = split_statements(sql);
        assert_eq!(stmts.len(), 2);
    }

    #[test]
    fn handles_semicolon_in_string() {
        let sql = "INSERT INTO t VALUES ('a;b'); SELECT 1;";
        let stmts = split_statements(sql);
        assert_eq!(stmts.len(), 2);
        assert!(stmts[0].contains("'a;b'"));
    }

    #[test]
    fn handles_dollar_quoting() {
        let sql =
            "CREATE FUNCTION f() RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql; SELECT 1;";
        let stmts = split_statements(sql);
        assert_eq!(stmts.len(), 2);
    }

    #[test]
    fn strips_use_statement() {
        assert!(should_strip("USE `mydb`"));
        assert!(should_strip("use mydb"));
    }

    #[test]
    fn strips_create_database() {
        assert!(should_strip("CREATE DATABASE mydb"));
        assert!(should_strip("CREATE DATABASE IF NOT EXISTS `mydb`"));
    }

    #[test]
    fn strips_psql_metacommands() {
        assert!(should_strip("\\connect mydb"));
        assert!(should_strip("\\set client_encoding UTF8"));
    }

    #[test]
    fn does_not_strip_search_path() {
        assert!(!should_strip("SET search_path = public, \"$user\""));
    }

    #[test]
    fn does_not_strip_pragma() {
        assert!(!should_strip("PRAGMA foreign_keys = OFF"));
    }

    #[test]
    fn extracts_mysql_db_name() {
        let stmts = vec!["USE `mydb`".to_string(), "CREATE TABLE t (id INT)".to_string()];
        assert_eq!(extract_db_name(&stmts), Some("mydb".to_string()));
    }

    #[test]
    fn extracts_pg_db_name() {
        let stmts = vec!["\\connect mydb".to_string()];
        assert_eq!(extract_db_name(&stmts), Some("mydb".to_string()));
    }

    #[test]
    fn full_phpmyadmin_dump() {
        let sql = r#"
-- phpMyAdmin SQL Dump
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `shop`;
USE `shop`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
);
INSERT INTO `users` VALUES (1,'Alice');
"#;
        let parsed = parse_sql_dump(sql);
        assert_eq!(parsed.detected_format, "phpmyadmin");
        assert_eq!(parsed.detected_db_name, Some("shop".to_string()));
        // Only CREATE TABLE and INSERT should survive
        assert!(parsed.statements.iter().any(|s| s.contains("CREATE TABLE")));
        assert!(parsed.statements.iter().any(|s| s.contains("INSERT INTO")));
        // Stripped statements must not appear
        assert!(!parsed.statements.iter().any(|s| s.to_uppercase().starts_with("USE ")));
        assert!(!parsed.statements.iter().any(|s| s.to_uppercase().starts_with("SET SQL_MODE")));
    }
}
