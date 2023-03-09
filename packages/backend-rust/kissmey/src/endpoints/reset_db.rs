use axum::http::StatusCode;
use database_helper::misc::reset_db::reset_db as reset_db_impl;

pub async fn reset_db() -> StatusCode {
    let result = reset_db_impl().await;
    if result.is_ok() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
