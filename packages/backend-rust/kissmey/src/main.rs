mod endpoints;

use axum::{routing::post, Router};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // initialize tracing
    tracing_subscriber::fmt::init();

    // build our application with a route
    let app = Router::new().route("/api/reset-db", post(endpoints::reset_db::reset_db));

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    let config = config_helper::load_config();
    // Use port+1 temporarily before becoming a standalone server
    let port = config.port + 1;
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::debug!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
