use percent_encoding::{utf8_percent_encode, CONTROLS};
use sea_orm::entity::prelude::*;
use sea_orm::sea_query::{self, Expr, Iden, Query};
use sea_orm::{Condition, ConnectOptions, Database};

use config_helper::{is_test_mode, load_config, Config, DbConfig, RedisConfig};

#[derive(Iden)]
enum InformationSchema {
    #[iden = "information_schema"]
    Schema,
    Tables,
    TableName,
    TableSchema,
    TableType,
}

pub async fn reset_db() -> Result<(), DbErr> {
    let config = load_config();

    let Config { db, .. } = config;
    let DbConfig {
        host,
        port,
        db,
        user,
        pass,
    } = db;

    let username = utf8_percent_encode(&user[..], CONTROLS);
    let password = utf8_percent_encode(&pass[..], CONTROLS);

    let database_url = format!("postgres://{username}:{password}@{host}:{port}/{db}");
    let mut options: ConnectOptions = database_url.into();
    if is_test_mode() {
        // Don't want to let db messages dominate the whole test log
        options.sqlx_logging(false);
    }
    let db = Database::connect(options).await?;

    let mut select = Query::select();
    select
        .column(InformationSchema::TableName)
        .from((InformationSchema::Schema, InformationSchema::Tables))
        .cond_where(
            Condition::all()
                .add(Expr::col(InformationSchema::TableSchema).eq("public"))
                .add(Expr::col(InformationSchema::TableType).eq("BASE TABLE")),
        );

    let builder = db.get_database_backend();
    let stmt = builder.build(&select);

    let results = db.query_all(stmt).await?;
    for result in results {
        let name: String = result.try_get("", "table_name")?;
        db.execute_unprepared(&format!(r#"DELETE FROM "{name}" CASCADE"#)[..])
            .await?;
    }

    // XXX: Close explicitly, because dropping won't close it automatically.
    // See also https://github.com/launchbadge/sqlx/pull/2376
    // (The connection should ultimately be kept and be reused instead)
    db.close().await
}

pub async fn reset_redis() -> redis::RedisResult<()> {
    let config = load_config();

    let Config { redis, .. } = config;
    let RedisConfig { host, port } = redis;

    let client = redis::Client::open((host, port)).expect("Connect to Redis");
    let mut con = client.get_async_connection().await?;

    redis::cmd("FLUSHDB").query_async(&mut con).await?;

    Ok(())
}
