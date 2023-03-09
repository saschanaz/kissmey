use axum::http::StatusCode;
use config_helper::is_test_mode;
use database_helper::misc::reset::{reset_db as reset_db_impl, reset_redis};

pub async fn reset_db() -> StatusCode {
    if !is_test_mode() {
        return StatusCode::BAD_REQUEST;
    }

    let redis_result = reset_redis().await;
    let db_result = reset_db_impl().await;
    if redis_result.is_ok() && db_result.is_ok() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
