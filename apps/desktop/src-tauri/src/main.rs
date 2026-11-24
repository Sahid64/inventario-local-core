#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct BackendProcess(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // En producción, arranca el servidor local Node/sidecar junto con la ventana nativa.
            #[cfg(not(debug_assertions))]
            let child = Command::new("node")
                .arg("../backend/dist/server.js")
                .spawn()
                .ok();

            #[cfg(debug_assertions)]
            let child: Option<Child> = None;

            app.manage(BackendProcess(Mutex::new(child)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Error al iniciar la aplicación de escritorio Inventario Local");
}
