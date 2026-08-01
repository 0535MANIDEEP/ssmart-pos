use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Open SS Mart", true, None::<&str>)?;
    let new_sale_item = MenuItem::with_id(app, "new_sale", "New Sale (F11)", true, None::<&str>)?;
    let dashboard_item = MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
    let separator = MenuItem::with_id(app, "sep", "─────────────", false, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &separator,
            &new_sale_item,
            &dashboard_item,
            &separator,
            &quit_item,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .icon(Image::from_path("icons/icon.png").unwrap_or_else(|_| {
            Image::from_bytes(include_bytes!("../icons/32x32.png"))
                .expect("Failed to load tray icon")
        }))
        .tooltip("SS Mart POS")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "new_sale" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.eval("window.location.href = '/pos'");
                    }
                }
                "dashboard" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.eval("window.location.href = '/dashboard'");
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
