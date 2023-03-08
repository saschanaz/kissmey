mod misc;

#[tokio::main]
async fn main() {
    misc::reset_db::reset_db("127.0.0.1", 54312, "test-misskey", "postgres", "")
        .await
        .expect("Failed");
}
