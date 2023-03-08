use axum::http::StatusCode;
use percent_encoding::{utf8_percent_encode, CONTROLS};
use sea_orm::entity::prelude::*;
use sea_orm::sea_query::{self, Expr, Iden, Query};
use sea_orm::{Condition, Database};

#[derive(Iden)]
enum InformationSchema {
    #[iden = "information_schema"]
    Schema,
    Tables,
    TableName,
    TableSchema,
    TableType,
}

async fn reset_db_impl(
    host: &str,
    port: u16,
    db: &str,
    username: &str,
    password: &str,
) -> Result<(), DbErr> {
    let username = utf8_percent_encode(username, CONTROLS);
    let password = utf8_percent_encode(password, CONTROLS);
    let database_url = format!("postgres://{username}:{password}@{host}:{port}/{db}");
    let db = Database::connect(&database_url).await?;

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

    Ok(())
}

pub async fn reset_db() -> StatusCode {
    let result = reset_db_impl("127.0.0.1", 54312, "test-misskey", "postgres", "").await;
    if result.is_ok() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
