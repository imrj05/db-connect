use crate::db::DatabaseDriver;
use crate::types::*;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions, PgSslMode},
    Column, Pool, Postgres, Row,
};
use std::time::Instant;

pub struct PostgresDriver {
    pub pool: tokio::sync::RwLock<Option<Pool<Postgres>>>,
}

impl PostgresDriver {
    pub fn new() -> Self {
        Self {
            pool: tokio::sync::RwLock::new(Option::None),
        }
    }
}

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()> {
        let options: PgConnectOptions = if let Some(uri) = &config.uri {
            uri.parse()?
        } else {
            PgConnectOptions::new()
                .host(config.host.as_deref().unwrap_or("localhost"))
                .port(config.port.unwrap_or(5432))
                .username(config.user.as_deref().unwrap_or("postgres"))
                .password(config.password.as_deref().unwrap_or(""))
                .database(config.database.as_deref().unwrap_or("postgres"))
        };

        let ssl_mode = if config.ssl.unwrap_or(false) {
            PgSslMode::Require
        } else {
            PgSslMode::Prefer
        };

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect_with(options.ssl_mode(ssl_mode))
            .await?;

        let mut pool_lock = self.pool.write().await;
        *pool_lock = Some(pool);
        Ok(())
    }

    async fn disconnect(&self) -> Result<()> {
        let mut pool_lock = self.pool.write().await;
        if let Some(pool) = pool_lock.take() {
            pool.close().await;
        }
        Ok(())
    }

    async fn get_databases(&self) -> Result<Vec<String>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let rows = sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false")
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
    }

    async fn get_schemas(&self, _database: &str) -> Result<Vec<String>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let rows = sqlx::query("SELECT schema_name FROM information_schema.schemata")
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
    }

    async fn get_tables(&self, _database: &str, schema: Option<&str>) -> Result<Vec<TableInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let schema_name = schema.unwrap_or("public");
        let rows =
            sqlx::query("SELECT table_name FROM information_schema.tables WHERE table_schema = $1")
                .bind(schema_name)
                .fetch_all(pool)
                .await?;

        Ok(rows
            .iter()
            .map(|r| TableInfo {
                name: r.get::<String, _>(0),
                schema: Some(schema_name.to_string()),
                columns: None,
            })
            .collect())
    }

    async fn get_columns(
        &self,
        _database: &str,
        table: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let schema_name = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT
                col.column_name,
                pg_catalog.format_type(attr.atttypid, attr.atttypmod) AS data_type,
                col.is_nullable = 'YES' AS nullable,
                col.column_default,
                COALESCE(bool_or(tc.constraint_type = 'PRIMARY KEY'), false) AS is_primary,
                COALESCE(bool_or(tc.constraint_type = 'UNIQUE'), false) AS is_unique,
                NULLIF(
                    array_to_string(
                        array_remove(
                            ARRAY[
                                CASE
                                    WHEN col.is_identity = 'YES'
                                        THEN CONCAT('identity', COALESCE(' ' || lower(col.identity_generation), ''))
                                END,
                                CASE
                                    WHEN col.is_generated <> 'NEVER'
                                        THEN CONCAT('generated ', lower(col.is_generated))
                                END,
                                CASE
                                    WHEN col.is_updatable = 'NO'
                                        THEN 'read-only'
                                END
                            ],
                            NULL
                        ),
                        ', '
                    ),
                    ''
                ) AS extra
             FROM information_schema.columns col
             JOIN pg_catalog.pg_namespace ns
                 ON ns.nspname = col.table_schema
             JOIN pg_catalog.pg_class cls
                 ON cls.relname = col.table_name
                 AND cls.relnamespace = ns.oid
             JOIN pg_catalog.pg_attribute attr
                 ON attr.attrelid = cls.oid
                 AND attr.attname = col.column_name
                 AND attr.attnum > 0
                 AND NOT attr.attisdropped
             LEFT JOIN information_schema.key_column_usage kcu
                 ON kcu.column_name = col.column_name
                 AND kcu.table_name = col.table_name
                 AND kcu.table_schema = col.table_schema
             LEFT JOIN information_schema.table_constraints tc
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
             WHERE col.table_name = $1 AND col.table_schema = $2
             GROUP BY
                col.column_name,
                pg_catalog.format_type(attr.atttypid, attr.atttypmod),
                col.is_nullable,
                col.column_default,
                col.ordinal_position,
                col.is_identity,
                col.identity_generation,
                col.is_generated,
                col.is_updatable
             ORDER BY col.ordinal_position"
        )
        .bind(table)
        .bind(schema_name)
        .fetch_all(pool)
        .await?;

        Ok(rows
            .iter()
            .map(|r| ColumnInfo {
                name: r.get(0),
                data_type: r.get(1),
                nullable: r.get(2),
                default_value: r.try_get::<Option<String>, _>(3).unwrap_or(None),
                is_primary: r.get(4),
                is_unique: r.get(5),
                extra: r.try_get::<Option<String>, _>(6).unwrap_or(None),
            })
            .collect())
    }

    async fn get_indexes(
        &self,
        _database: &str,
        table: &str,
        schema: Option<&str>,
    ) -> Result<Vec<IndexInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let schema_name = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT
                i.relname AS index_name,
                ix.indisunique AS is_unique,
                am.amname AS index_type,
                array_agg(a.attname ORDER BY k.ord) AS columns
             FROM pg_index ix
             JOIN pg_class t ON t.oid = ix.indrelid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_am am ON am.oid = i.relam
             JOIN pg_namespace n ON n.oid = t.relnamespace
             JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
             JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND a.attnum > 0
             WHERE t.relname = $1 AND n.nspname = $2
             GROUP BY i.relname, ix.indisunique, am.amname
             ORDER BY i.relname",
        )
        .bind(table)
        .bind(schema_name)
        .fetch_all(pool)
        .await?;

        Ok(rows
            .iter()
            .map(|r| {
                let cols: Vec<String> = r.try_get::<Vec<String>, _>(3).unwrap_or_default();
                IndexInfo {
                    name: r.get(0),
                    unique: r.get(1),
                    index_type: r.try_get::<String, _>(2).ok(),
                    columns: cols,
                }
            })
            .collect())
    }

    async fn get_foreign_keys(
        &self,
        _database: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ForeignKeyRelation>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let schema_name = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT
                tc.constraint_name,
                kcu.table_schema AS source_schema,
                kcu.table_name AS source_table,
                kcu.column_name AS source_column,
                kcu.ordinal_position AS ordinal_position,
                ccu.table_schema AS target_schema,
                ccu.table_name AS target_table,
                ccu.column_name AS target_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
             JOIN information_schema.referential_constraints rc
               ON tc.constraint_name = rc.constraint_name
              AND tc.table_schema = rc.constraint_schema
             JOIN information_schema.key_column_usage ccu
               ON rc.unique_constraint_name = ccu.constraint_name
              AND rc.unique_constraint_schema = ccu.constraint_schema
              AND ccu.ordinal_position = kcu.position_in_unique_constraint
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_schema = $1
             ORDER BY kcu.table_name, tc.constraint_name, kcu.ordinal_position",
        )
        .bind(schema_name)
        .fetch_all(pool)
        .await?;

        use std::collections::BTreeMap;

        let mut relation_map: BTreeMap<
            (String, String, String, String, String),
            ForeignKeyRelation,
        > = BTreeMap::new();

        for row in rows {
            let name: String = row.get(0);
            let source_schema: String = row.get(1);
            let source_table: String = row.get(2);
            let source_column: String = row.get(3);
            let target_schema: String = row.get(5);
            let target_table: String = row.get(6);
            let target_column: String = row.get(7);
            let key = (
                source_schema.clone(),
                source_table.clone(),
                name.clone(),
                target_schema.clone(),
                target_table.clone(),
            );

            let relation = relation_map
                .entry(key)
                .or_insert_with(|| ForeignKeyRelation {
                    name: name.clone(),
                    source_table: source_table.clone(),
                    source_schema: Some(source_schema.clone()),
                    source_columns: Vec::new(),
                    target_table: target_table.clone(),
                    target_schema: Some(target_schema.clone()),
                    target_columns: Vec::new(),
                });

            relation.source_columns.push(source_column);
            relation.target_columns.push(target_column);
        }

        Ok(relation_map.into_values().collect())
    }

    async fn run_query(&self, query: &str) -> Result<QueryResult> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let start = Instant::now();
        let rows = sqlx::query(query).fetch_all(pool).await?;
        let duration = start.elapsed().as_millis() as u64;

        if rows.is_empty() {
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                execution_time_ms: duration,
            });
        }

        let columns = rows[0]
            .columns()
            .iter()
            .map(|c| c.name().to_string())
            .collect::<Vec<_>>();
        let mut result_rows = Vec::new();

        for row in rows {
            let mut obj = serde_json::Map::<String, serde_json::Value>::new();
            for (i, col_name) in columns.iter().enumerate() {
                let val: serde_json::Value = if let Ok(s) = row.try_get::<String, _>(i) {
                    serde_json::Value::String(s)
                } else if let Ok(id) = row.try_get::<uuid::Uuid, _>(i) {
                    serde_json::Value::String(id.to_string())
                } else if let Ok(n) = row.try_get::<i64, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(n) = row.try_get::<i32, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(n) = row.try_get::<i16, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(n) = row.try_get::<i8, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(f) = row.try_get::<f64, _>(i) {
                    serde_json::Value::Number(
                        serde_json::Number::from_f64(f).unwrap_or_else(|| 0.into()),
                    )
                } else if let Ok(f) = row.try_get::<f32, _>(i) {
                    serde_json::Value::Number(
                        serde_json::Number::from_f64(f as f64).unwrap_or_else(|| 0.into()),
                    )
                } else if let Ok(b) = row.try_get::<bool, _>(i) {
                    serde_json::Value::Bool(b)
                } else if let Ok(d) = row.try_get::<chrono::NaiveDate, _>(i) {
                    serde_json::Value::String(d.to_string())
                } else if let Ok(t) = row.try_get::<chrono::NaiveTime, _>(i) {
                    serde_json::Value::String(t.to_string())
                } else if let Ok(dt) = row.try_get::<chrono::NaiveDateTime, _>(i) {
                    serde_json::Value::String(dt.to_string())
                } else if let Ok(dt) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(i) {
                    serde_json::Value::String(dt.to_rfc3339())
                } else if let Ok(dt) = row.try_get::<chrono::DateTime<chrono::FixedOffset>, _>(i) {
                    serde_json::Value::String(dt.to_rfc3339())
                } else if let Ok(json) = row.try_get::<serde_json::Value, _>(i) {
                    json
                } else {
                    serde_json::Value::Null
                };
                obj.insert(col_name.clone(), val);
            }
            result_rows.push(serde_json::Value::Object(obj));
        }

        Ok(QueryResult {
            columns,
            rows: result_rows,
            execution_time_ms: duration,
        })
    }

    async fn get_table_data(
        &self,
        database: &str,
        table: &str,
        page: u32,
        page_size: u32,
    ) -> Result<QueryResult> {
        let query = format!(
            "SELECT * FROM \"{}\".\"{}\" LIMIT {} OFFSET {}",
            database,
            table,
            page_size,
            page * page_size
        );
        self.run_query(&query).await
    }

    async fn dump_database(
        &self,
        database: &str,
        schema: Option<&str>,
        include_data: bool,
    ) -> Result<String> {
        let schema_name = schema.unwrap_or("public");

        let mut sql = String::new();
        sql.push_str(&format!("-- Database: {}\n", database));
        sql.push_str(&format!("-- Schema: {}\n\n", schema_name));

        let tables = self.get_tables(database, Some(schema_name)).await?;
        let foreign_keys = self.get_foreign_keys(database, Some(schema_name)).await.unwrap_or_default();

        for table_info in &tables {
            let tname = &table_info.name;
            let qi_table = format!("\"{}\".\"{}\"", schema_name, tname);

            sql.push_str(&format!("DROP TABLE IF EXISTS {} CASCADE;\n", qi_table));

            let columns = self.get_columns(database, tname, Some(schema_name)).await?;
            let indexes = self.get_indexes(database, tname, Some(schema_name)).await.unwrap_or_default();

            sql.push_str(&format!("CREATE TABLE {} (\n", qi_table));
            let mut col_defs = Vec::new();
            let mut pk_cols = Vec::new();

            for col in &columns {
                let mut def = format!("    \"{}\" {}", col.name, col.data_type);
                if !col.nullable && !col.is_primary {
                    def.push_str(" NOT NULL");
                }
                if let Some(ref dv) = col.default_value {
                    def.push_str(&format!(" DEFAULT {}", dv));
                }
                col_defs.push(def);
                if col.is_primary {
                    pk_cols.push(col.name.clone());
                }
            }

            if !pk_cols.is_empty() {
                let pk_list: Vec<String> = pk_cols.iter().map(|c| format!("\"{}\"", c)).collect();
                col_defs.push(format!("    PRIMARY KEY ({})", pk_list.join(", ")));
            }

            sql.push_str(&col_defs.join(",\n"));
            sql.push_str("\n);\n\n");

            for idx in &indexes {
                if idx.unique {
                    let cols: Vec<String> = idx.columns.iter().map(|c| format!("\"{}\"", c)).collect();
                    sql.push_str(&format!(
                        "CREATE UNIQUE INDEX \"{}\" ON {} ({});\n",
                        idx.name, qi_table, cols.join(", ")
                    ));
                } else {
                    let cols: Vec<String> = idx.columns.iter().map(|c| format!("\"{}\"", c)).collect();
                    sql.push_str(&format!(
                        "CREATE INDEX \"{}\" ON {} ({});\n",
                        idx.name, qi_table, cols.join(", ")
                    ));
                }
            }
            sql.push('\n');

            if include_data {
                let page_size: u32 = 500;
                let mut page: u32 = 0;
                loop {
                    let result = self.get_table_data(schema_name, tname, page, page_size).await?;
                    if result.rows.is_empty() && page == 0 {
                        break;
                    }
                    for row in &result.rows {
                        let vals: Vec<String> = result
                            .columns
                            .iter()
                            .map(|col| match row.get(col) {
                                Some(serde_json::Value::Null) | None => "NULL".to_string(),
                                Some(serde_json::Value::Bool(b)) => {
                                    if *b { "TRUE".to_string() } else { "FALSE".to_string() }
                                }
                                Some(serde_json::Value::Number(n)) => n.to_string(),
                                Some(serde_json::Value::String(s)) => {
                                    format!("'{}'", s.replace('\'', "''"))
                                }
                                Some(v) => {
                                    format!("'{}'", v.to_string().replace('\'', "''"))
                                }
                            })
                            .collect();
                        let col_list: Vec<String> = result.columns.iter().map(|c| format!("\"{}\"", c)).collect();
                        sql.push_str(&format!(
                            "INSERT INTO {} ({}) VALUES ({});\n",
                            qi_table, col_list.join(", "), vals.join(", ")
                        ));
                    }
                    if result.rows.len() < page_size as usize {
                        break;
                    }
                    page += 1;
                }
                sql.push('\n');
            }
        }

        for fk in &foreign_keys {
            let src_cols: Vec<String> = fk.source_columns.iter().map(|c| format!("\"{}\"", c)).collect();
            let tgt_cols: Vec<String> = fk.target_columns.iter().map(|c| format!("\"{}\"", c)).collect();
            let src_table = format!("\"{}\".\"{}\"", schema_name, fk.source_table);
            let tgt_schema = fk.target_schema.as_deref().unwrap_or(schema_name);
            let tgt_table = format!("\"{}\".\"{}\"", tgt_schema, fk.target_table);
            sql.push_str(&format!(
                "ALTER TABLE {} ADD CONSTRAINT \"{}\" FOREIGN KEY ({}) REFERENCES {} ({});\n",
                src_table, fk.name, src_cols.join(", "), tgt_table, tgt_cols.join(", ")
            ));
        }
        sql.push('\n');

        Ok(sql)
    }
}
