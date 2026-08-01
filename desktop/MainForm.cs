using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

namespace SSMartPos;

public class MainForm : Form
{
    private readonly WebView2 _webView;
    private readonly ProcessManager _processManager;
    private TrayManager? _trayManager;
    private HotkeyManager? _hotkeyManager;
    private readonly Label _loadingLabel;
    private readonly Label _statusLabel;
    private readonly ProgressBar _loadingBar;

    private const int BACKEND_PORT = 4000;
    private const int FRONTEND_PORT = 1994;

    public MainForm()
    {
        _processManager = new ProcessManager();

        // ── Window setup ──
        Text = "SS Mart — Sai Sangameshwara Mart";
        Size = new Size(1400, 900);
        MinimumSize = new Size(1024, 700);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(15, 23, 42);
        Icon = LoadEmbeddedIcon("icon.ico");

        // ── Loading UI ──
        _loadingLabel = new Label
        {
            Text = "SS Mart POS",
            ForeColor = Color.FromArgb(37, 99, 235),
            Font = new Font("Segoe UI", 24F, FontStyle.Bold),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Top,
            Height = 200
        };
        Controls.Add(_loadingLabel);

        _statusLabel = new Label
        {
            Text = "Starting backend server...",
            ForeColor = Color.FromArgb(148, 163, 184),
            Font = new Font("Segoe UI", 10F),
            AutoSize = false,
            TextAlign = ContentAlignment.TopCenter,
            Dock = DockStyle.Top,
            Height = 40
        };
        Controls.Add(_statusLabel);

        _loadingBar = new ProgressBar
        {
            Dock = DockStyle.Top,
            Height = 4,
            Style = ProgressBarStyle.Marquee,
            MarqueeAnimationSpeed = 30
        };
        Controls.Add(_loadingBar);

        // ── WebView2 ──
        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            Visible = false
        };
        Controls.Add(_webView);

        // ── Events ──
        FormClosing += OnFormClosing;
        Resize += OnResize;
        Load += OnLoad;
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        await StartApplicationAsync();
    }

    private async Task StartApplicationAsync()
    {
        try
        {
            // Kill leftover processes
            UpdateStatus("Checking ports...");
            _processManager.KillExistingProcesses(BACKEND_PORT, FRONTEND_PORT);
            await Task.Delay(1000);

            // Start backend
            UpdateStatus("Starting backend server...");
            _processManager.StartBackend();

            if (!await _processManager.WaitForPort(BACKEND_PORT, 20000))
            {
                ShowError("Backend server failed to start.\nPlease check if port 4000 is available.");
                Close();
                return;
            }

            // Start frontend
            UpdateStatus("Starting frontend...");
            _processManager.StartFrontend();

            if (!await _processManager.WaitForPort(FRONTEND_PORT, 30000))
            {
                ShowError("Frontend server failed to start.\nPlease check if port 1994 is available.");
                Close();
                return;
            }

            // Initialize WebView2
            UpdateStatus("Loading application...");
            await InitializeWebViewAsync();

            // Setup tray and hotkeys
            _trayManager = new TrayManager(this);
            _hotkeyManager = new HotkeyManager(this);
            _hotkeyManager.Register();
        }
        catch (Exception ex)
        {
            ShowError($"Failed to start SS Mart:\n\n{ex.Message}");
            Close();
        }
    }

    private async Task InitializeWebViewAsync()
    {
        var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(
            null, Path.Combine(Path.GetTempPath(), "SSMartPosWebView2"),
            new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions());

        await _webView.EnsureCoreWebView2Async(env);

        _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
        _webView.CoreWebView2.Settings.AreDevToolsEnabled =
            Environment.GetCommandLineArgs().Contains("--dev");
        _webView.CoreWebView2.Settings.IsZoomControlEnabled = true;
        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

        // Open external links in system browser
        _webView.CoreWebView2.NewWindowRequested += (s, e) =>
        {
            Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true });
            e.Handled = true;
        };

        // Handle messages from web app (e.g., print requests)
        _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

        // Navigate
        _loadingLabel.Visible = false;
        _statusLabel.Visible = false;
        _loadingBar.Visible = false;
        _webView.Visible = true;

        _webView.CoreWebView2.Navigate($"http://localhost:{FRONTEND_PORT}/login");
    }

    private void OnWebMessageReceived(object? sender,
        Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        var msg = e.WebMessageAsJson;
        // Handle print requests, etc.
        Debug.WriteLine($"[WebView2 Message] {msg}");
    }

    public void NavigateTo(string path)
    {
        if (_webView.CoreWebView2 != null)
        {
            _webView.CoreWebView2.Navigate($"http://localhost:{FRONTEND_PORT}{path}");
        }
    }

    public void NavigateToLogin()
    {
        NavigateTo("/login");
    }

    private void UpdateStatus(string msg)
    {
        _statusLabel.Text = msg;
    }

    private static void ShowError(string message)
    {
        MessageBox.Show(message, "SS Mart POS — Error",
            MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            Hide();
            _trayManager?.ShowBalloon("SS Mart minimized to tray. Right-click to restore.");
            return;
        }
        Cleanup();
    }

    private void OnResize(object? sender, EventArgs e)
    {
        if (WindowState == FormWindowState.Minimized)
        {
            Hide();
        }
    }

    public void ForceQuit()
    {
        Cleanup();
        Application.Exit();
    }

    private void Cleanup()
    {
        _hotkeyManager?.Unregister();
        _trayManager?.Dispose();
        _processManager.KillAll();
        _webView?.Dispose();
    }

    private static Icon LoadEmbeddedIcon(string name)
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            var resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith(name));
            if (resourceName != null)
                return new Icon(assembly.GetManifestResourceStream(resourceName)!);
        }
        catch { }
        return SystemIcons.Application;
    }
}
