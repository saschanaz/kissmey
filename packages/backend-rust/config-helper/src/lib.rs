use serde::Deserialize;
use std::path::{Path, PathBuf};

pub fn is_test_mode() -> bool {
    match std::env::var("NODE_ENV") {
        Ok(s) if s.as_str() == "test" => true,
        _ => false,
    }
}

fn config_path() -> PathBuf {
    let file_dir = Path::new(file!()).parent().expect("src directory");
    let config_dir = file_dir.join("../../../../.config");
    if is_test_mode() {
        config_dir.join("test.yml")
    } else {
        config_dir.join("default.yml")
    }
}

#[derive(Deserialize)]
pub struct DbConfig {
    pub host: String,
    pub port: u16,
    pub db: String,
    pub user: String,
    pub pass: String,
}

#[derive(Deserialize)]
pub struct RedisConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Deserialize)]
pub struct Config {
    pub port: u16,
    pub db: DbConfig,
    pub redis: RedisConfig,
}

pub fn load_config() -> Config {
    let path = config_path();
    let config_str =
        std::fs::read_to_string(&path).unwrap_or_else(|_| panic!("{path:?} must exist"));

    serde_yaml::from_str(&config_str[..]).expect("Failed to deserialize the config file")
}
